"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import type { AgentRequest, TvAction } from "@/lib/types";
import { isListenSupported, listenOnce, type Listener } from "@/lib/voice/listen";
import { speak, splitSentences, stopSpeaking, unlockSpeech } from "@/lib/voice/speak";
import { callAgent } from "@/components/tv/agent-client";
import { formatTime, useDemoClock } from "@/components/tv/use-demo-clock";
import { ParticleOrb, type OrbMode, type OrbSignal } from "./ParticleOrb";

type Line = { text: string; en?: string; who: "assistant" | "user" };
type Card = { title: string; body?: string; learned?: string };
type Timer = { at: number; label: string; action: TvAction };

const CARD_MS = 6000;
const LEARNED_MS = 4500;
const TUNE_CARD_MS = 3000;
const TOAST_MS = 3500;
const RELISTEN_MS = 250;
const RETRY_MS = 1200;
const INBOX_POLL_MS = 1500;
const INBOX_MISSING_POLL_MS = 15_000;

const noopSubscribe = () => () => {};

function hasFlag(name: string) {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).has(name);
}

function learnedCount(title: string, body?: string): string | undefined {
  if (!/배운|가르쳐/.test(title)) return undefined;
  return `${title} ${body ?? ""}`.match(/(\d+)/)?.[1];
}

function pairEnglish(ko: string[], en?: string): (string | undefined)[] {
  if (!en?.trim()) return ko.map(() => undefined);
  const parts = splitSentences(en);
  return parts.length === ko.length ? parts : ko.map(() => en.trim());
}

