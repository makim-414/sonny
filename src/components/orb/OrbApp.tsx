"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import type { AgentRequest, TvAction } from "@/lib/types";
import { isListenSupported, listenOnce, type Listener } from "@/lib/voice/listen";
import { splitSentences, unlockSpeech } from "@/lib/voice/speak";
import { speakSentences, stopVoice, unlockAudio, voiceLevel, warmTts } from "@/lib/tts/player";
import { createVad, type Vad } from "@/lib/voice/vad";
import { transcribe } from "@/lib/voice/stt";
import { APP_LANG } from "@/lib/brand";
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

const LANG = APP_LANG === "en" ? "en-US" : "ko-KR";

// Screen words in the conversation language (brand.ts APP_LANG).
const COPY = {
  en: {
    start: "Tap to start",
    micBlocked: "Please allow the microphone",
    type: "Type instead",
    family: "Family notified",
    private: "Kept private from family",
    reminder: "Reminder set",
    channel: "Changed the channel",
    channelBody: (n: number) => `Channel ${n}`,
    taught: "What grandma taught me",
    nextDay: "Next morning",
  },
  ko: {
    start: "눌러서 시작",
    micBlocked: "마이크를 허용해 주세요",
    type: "말 대신 글로 적기",
    family: "가족에게 알렸어요",
    private: "딸에게는 안 알려요",
    reminder: "알림 맞춤",
    channel: "채널을 바꿨어요",
    channelBody: (n: number) => `${n}번`,
    taught: "할머니가 가르쳐 주신 것",
    nextDay: "다음 날 아침",
  },
}[APP_LANG];

function hasFlag(name: string) {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).has(name);
}

