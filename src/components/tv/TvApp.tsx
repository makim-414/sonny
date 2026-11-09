"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import type { AgentReply, AgentRequest, TvAction } from "@/lib/types";
import { listenOnce, type Listener } from "@/lib/voice/listen";
import { speak, splitSentences, stopSpeaking, unlockSpeech } from "@/lib/voice/speak";
import { callAgent } from "./agent-client";
import { Avatar, type AvatarMood } from "./Avatar";
import { BroadcastScreen } from "./BroadcastScreen";
import { ASSISTANT_NAME, USER_TITLE } from "./brand";
import { CHANNELS, channelForNumber, programTitle } from "./channels";
import { fetchGuide, programAt, sceneFor, surfChannels, type Guide } from "./epg-client";
import { QrCode } from "./QrCode";
import { formatDate, formatTime, useDemoClock } from "./use-demo-clock";

type Caption = { who: "assistant" | "user"; text: string; en?: string };
type Card = { title: string; body?: string; imageUrl?: string };
type Toast = { id: number; text: string; tone: "info" | "urgent" | "private" };
type Timer = { id: number; at: number; label: string; action: TvAction };

const OSD_MS = 4000;
const CAPTION_LINGER_MS = 3500;
const CARD_MS = 45_000;
const TOAST_MS = 4500;
const HEARD_EN_MS = 1500;
const NEXT_DAY_MS = 2600;
const INBOX_POLL_MS = 1000; // fast enough for the phone remote's arrow keys
const INBOX_MISSING_POLL_MS = 15_000;
const GUIDE_REFRESH_MS = 10 * 60_000; // demo-clock time
const FAST_FORWARD_MIN = 30;
const MORNING_HOUR = 8;

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

// Pairs Korean sentences with English ones when the counts match, else shows the whole English line.
function pairEnglish(ko: string[], en?: string): (string | undefined)[] {
  if (!en?.trim()) return ko.map(() => undefined);
  const enParts = splitSentences(en);
  return enParts.length === ko.length ? enParts : ko.map(() => en.trim());
}

// The agent may flag a turn it kept from the family (contract: AgentReply.private).
function isPrivateReply(reply: AgentReply): boolean {
  return (reply as AgentReply & { private?: boolean }).private === true;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const noopSubscribe = () => () => {};

function readFlag(name: string): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has(name);
}

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

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="tv-toast-icon" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function SpeakerLowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="tv-duck-icon" aria-hidden>
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M16.5 9.5a3.5 3.5 0 0 1 0 5" />
    </svg>
  );
}

