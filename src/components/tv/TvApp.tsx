"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import type { AgentRequest, TvAction } from "@/lib/types";
import { listenOnce, type Listener } from "@/lib/voice/listen";
import { speak, splitSentences, stopSpeaking, unlockSpeech } from "@/lib/voice/speak";
import { callAgent } from "./agent-client";
import { Avatar, type AvatarMood } from "./Avatar";
import { BroadcastScreen } from "./BroadcastScreen";
import { ASSISTANT_NAME, USER_TITLE } from "./brand";
import { CHANNELS, channelForNumber, findChannelIndex, programTitle } from "./channels";
import { formatDate, formatTime, useDemoClock } from "./use-demo-clock";

type Caption = { who: "assistant" | "user"; text: string };
type Card = { title: string; body?: string; imageUrl?: string };
type Toast = { id: number; text: string; strong?: boolean };
type Timer = { id: number; at: number; label: string; action: TvAction };

const OSD_MS = 4000;
const CAPTION_LINGER_MS = 3500;
const CARD_MS = 45_000;
const TOAST_MS = 4500;
const INBOX_POLL_MS = 3000;
const INBOX_MISSING_POLL_MS = 15_000;
const FAST_FORWARD_MIN = 30;

type InboxItem = { id?: string; from?: string; text?: string };

function inboxItems(json: unknown): InboxItem[] {
  if (Array.isArray(json)) return json as InboxItem[];
  if (json && typeof json === "object") {
    const o = json as { items?: unknown; inbox?: unknown; messages?: unknown };
    const list = o.items ?? o.inbox ?? o.messages;
    if (Array.isArray(list)) return list as InboxItem[];
  }
  return [];
}

// Words spoken when a scheduled action comes due.
function spokenForTimer(t: Timer): string {
  const a = t.action;
  if (a.type === "showCard") return [t.label, a.body].filter(Boolean).join(". ");
  if (a.type === "tune") return `${t.label}. ${a.channel}번으로 바꿀게요.`;
  return t.label;
}

const noopSubscribe = () => () => {};

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="tv-mic-icon" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <line x1="12" y1="17.5" x2="12" y2="21" />
      <line x1="8.5" y1="21" x2="15.5" y2="21" />
    </svg>
  );
}