function learnedCount(title: string, body?: string): string | undefined {
  if (!/배운|가르쳐|taught|learned/i.test(title)) return undefined;
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
  const signal = useRef<OrbSignal>({ mode: "idle", pulse: 0, level: voiceLevel });
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
  const vadRef = useRef<Vad | null>(null);
  // Web Speech works here (false on e.g. iPhone home-screen apps) and the server STT answers.
  const webSpeechOkRef = useRef(!hasFlag("stt")); // ?stt forces the server path
  const sttOkRef = useRef(true);
  const serverListeningRef = useRef(false);
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
      const parts = splitSentences(text);
      const eng = APP_LANG === "en" ? parts.map(() => undefined) : pairEnglish(parts, en);
      setMode("speaking");
      await speakSentences(parts, {
        lang: LANG,
        onSentence: (i) => setLine({ who: "assistant", text: parts[i], en: eng[i] }),
        isCancelled: () => sayGenRef.current !== gen,
      });
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
          showCard({ title: COPY.channel, body: `${COPY.channelBody(a.channel)}${a.reason ? ` · ${a.reason}` : ""}` }, TUNE_CARD_MS);
        } else if (a.type === "schedule") {
          const at = Date.parse(a.at);
          if (!Number.isNaN(at)) {
            timersRef.current = [...timersRef.current, { at, label: a.label, action: a.action }];
            showToast(`${COPY.reminder} · ${formatTime(new Date(at))} ${a.label}`);
          }
        } else if (a.type === "notifyFamily") {
          showToast(COPY.family);
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
      // Never listen while the assistant thinks or talks, so it cannot hear itself.
      vadRef.current?.pause();
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

  const runTurn = useCallback(
    async (req: Omit<AgentRequest, "now">) => {
      setMode("thinking");
      const { reply } = await callAgent({ ...req, now: getNow().toISOString() });
      if (req.source === "voice" && reply.heardEn) setLine({ who: "user", text: req.text, en: reply.heardEn });
      runActions(reply.actions);
      if (reply.private) showToast(COPY.private);
      await say(reply.say, reply.sayEn);
    },
    [getNow, runActions, say, setMode, showToast],
  );

  const turn = useCallback((req: Omit<AgentRequest, "now">) => enqueue(() => runTurn(req)), [enqueue, runTurn]);

  // Server path: the VAD caught a whole utterance; whisper writes it down, then the agent answers.
  const onUtterance = useCallback(
    (audio: Float32Array) => {
      if (!serverListeningRef.current) return;
      serverListeningRef.current = false;
      enqueue(async () => {
        setMode("thinking");
        const r = await transcribe(audio);
        if (!r.ok) {
          if (r.unavailable) {
            sttOkRef.current = false;
            setTyping(true);
          }
          return;
        }
        if (!r.text) return;
        setLine({ who: "user", text: r.text });
        await runTurn({ text: r.text, source: "voice" });
      });
    },
    [enqueue, runTurn, setMode],
  );

  const listen = useCallback(() => {
    if (!startedRef.current || pendingRef.current > 0 || listenerRef.current || serverListeningRef.current) return;
    if (!listenOkRef.current) {
      setMode("idle");
      setTyping(true);
      return;
    }
    if (!webSpeechOkRef.current || !isListenSupported()) {
      // No Web Speech: let the VAD catch the utterance and send it to the server STT.
      if (vadRef.current && sttOkRef.current) {
        serverListeningRef.current = true;
        setMode("listening");
        vadRef.current.start();
      } else {
        setMode("idle");
        if (!sttOkRef.current || hasFlag("novad")) setTyping(true);
      }
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
        if (code === "not-allowed" || code === "audio-capture") {
          listenOkRef.current = false;
          setNotice(COPY.micBlocked);
          setTyping(true);
        } else if (code === "service-not-allowed" || code === "network" || code === "language-not-supported") {
          // The recognizer itself is unavailable (iPhone home-screen app, offline): use the server STT.
          webSpeechOkRef.current = false;
        }
      },
      onEnd: () => {
        if (listenerRef.current === self) listenerRef.current = null;
        if (heard || pendingRef.current > 0 || !startedRef.current) return;
        // Silence or a hiccup: keep listening, like an open phone line.
        setTimeout(() => listenRef.current(), listenOkRef.current ? RELISTEN_MS : RETRY_MS);
      },
    }, LANG);
    listenerRef.current = self;
    if (!self) setMode("idle");
    else vadRef.current?.start();
  }, [setMode, turn]);

  useEffect(() => {
    listenRef.current = listen;
  }, [listen]);

  // ---------- start ----------

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    unlockAudio();
    unlockSpeech();
    setStarted(true);
    turn({ text: "morning-checkin", source: "proactive" });
    // Silero VAD decides when a turn ends (0.7 s of silence), then Web Speech hands over the words.
    if (!hasFlag("novad")) {
      void createVad({
        onSpeechStart: () => {
          signal.current.pulse = 1;
        },
        onSpeechEnd: (audio) => {
          if (serverListeningRef.current) onUtterance(audio);
          else listenerRef.current?.stop();
        },
        onLevel: (lv) => {
          if (signal.current.mode === "listening") signal.current.pulse = Math.max(signal.current.pulse, lv);
        },
      }).then((v) => {
        vadRef.current = v;
        if (!v || pendingRef.current > 0) return;
        if (listenerRef.current) v.start();
        else listenRef.current(); // was waiting for the VAD to use the server STT
      });
    }
  }, [turn, onUtterance]);

  // A tap after start interrupts the voice, closes a card and goes back to listening.
  const onTap = () => {
    if (!startedRef.current) {
      start();
      return;
    }
    if (card) showCard(null);
    if (signal.current.mode === "speaking") {
      sayGenRef.current++;
      stopVoice();
    }
  };

  // Opened from the home screen icon: start right away if the browser already allows sound.
  useEffect(() => {
    const ua = navigator as Navigator & { userActivation?: { hasBeenActive: boolean } };
    if (ua.userActivation?.hasBeenActive) start();
  }, [start]);

  useEffect(() => {
    // Dev-only probe so headless checks can read the live voice level.
    if (process.env.NODE_ENV !== "production") {
      Object.assign(window, { __orbVoiceLevel: voiceLevel, __orbTranscribe: transcribe });
    }
    warmTts();
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
    // TV remotes: Back closes a card and is otherwise ignored, so it never leaves the app.
    const back = e.key === "Escape" || e.key === "Backspace" || e.key === "BrowserBack" || e.key === "GoBack";
    if (back || e.keyCode === 461 || e.keyCode === 10009) {
      e.preventDefault();
      if (card) showCard(null);
      return;
    }
    switch (e.code) {
      case "Enter":
      case "NumpadEnter":
      case "Space":
        e.preventDefault();
        onTap(); // remote OK: start, or interrupt the voice and listen
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
        stopVoice();
        showCard({ title: COPY.nextDay, body: formatTime(target) }, 2500);
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
      stopVoice();
      vadRef.current?.destroy();
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
      unlockAudio();
      unlockSpeech();
    }
    setLine({ who: "user", text: t });
    turn({ text: t, source: "voice" });
  };

  if (!mounted) return <main className="orb-root" />;

  return (
    <main className={`orb-root is-${mode}`} onPointerDown={onTap}>
      <ParticleOrb signal={signal} />

      {!started && <p className="orb-start">{COPY.start}</p>}
      {notice && <p className="orb-notice">{notice}</p>}

      {card && (
        <section className={`orb-card ${card.learned ? "is-learned" : ""}`} role="dialog" aria-label={card.title}>
          {card.learned && <span className="orb-card-num">{card.learned}</span>}
          <span className="orb-card-text">
            {card.learned && <span className="orb-card-label">{COPY.taught}</span>}
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
            placeholder={COPY.type}
            aria-label={COPY.type}
          />
        </form>
      )}
    </main>
  );
}