export function TvApp() {
  const { now, getNow, forward, jumpTo } = useDemoClock();
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
  const [english, setEnglish] = useState(() => readFlag("en"));
  const [showQr, setShowQr] = useState(() => !readFlag("noqr"));
  const [guide, setGuide] = useState<Guide | null>(null);
  const [nextDay, setNextDay] = useState<string | null>(null);

  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const sayGenRef = useRef(0);
  const listenerRef = useRef<Listener | null>(null);
  const listeningRef = useRef(false);
  const timersRef = useRef<Timer[]>([]);
  const englishRef = useRef(english);
  const guideFetchedAt = useRef<number | null>(null);
  const idRef = useRef(1);
  const osdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    englishRef.current = english;
  }, [english]);

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

  const guideRef = useRef<Guide | null>(null);
  const stepChannel = useCallback(
    (dir: 1 | -1) => {
      const list = surfChannels(guideRef.current);
      setChannel((cur) => {
        const i = list.indexOf(cur);
        if (i < 0) return list.find((n) => (dir > 0 ? n > cur : n < cur)) ?? list[0];
        return list[(i + dir + list.length) % list.length];
      });
      flashOsd();
    },
    [flashOsd],
  );

  const toast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "info" ? TOAST_MS : TOAST_MS * 2);
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

  // ---------- program guide from the agent ----------

  const loadGuide = useCallback(async (at: Date) => {
    guideFetchedAt.current = at.getTime();
    const g = await fetchGuide(at);
    if (g) {
      guideRef.current = g;
      setGuide(g);
    }
  }, []);

  // ---------- speaking and actions ----------

  const say = useCallback(
    async (text: string, en?: string) => {
      const gen = sayGenRef.current;
      const sentences = splitSentences(text);
      const english = pairEnglish(sentences, en);
      for (let i = 0; i < sentences.length; i++) {
        if (sayGenRef.current !== gen) return;
        showCaption({ who: "assistant", text: sentences[i], en: english[i] });
        setMood("speaking");
        await speak(sentences[i]);
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
            toast("가족에게 알렸어요", a.level === "urgent" ? "urgent" : "info");
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
        if (req.source === "voice" && reply.heardEn) {
          showCaption({ who: "user", text: req.text, en: reply.heardEn });
          if (englishRef.current) await sleep(HEARD_EN_MS);
        }
        runActions(reply.actions);
        if (isPrivateReply(reply)) toast("딸에게는 안 알려요", "private");
        await say(reply.say, reply.sayEn);
      });
    },
    [enqueue, getNow, runActions, say, showCaption, toast],
  );

  // What grandma says, by mic, phone remote or the backup text box.
  const userSays = useCallback(
    (text: string) => {
      showCaption({ who: "user", text });
      ask({ text, source: "voice" });
    },
    [ask, showCaption],
  );

  // ---------- listening ----------

  const stopListening = useCallback(() => {
    listenerRef.current?.abort();
    listenerRef.current = null;
    listeningRef.current = false;
  }, []);

  const interrupt = useCallback(() => {
    sayGenRef.current++;
    stopSpeaking();
  }, []);

  const startListening = useCallback(() => {
    if (listeningRef.current) {
      listenerRef.current?.stop();
      return;
    }
    // Barge in: grandma talking wins over the TV talking.
    interrupt();
    listeningRef.current = true;
    setMood("listening");
    showCaption({ who: "user", text: "" });

    listenerRef.current = listenOnce({
      onInterim: (t) => showCaption({ who: "user", text: t }),
      onFinal: (t) => userSays(t),
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
  }, [interrupt, userSays, showCaption, toast]);

  const submitDraft = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    setTextOpen(false);
    userSays(t);
  }, [draft, userSays]);

  // ---------- OK button ----------

  const pressOk = () => {
    if (card) openCard(null);
    else flashOsd();
  };

  // ---------- next morning (hidden N key) ----------

  const goNextMorning = useCallback(() => {
    interrupt();
    stopListening();
    openCard(null);
    showCaption(null);
    setMood("idle");
    const target = getNow();
    target.setDate(target.getDate() + 1);
    target.setHours(MORNING_HOUR, 0, 0, 0);
    // Yesterday's reminders are over; do not fire them all at once.
    timersRef.current = timersRef.current.filter((t) => t.at >= target.getTime());
    setTimers(timersRef.current);
    jumpTo(target);
    setNextDay(formatDate(target));
    void loadGuide(target);
    enqueue(async () => {
      await sleep(NEXT_DAY_MS);
      setNextDay(null);
    });
    ask({ text: "morning-checkin", source: "proactive" });
  }, [interrupt, stopListening, openCard, showCaption, getNow, jumpTo, loadGuide, enqueue, ask]);

  // ---------- schedule timers and guide refresh on the demo clock ----------

  useEffect(() => {
    if (!now) return;
    const t = now.getTime();
    if (guideFetchedAt.current === null || Math.abs(t - guideFetchedAt.current) > GUIDE_REFRESH_MS) {
      void loadGuide(now);
    }
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
  }, [now, enqueue, runActions, say, loadGuide]);

  // ---------- family inbox and phone remote ----------

  const onRemote = useEffectEvent((text: string) => {
    switch (text) {
      case "key:up":
        stepChannel(1);
        return;
      case "key:down":
        stepChannel(-1);
        return;
      case "key:ok":
        pressOk();
        return;
    }
    if (text.startsWith("key:")) return;
    interrupt();
    userSays(text);
  });

  const onFamily = useEffectEvent((item: InboxItem) => {
    const text = item.text?.trim();
    if (!text) return;
    if (item.from === "remote") onRemote(text);
    else ask({ text: item.from ? `${item.from}: ${text}` : text, source: "family" });
  });

  useEffect(() => {
    let stopped = false;
    let handle: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let wait = INBOX_POLL_MS;
      try {
        const res = await fetch("/api/family/inbox", { cache: "no-store" });
        if (res.status === 404) wait = INBOX_MISSING_POLL_MS;
        else if (res.ok) for (const item of inboxItems(await res.json())) onFamily(item);
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
  }, []);

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
      case "KeyN":
        if (!e.repeat) goNextMorning();
        break;
      case "KeyF":
        if (!e.repeat) forward(FAST_FORWARD_MIN);
        break;
      case "KeyE":
        if (!e.repeat) setEnglish((v) => !v);
        break;
      case "KeyQ":
        if (!e.repeat) setShowQr((v) => !v);
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

  const local = channelForNumber(channel);
  const guideName = guide?.channels.find((c) => c.number === channel)?.name;
  const guideProgram = guide ? programAt(guide, channel, now) : undefined;
  const chName = guideName ?? local.name;
  const title = guideProgram?.title ?? (guide ? "정규 방송" : programTitle(local, now));
  const scene = guide ? sceneFor(title, chName) : local.scene;

  const nextTimer = timers[0];
  const captionVisible = caption !== null || mood === "thinking" || mood === "listening";
  const userTurn = caption?.who === "user";
  const ducked = mood !== "idle";
  const origin = window.location.origin;

  return (
    <main className={`tv-root ${ducked ? "is-ducked" : ""}`}>
      <div className="tv-picture">
        <BroadcastScreen scene={scene} />
      </div>

      <div className="tv-osd-wrap">
        <div className={`tv-osd ${osdBig ? "is-big" : ""}`}>
          <span className="tv-osd-num">{channel}</span>
          <span className="tv-osd-text">
            <span className="tv-osd-name">{chName}</span>
            <span className="tv-osd-title">{title}</span>
          </span>
        </div>
        <span className="tv-demo-tag">demo data</span>
      </div>

      {ducked && (
        <span className="tv-duck">
          <SpeakerLowIcon />
          TV 소리 줄였어요
        </span>
      )}

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
            <span key={t.id} className={`tv-toast is-${t.tone}`}>
              {t.tone === "private" && <LockIcon />}
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
          <span className="tv-demo-tag tv-card-tag">demo data</span>
        </section>
      )}

      {showQr && (
        <aside className="tv-qr">
          <figure className="tv-qr-item">
            <QrCode text={`${origin}/remote`} className="tv-qr-code" />
            <figcaption>{english ? "Phone remote" : "폰 리모컨"}</figcaption>
          </figure>
          <figure className="tv-qr-item">
            <QrCode text={`${origin}/family`} className="tv-qr-code" />
            <figcaption>{english ? "Family app" : "가족 앱"}</figcaption>
          </figure>
        </aside>
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
          {english && caption?.en && <p className="tv-caption-en">{caption.en}</p>}
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

      {nextDay && (
        <div className="tv-nextday" aria-live="polite">
          <span className="tv-nextday-title">다음 날 아침</span>
          <span className="tv-nextday-sub">
            {nextDay} · {english ? "Next morning, 8:00" : "오전 8:00"}
          </span>
        </div>
      )}
    </main>
  );
}