export function TvApp() {
  const { now, getNow, forward } = useDemoClock();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [channel, setChannel] = useState(CHANNELS[0].number);
  const [osdBig, setOsdBig] = useState(true);
  const [mood, setMood] = useState<AvatarMood>("idle");
  const [caption, setCaption] = useState<Caption | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [textOpen, setTextOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const sayGenRef = useRef(0);
  const listenerRef = useRef<Listener | null>(null);
  const listeningRef = useRef(false);
  const timersRef = useRef<Timer[]>([]);
  const idRef = useRef(1);
  const osdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ---------- small UI helpers ----------

  const flashOsd = useCallback(() => {
    setOsdBig(true);
    if (osdTimer.current) clearTimeout(osdTimer.current);
    osdTimer.current = setTimeout(() => setOsdBig(false), OSD_MS);
  }, []);

  useEffect(() => {
    osdTimer.current = setTimeout(() => setOsdBig(false), OSD_MS);
  }, []);

  const tuneTo = useCallback(
    (n: number) => {
      setChannel(n);
      flashOsd();
    },
    [flashOsd],
  );

  const stepChannel = useCallback(
    (dir: 1 | -1) => {
      setChannel((cur) => {
        const i = findChannelIndex(cur);
        const base = i < 0 ? 0 : i;
        return CHANNELS[(base + dir + CHANNELS.length) % CHANNELS.length].number;
      });
      flashOsd();
    },
    [flashOsd],
  );

  const toast = useCallback((text: string, strong = false) => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, text, strong }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), strong ? TOAST_MS * 2 : TOAST_MS);
  }, []);

  const showCaption = useCallback((c: Caption | null) => {
    if (captionTimer.current) clearTimeout(captionTimer.current);
    setCaption(c);
  }, []);

  const lingerCaption = useCallback(() => {
    if (captionTimer.current) clearTimeout(captionTimer.current);
    captionTimer.current = setTimeout(() => setCaption(null), CAPTION_LINGER_MS);
  }, []);

  const openCard = useCallback((c: Card | null) => {
    if (cardTimer.current) clearTimeout(cardTimer.current);
    setCard(c);
    if (c) cardTimer.current = setTimeout(() => setCard(null), CARD_MS);
  }, []);

  // ---------- speaking and actions ----------

  const say = useCallback(
    async (text: string) => {
      const gen = sayGenRef.current;
      for (const sentence of splitSentences(text)) {
        if (sayGenRef.current !== gen) return;
        showCaption({ who: "assistant", text: sentence });
        setMood("speaking");
        await speak(sentence);
      }
      if (sayGenRef.current !== gen) return;
      setMood("idle");
      lingerCaption();
    },
    [showCaption, lingerCaption],
  );

  const addTimer = useCallback((t: Timer) => {
    timersRef.current = [...timersRef.current, t].sort((a, b) => a.at - b.at);
    setTimers(timersRef.current);
  }, []);

  const runActions = useCallback(
    (actions: TvAction[]) => {
      for (const a of actions) {
        switch (a.type) {
          case "tune":
            tuneTo(a.channel);
            break;
          case "showCard":
            openCard({ title: a.title, body: a.body, imageUrl: a.imageUrl });
            break;
          case "schedule": {
            const at = new Date(a.at).getTime();
            if (Number.isNaN(at)) break;
            addTimer({ id: idRef.current++, at, label: a.label, action: a.action });
            toast(`알림을 맞췄어요 · ${formatTime(new Date(at))} ${a.label}`);
            break;
          }
          case "notifyFamily":
            toast("가족에게 알렸어요", a.level === "urgent");
            break;
        }
      }
    },
    [tuneTo, openCard, addTimer, toast],
  );

  const enqueue = useCallback((job: () => Promise<void>) => {
    queueRef.current = queueRef.current.then(job).catch((err) => console.warn("[tv] job failed", err));
  }, []);

  const ask = useCallback(
    (req: Omit<AgentRequest, "now">) => {
      enqueue(async () => {
        setMood("thinking");
        const { reply } = await callAgent({ ...req, now: getNow().toISOString() });
        runActions(reply.actions);
        await say(reply.say);
      });
    },
    [enqueue, getNow, runActions, say],
  );

  // ---------- listening ----------

  const stopListening = useCallback(() => {
    listenerRef.current?.abort();
    listenerRef.current = null;
    listeningRef.current = false;
  }, []);

  const startListening = useCallback(() => {
    if (listeningRef.current) {
      listenerRef.current?.stop();
      return;
    }
    // Barge in: grandma talking wins over the TV talking.
    sayGenRef.current++;
    stopSpeaking();
    listeningRef.current = true;
    setMood("listening");
    showCaption({ who: "user", text: "" });

    listenerRef.current = listenOnce({
      onInterim: (t) => showCaption({ who: "user", text: t }),
      onFinal: (t) => {
        showCaption({ who: "user", text: t });
        ask({ text: t, source: "voice" });
      },
      onError: (code) => {
        if (code === "no-speech" || code === "aborted") return;
        console.warn("[tv] listen error", code);
        setTextOpen(true);
        toast("마이크가 안 돼요. 글로 적어 주세요");
      },
      onEnd: () => {
        listeningRef.current = false;
        listenerRef.current = null;
        setMood((m) => (m === "listening" ? "idle" : m));
        setCaption((c) => (c && c.who === "user" && !c.text ? null : c));
      },
    });
    if (!listenerRef.current) {
      listeningRef.current = false;
      setMood("idle");
      showCaption(null);
    }
  }, [ask, showCaption, toast]);

  const submitDraft = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    setTextOpen(false);
    showCaption({ who: "user", text: t });
    ask({ text: t, source: "voice" });
  }, [draft, ask, showCaption]);

  // ---------- OK button ----------

  const pressOk = useCallback(() => {
    if (card) {
      openCard(null);
      return;
    }
    flashOsd();
  }, [card, openCard, flashOsd]);

  // ---------- schedule timers on the demo clock ----------

  useEffect(() => {
    if (!now) return;
    const t = now.getTime();
    const due = timersRef.current.filter((x) => x.at <= t);
    if (due.length === 0) return;
    timersRef.current = timersRef.current.filter((x) => x.at > t);
    setTimers(timersRef.current);
    for (const timer of due) {
      enqueue(async () => {
        runActions([timer.action]);
        await say(spokenForTimer(timer));
      });
    }
  }, [now, enqueue, runActions, say]);

  // ---------- family inbox polling ----------

  useEffect(() => {
    let stopped = false;
    let handle: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let wait = INBOX_POLL_MS;
      try {
        const res = await fetch("/api/family/inbox", { cache: "no-store" });
        if (res.status === 404) wait = INBOX_MISSING_POLL_MS;
        else if (res.ok) {
          for (const item of inboxItems(await res.json())) {
            const text = item.text?.trim();
            if (!text) continue;
            ask({ text: item.from ? `${item.from}: ${text}` : text, source: "family" });
          }
        }
      } catch {
        // Quietly ignore until the family API exists.
      }
      if (!stopped) handle = setTimeout(poll, wait);
    };
    handle = setTimeout(poll, INBOX_POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(handle);
    };
  }, [ask]);

  // ---------- remote control keys ----------

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (!unlockedRef.current) {
      unlockedRef.current = true;
      unlockSpeech();
    }
    const inInput = e.target instanceof HTMLInputElement;
    if (inInput) {
      if (e.key === "Escape") {
        setTextOpen(false);
        inputRef.current?.blur();
      }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.code) {
      case "ArrowUp":
        e.preventDefault();
        stepChannel(1);
        break;
      case "ArrowDown":
        e.preventDefault();
        stepChannel(-1);
        break;
      case "Enter":
      case "NumpadEnter":
        e.preventDefault();
        pressOk();
        break;
      case "Escape":
        openCard(null);
        break;
      case "KeyM":
        if (!e.repeat) startListening();
        break;
      case "KeyP":
        if (!e.repeat) ask({ text: "morning-checkin", source: "proactive" });
        break;
      case "KeyF":
        if (!e.repeat) forward(FAST_FORWARD_MIN);
        break;
      case "KeyT":
        e.preventDefault();
        setTextOpen((o) => !o);
        break;
    }
  });

  useEffect(() => {
    const onPointer = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      unlockSpeech();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  useEffect(() => {
    if (textOpen) inputRef.current?.focus();
  }, [textOpen]);

  useEffect(() => () => stopListening(), [stopListening]);

  // ---------- render ----------

  if (!mounted || !now) return <main className="tv-root" />;

  const ch = channelForNumber(channel);
  const title = programTitle(ch, now);
  const nextTimer = timers[0];
  const captionVisible = caption !== null || mood === "thinking" || mood === "listening";
  const userTurn = caption?.who === "user";

  return (
    <main className="tv-root">
      <BroadcastScreen scene={ch.scene} />

      <div className={`tv-osd ${osdBig ? "is-big" : ""}`}>
        <span className="tv-osd-num">{ch.number}</span>
        <span className="tv-osd-text">
          <span className="tv-osd-name">{ch.name}</span>
          <span className="tv-osd-title">{title}</span>
        </span>
      </div>

      <div className="tv-clock">
        <span className="tv-clock-time">{formatTime(now)}</span>
        <span className="tv-clock-date">{formatDate(now)}</span>
        {nextTimer && (
          <span className="tv-clock-next">
            {formatTime(new Date(nextTimer.at))} · {nextTimer.label}
          </span>
        )}
        <span className="tv-toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <span key={t.id} className={`tv-toast ${t.strong ? "is-strong" : ""}`}>
              {t.text}
            </span>
          ))}
        </span>
      </div>

      {card && (
        <section className="tv-card" role="dialog" aria-label={card.title}>
          {card.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="tv-card-img" src={card.imageUrl} alt="" />
          )}
          <h2 className="tv-card-title">{card.title}</h2>
          {card.body && <p className="tv-card-body">{card.body}</p>}
          <p className="tv-card-hint">OK 버튼을 누르면 닫혀요</p>
        </section>
      )}

      <section className={`tv-caption ${captionVisible ? "is-open" : ""} ${userTurn ? "is-user" : ""}`} aria-live="polite">
        <Avatar mood={mood} />
        <div className="tv-caption-bubble">
          <span className="tv-caption-who">{userTurn ? `${USER_TITLE} 말씀` : ASSISTANT_NAME}</span>
          <p className="tv-caption-text">
            {mood === "listening" && !caption?.text
              ? "듣고 있어요. 말씀하세요"
              : caption?.text || (mood === "thinking" ? "잠깐만요" : "")}
          </p>
        </div>
      </section>

      <button
        type="button"
        className={`tv-mic ${mood === "listening" ? "is-on" : ""}`}
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={startListening}
        aria-label="말하기"
      >
        <MicIcon />
        <span className="tv-mic-label">{mood === "listening" ? "듣는 중" : "말하기"}</span>
      </button>

      {textOpen && (
        <form
          className="tv-type"
          onSubmit={(e) => {
            e.preventDefault();
            submitDraft();
          }}
        >
          <input
            ref={inputRef}
            className="tv-type-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="할머니 말씀을 글로 적어 주세요"
            aria-label="말 대신 글로 입력"
          />
        </form>
      )}
    </main>
  );
}