export function OrbApp() {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const { now, getNow, forward, jumpTo } = useDemoClock();
  const signal = useRef<OrbSignal>({ mode: "idle", pulse: 0 });
  const [mode, setModeState] = useState<OrbMode>("idle");
  const [started, setStarted] = useState(false);
  const [line, setLine] = useState<Line | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [english, setEnglish] = useState(() => hasFlag("en"));
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef(0);
  const sayGenRef = useRef(0);
  const listenerRef = useRef<Listener | null>(null);
  const listenOkRef = useRef(true);
  const startedRef = useRef(false);
  const timersRef = useRef<Timer[]>([]);
  const cardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setMode = useCallback((m: OrbMode) => {
    signal.current.mode = m;
    setModeState(m);
  }, []);

  const showCard = useCallback((c: Card | null, ms = CARD_MS) => {
    if (cardTimer.current) clearTimeout(cardTimer.current);
    setCard(c);
    if (c) cardTimer.current = setTimeout(() => setCard(null), ms);
  }, []);

  const showToast = useCallback((text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  // ---------- agent turn ----------

  const say = useCallback(
    async (text: string, en?: string) => {
      const gen = sayGenRef.current;
      const ko = splitSentences(text);
      const eng = pairEnglish(ko, en);
      for (let i = 0; i < ko.length; i++) {
        if (sayGenRef.current !== gen) return;
        setLine({ who: "assistant", text: ko[i], en: eng[i] });
        setMode("speaking");
        await speak(ko[i]);
      }
    },
    [setMode],
  );

  const runActions = useCallback(
    (actions: TvAction[]) => {
      for (const a of actions) {
        if (a.type === "showCard") {
          const learned = learnedCount(a.title, a.body);
          showCard({ title: a.title, body: a.body, learned }, learned ? LEARNED_MS : CARD_MS);
        } else if (a.type === "tune") {
          showCard({ title: "채널을 바꿨어요", body: `${a.channel}번${a.reason ? ` · ${a.reason}` : ""}` }, TUNE_CARD_MS);
        } else if (a.type === "schedule") {
          const at = Date.parse(a.at);
          if (!Number.isNaN(at)) {
            timersRef.current = [...timersRef.current, { at, label: a.label, action: a.action }];
            showToast(`알림 맞춤 · ${formatTime(new Date(at))} ${a.label}`);
          }
        } else if (a.type === "notifyFamily") {
          showToast("가족에게 알렸어요");
        }
      }
    },
    [showCard, showToast],
  );

  const stopListening = useCallback(() => {
    const l = listenerRef.current;
    listenerRef.current = null;
    l?.abort();
  }, []);

  // Listening runs whenever nothing else is queued: hear, answer, hear again.
  const listenRef = useRef<() => void>(() => {});

  const enqueue = useCallback(
    (job: () => Promise<void>) => {
      pendingRef.current++;
      stopListening();
      queueRef.current = queueRef.current
        .then(job)
        .catch((err) => console.warn("[orb] turn failed", err))
        .finally(() => {
          pendingRef.current--;
          if (pendingRef.current === 0) listenRef.current();
        });
    },
    [stopListening],
  );

  const turn = useCallback(
    (req: Omit<AgentRequest, "now">) => {
      enqueue(async () => {
        setMode("thinking");
        const { reply } = await callAgent({ ...req, now: getNow().toISOString() });
        if (req.source === "voice" && reply.heardEn) setLine({ who: "user", text: req.text, en: reply.heardEn });
        runActions(reply.actions);
        if (reply.private) showToast("딸에게는 안 알려요");
        await say(reply.say, reply.sayEn);
      });
    },
    [enqueue, getNow, runActions, say, setMode, showToast],
  );

  const listen = useCallback(() => {
    if (!startedRef.current || pendingRef.current > 0 || listenerRef.current) return;
    if (!listenOkRef.current || !isListenSupported()) {
      setMode("idle");
      setTyping(true);
      return;
    }
    setMode("listening");
    let heard = false;
    const self = listenOnce({
      onInterim: (t) => {
        signal.current.pulse = 1;
        if (t) setLine({ who: "user", text: t });
      },
      onFinal: (t) => {
        heard = true;
        setLine({ who: "user", text: t });
        turn({ text: t, source: "voice" });
      },
      onError: (code) => {
        if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") {
          listenOkRef.current = false;
          setNotice("마이크를 허용해 주세요");
          setTyping(true);
        }
      },
      onEnd: () => {
        if (listenerRef.current === self) listenerRef.current = null;
        if (heard || pendingRef.current > 0 || !startedRef.current) return;
        // Silence or a hiccup: keep listening, like an open phone line.
        setTimeout(() => listenRef.current(), listenOkRef.current ? RELISTEN_MS : RETRY_MS);
      },
    });
    listenerRef.current = self;
    if (!self) setMode("idle");
  }, [setMode, turn]);

  useEffect(() => {
    listenRef.current = listen;
  }, [listen]);

  // ---------- start ----------

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    unlockSpeech();
    setStarted(true);
    turn({ text: "morning-checkin", source: "proactive" });
  }, [turn]);

  // A tap after start interrupts the voice, closes a card and goes back to listening.
  const onTap = () => {
    if (!startedRef.current) {
      start();
      return;
    }
    if (card) showCard(null);
    if (signal.current.mode === "speaking") {
      sayGenRef.current++;
      stopSpeaking();
    }
  };

  // Opened from the home screen icon: start right away if the browser already allows sound.
  useEffect(() => {
    const ua = navigator as Navigator & { userActivation?: { hasBeenActive: boolean } };
    if (ua.userActivation?.hasBeenActive) start();
  }, [start]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  // ---------- reminders on the demo clock ----------

  useEffect(() => {
    if (!now || !startedRef.current) return;
    const t = now.getTime();
    const due = timersRef.current.filter((x) => x.at <= t);
    if (due.length === 0) return;
    timersRef.current = timersRef.current.filter((x) => x.at > t);
    for (const d of due) {
      enqueue(async () => {
        runActions([d.action]);
        await say(d.label);
      });
    }
  }, [now, enqueue, runActions, say]);

  // ---------- family messages and the phone remote ----------

  const onInbox = useEffectEvent((item: { from?: string; text?: string }) => {
    const text = item.text?.trim();
    if (!text || !startedRef.current) return;
    if (item.from === "remote") {
      if (!text.startsWith("key:")) turn({ text, source: "voice" });
      return;
    }
    turn({ text: item.from ? `${item.from}: ${text}` : text, source: "family" });
  });

  useEffect(() => {
    if (hasFlag("noinbox")) return;
    let stopped = false;
    let handle: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let wait = INBOX_POLL_MS;
      try {
        if (startedRef.current) {
          const res = await fetch("/api/family/inbox", { cache: "no-store" });
          if (res.status === 404) wait = INBOX_MISSING_POLL_MS;
          else if (res.ok) {
            const json: unknown = await res.json();
            if (Array.isArray(json)) for (const item of json) onInbox(item);
          }
        }
      } catch {
        // offline or not built yet
      }
      if (!stopped) handle = setTimeout(poll, wait);
    };
    handle = setTimeout(poll, INBOX_POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(handle);
    };
  }, []);

  // ---------- desktop demo keys ----------

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    switch (e.code) {
      case "Enter":
      case "Space":
        e.preventDefault();
        onTap();
        break;
      case "KeyE":
        setEnglish((v) => !v);
        break;
      case "KeyT":
        e.preventDefault();
        setTyping((v) => !v);
        break;
      case "KeyP":
        if (startedRef.current) turn({ text: "morning-checkin", source: "proactive" });
        else start();
        break;
      case "KeyF":
        forward(30);
        break;
      case "KeyN": {
        const target = getNow();
        target.setDate(target.getDate() + 1);
        target.setHours(8, 0, 0, 0);
        timersRef.current = timersRef.current.filter((x) => x.at >= target.getTime());
        jumpTo(target);
        sayGenRef.current++;
        stopSpeaking();
        showCard({ title: "다음 날 아침", body: english ? "Next morning, 8:00" : "오전 8:00" }, 2500);
        startedRef.current = true;
        setStarted(true);
        turn({ text: "morning-checkin", source: "proactive" });
        break;
      }
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(
    () => () => {
      startedRef.current = false;
      stopListening();
      stopSpeaking();
    },
    [stopListening],
  );

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    if (!startedRef.current) {
      startedRef.current = true;
      setStarted(true);
      unlockSpeech();
    }
    setLine({ who: "user", text: t });
    turn({ text: t, source: "voice" });
  };

  if (!mounted) return <main className="orb-root" />;

  return (
    <main className={`orb-root is-${mode}`} onPointerDown={onTap}>
      <ParticleOrb signal={signal} />

      {!started && <p className="orb-start">눌러서 시작</p>}
      {notice && <p className="orb-notice">{notice}</p>}

      {card && (
        <section className={`orb-card ${card.learned ? "is-learned" : ""}`} role="dialog" aria-label={card.title}>
          {card.learned && <span className="orb-card-num">{card.learned}</span>}
          <span className="orb-card-text">
            {card.learned && <span className="orb-card-label">할머니가 가르쳐 주신 것</span>}
            <h2 className="orb-card-title">{card.title}</h2>
            {card.body && <p className="orb-card-body">{card.body}</p>}
          </span>
        </section>
      )}

      {toast && <p className="orb-toast">{toast}</p>}

      <div className="orb-line" aria-live="polite">
        {line && <p className={`orb-line-ko ${line.who === "user" ? "is-user" : ""}`}>{line.text}</p>}
        {english && line?.en && <p className="orb-line-en">{line.en}</p>}
      </div>

      {typing && (
        <form
          className="orb-type"
          onPointerDown={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            className="orb-type-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="말 대신 글로 적기"
            aria-label="말 대신 글로 적기"
          />
        </form>
      )}
    </main>
  );
}
