"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import type { AgentRequest, TvAction } from "@/lib/types";
import { isListenSupported, listenOnce, type Listener } from "@/lib/voice/listen";
import { splitSentences, unlockSpeech } from "@/lib/voice/speak";
import { setVoiceVolume, speakSentences, stopVoice, unlockAudio, voiceLevel, warmTts } from "@/lib/tts/player";
import { createVad, type Vad } from "@/lib/voice/vad";
import { startRing, stopRing } from "@/lib/tts/ringer";
import { getSettings } from "./settings";
import { loadRoutines, useWakeLock, type Routine } from "./always-on";
import { isTurnComplete, transcribe } from "@/lib/voice/stt";
import { callAgent } from "@/components/tv/agent-client";
import { formatTime, useDemoClock } from "@/components/tv/use-demo-clock";
import { Orb } from "./Orb";
import type { OrbMode, OrbSignal } from "./ParticleOrb";

type Line = { text: string; en?: string; who: "assistant" | "user" };
type Card = { title: string; body?: string; learned?: string };
type Timer = { at: number; label: string; action: TvAction };

const CARD_MS = 6000;
const LEARNED_MS = 4500;
const TUNE_CARD_MS = 3000;
const TOAST_MS = 3500;
const RELISTEN_MS = 250;
const RETRY_MS = 1200;

// Hidden family setup: hold the top-left corner (or the remote's Menu / S key) this long.
const SETUP_HOLD_MS = 2000;

// Always-on: no conversation for this long (demo clock) and Sonny asks how she is.
// ?idle= sets it in seconds for the demo; the second try comes after min(idle, 10 min).
const IDLE_DEFAULT_MS = 3 * 60 * 60_000;
const IDLE_RETRY_MAX_MS = 10 * 60_000;
// The orb dims and drifts (screen burn-in) after this long without talking (?rest= seconds).
const REST_DEFAULT_MS = 45_000;
// Sonny's call rings this long; unanswered it counts as a missed second check-in.
const CALL_RING_MS = 30_000;

function secondsParam(name: string, fallbackMs: number): number {
  if (typeof window === "undefined") return fallbackMs;
  const v = Number(new URLSearchParams(window.location.search).get(name));
  return Number.isFinite(v) && v > 0 ? v * 1000 : fallbackMs;
}
// Smart turn: after this much silence ask /api/turn whether she finished; if not, wait up to
// SMART_MAX_EXTRA_MS more. Falls back to the fixed wait when /api/turn is down. ?wait= or ?noturn = fixed.
const SMART_PROBE_MS = 700;
const SMART_MAX_EXTRA_MS = 4000;
const VAD_RATE = 16_000;
const TURN_AUDIO_MAX_S = 8; // what the turn model looks at
const UTTERANCE_MAX_S = 30; // what the server STT gets

function joinTail(parts: Float32Array[], seconds: number): Float32Array {
  const max = seconds * VAD_RATE;
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Float32Array(Math.min(total, max));
  let w = out.length;
  for (let i = parts.length - 1; i >= 0 && w > 0; i--) {
    const p = parts[i];
    const take = Math.min(p.length, w);
    out.set(p.subarray(p.length - take), w - take);
    w -= take;
  }
  return out;
}

// If the VAD misses the end of speech, Web Speech is closed this long after the last word.
const SAFETY_EXTRA_MS = 2500;

// ?wait= / ?rate= and the family settings (sonny.* in localStorage) resolve in settings.ts.
function waitMs(): number {
  return getSettings().waitMs;
}

function speechRate(): number {
  return getSettings().rate;
}
const INBOX_POLL_MS = 1500;
const INBOX_MISSING_POLL_MS = 15_000;

const noopSubscribe = () => () => {};

// Language can be changed per phone in /setup (sonny.lang); default is APP_LANG.
const speechLang = () => (getSettings().lang === "en" ? "en-US" : "ko-KR");

// Screen words in the conversation language (brand.ts APP_LANG).
const COPY_BY = {
  en: {
    start: "Start",
    micBlocked: "Please allow the microphone",
    type: "Type instead",
    family: "Family notified",
    private: "Kept private from family",
    reminder: "Reminder set",
    channel: "Changed the channel",
    channelBody: (n: number) => `Channel ${n}`,
    taught: "What grandma taught me",
    calling: "Sonny is calling",
    callSub: "Answer to talk with Sonny",
    answer: "Answer",
    missed: "Missed call from Sonny",
    nextDay: "Next morning",
  },
  ko: {
    start: "시작",
    micBlocked: "마이크를 허용해 주세요",
    type: "말 대신 글로 적기",
    family: "가족에게 알렸어요",
    private: "딸에게는 안 알려요",
    reminder: "알림 맞춤",
    channel: "채널을 바꿨어요",
    channelBody: (n: number) => `${n}번`,
    taught: "할머니가 가르쳐 주신 것",
    calling: "Sonny 에게서 전화가 왔어요",
    callSub: "받으면 Sonny 와 이야기해요",
    answer: "받기",
    missed: "Sonny 부재중 전화",
    nextDay: "다음 날 아침",
  },
};
const copy = () => COPY_BY[getSettings().lang];

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
  const smartTurnRef = useRef(!hasFlag("wait") && !hasFlag("noturn"));
  const turnAudioRef = useRef<Float32Array[]>([]);
  const turnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenGenRef = useRef(0);
  // Always-on bookkeeping. Times for routines and idle are on the demo clock.
  const routinesRef = useRef<Routine[]>([]);
  const prevTickRef = useRef<number | null>(null);
  const lastHeardRef = useRef<number | null>(null); // demo ms of grandma's last words (or start)
  const idleTriesRef = useRef(0);
  const idleTriedAtRef = useRef(0);
  const lastActivityRef = useRef(0); // real ms, for dimming the resting orb
  const [resting, setResting] = useState(false);
  const [calling, setCalling] = useState(false);
  const answerRef = useRef<((answered: boolean) => void) | null>(null);
  const cardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setMode = useCallback((m: OrbMode) => {
    signal.current.mode = m;
    if (m === "thinking" || m === "speaking") setResting(false);
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
      // The agent may answer with nothing to say (e.g. a quiet second check-in): stay silent.
      if (!text.trim()) return;
      const gen = sayGenRef.current;
      const parts = splitSentences(text);
      const eng = getSettings().lang === "en" ? parts.map(() => undefined) : pairEnglish(parts, en);
      setMode("speaking");
      await speakSentences(parts, {
        lang: speechLang(),
        rate: speechRate(),
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
          showCard({ title: copy().channel, body: `${copy().channelBody(a.channel)}${a.reason ? ` · ${a.reason}` : ""}` }, TUNE_CARD_MS);
        } else if (a.type === "schedule") {
          const at = Date.parse(a.at);
          if (!Number.isNaN(at)) {
            timersRef.current = [...timersRef.current, { at, label: a.label, action: a.action }];
            showToast(`${copy().reminder} · ${formatTime(new Date(at))} ${a.label}`);
          }
        } else if (a.type === "notifyFamily") {
          showToast(copy().family);
        }
      }
    },
    [showCard, showToast],
  );

  const stopListening = useCallback(() => {
    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    turnTimerRef.current = null;
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
          lastActivityRef.current = Date.now();
          if (pendingRef.current === 0) listenRef.current();
        });
    },
    [stopListening],
  );

  const runTurn = useCallback(
    async (req: Omit<AgentRequest, "now">) => {
      setMode("thinking");
      lastActivityRef.current = Date.now();
      if (req.source === "voice") {
        // She talked: the idle clock and the check-in tries start over.
        lastHeardRef.current = getNow().getTime();
        idleTriesRef.current = 0;
      }
      const { reply } = await callAgent({ ...req, now: getNow().toISOString() });
      if (req.source === "voice" && reply.heardEn) setLine({ who: "user", text: req.text, en: reply.heardEn });
      runActions(reply.actions);
      if (reply.private) showToast(copy().private);
      // A happy moment (thanks, something learned): the orb hops once and brightens.
      const happy = `${reply.say} ${reply.actions.map((a) => (a.type === "showCard" ? a.title : "")).join(" ")}`;
      if (/thank|learned|taught|고마|배웠|가르쳐/i.test(happy)) signal.current.joy = 1;
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

  // The turn is over: hand the words to the agent (Web Speech) or the audio to the server STT.
  const finishTurn = useCallback(() => {
    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    turnTimerRef.current = null;
    if (serverListeningRef.current) onUtterance(joinTail(turnAudioRef.current, UTTERANCE_MAX_S));
    else listenerRef.current?.stop();
  }, [onUtterance]);

  const waitThenFinish = useCallback(
    (ms: number) => {
      if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
      turnTimerRef.current = setTimeout(finishTurn, Math.max(0, ms));
    },
    [finishTurn],
  );

  // VAD heard silence after speech. Fixed mode: the VAD already waited. Smart mode: ask the model.
  const onSpeechPause = useCallback(
    (audio: Float32Array) => {
      const listening = serverListeningRef.current || listenerRef.current !== null;
      if (!listening) return;
      turnAudioRef.current.push(audio);
      if (!smartTurnRef.current) {
        finishTurn();
        return;
      }
      const gen = listenGenRef.current;
      void isTurnComplete(joinTail(turnAudioRef.current, TURN_AUDIO_MAX_S)).then((complete) => {
        if (gen !== listenGenRef.current) return;
        if (complete === true) finishTurn();
        else if (complete === false) waitThenFinish(SMART_MAX_EXTRA_MS);
        else {
          // No turn model: switch to the fixed silence wait for good.
          smartTurnRef.current = false;
          vadRef.current?.setSilenceMs(waitMs());
          waitThenFinish(waitMs() - SMART_PROBE_MS);
        }
      });
    },
    [finishTurn, waitThenFinish],
  );

  const listen = useCallback(() => {
    if (!startedRef.current || pendingRef.current > 0 || listenerRef.current || serverListeningRef.current) return;
    listenGenRef.current++;
    turnAudioRef.current = [];
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
    // With the VAD on, recognition stays open through pauses and the VAD ends the turn.
    const vadDecides = vadRef.current !== null;
    let safety: ReturnType<typeof setTimeout> | null = null;
    const self = listenOnce({
      onInterim: (t) => {
        if (vadDecides) {
          if (safety) clearTimeout(safety);
          safety = setTimeout(() => self?.stop(), waitMs() + SAFETY_EXTRA_MS);
        }
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
          setNotice(copy().micBlocked);
          setTyping(true);
        } else if (code === "service-not-allowed" || code === "network" || code === "language-not-supported") {
          // The recognizer itself is unavailable (iPhone home-screen app, offline): use the server STT.
          webSpeechOkRef.current = false;
        }
      },
      onEnd: () => {
        if (safety) clearTimeout(safety);
        if (listenerRef.current === self) listenerRef.current = null;
        if (heard || pendingRef.current > 0 || !startedRef.current) return;
        // Silence or a hiccup: keep listening, like an open phone line.
        setTimeout(() => listenRef.current(), listenOkRef.current ? RELISTEN_MS : RETRY_MS);
      },
    }, speechLang(), { continuous: vadDecides });
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
    lastActivityRef.current = Date.now();
    unlockAudio();
    unlockSpeech();
    setStarted(true);
    turn({ text: "morning-checkin", source: "proactive" });
    lastHeardRef.current = getNow().getTime();
    void loadRoutines().then((r) => {
      routinesRef.current = r;
    });
    // Silero VAD decides when a turn ends (0.7 s of silence), then Web Speech hands over the words.
    if (!hasFlag("novad")) {
      void createVad({
        onSpeechStart: () => {
          signal.current.pulse = 1;
          // She kept talking: cancel a pending end of turn.
          if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
          turnTimerRef.current = null;
        },
        onSpeechEnd: (audio) => onSpeechPause(audio),
        onLevel: (lv) => {
          if (signal.current.mode === "listening") signal.current.pulse = Math.max(signal.current.pulse, lv);
        },
      }, { redemptionMs: smartTurnRef.current ? SMART_PROBE_MS : waitMs() }).then((v) => {
        vadRef.current = v;
        if (!v || pendingRef.current > 0) return;
        if (listenerRef.current) v.start();
        else listenRef.current(); // was waiting for the VAD to use the server STT
      });
    }
  }, [turn, onSpeechPause, getNow]);

  // A tap after start interrupts the voice, closes a card and goes back to listening.
  const onTap = () => {
    if (answerRef.current) return; // while ringing only the Answer button (or OK) answers
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
    setVoiceVolume(getSettings().volume);
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

  // ---------- always on: routines and idle check-ins ----------

  // Sonny speaks first by calling: a full-screen "Sonny is calling" with a ringtone and one
  // big Answer button. Answered: the agent's line plays and the talk goes on. Not answered in
  // 30 s: missed, sent as the second idle check-in; the agent decides on a family alert.
  const placeCall = useCallback(
    (text: string) => {
      enqueue(async () => {
        setMode("idle");
        setCalling(true);
        startRing();
        const answered = await new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => resolve(false), secondsParam("ring", CALL_RING_MS));
          answerRef.current = (yes) => {
            clearTimeout(timer);
            resolve(yes);
          };
        });
        answerRef.current = null;
        stopRing();
        setCalling(false);
        unlockAudio();
        if (answered) {
          lastHeardRef.current = getNow().getTime();
          await runTurn({ text, source: "proactive" });
        } else {
          showToast(copy().missed);
          idleTriesRef.current = 2;
          await runTurn({ text: "idle-checkin:2", source: "proactive" });
        }
      });
    },
    [enqueue, getNow, runTurn, setMode, showToast],
  );

  const idleCheckin = useCallback(
    (attempt: 1 | 2) => {
      idleTriesRef.current = attempt;
      idleTriedAtRef.current = getNow().getTime();
      placeCall(attempt === 1 ? "idle-checkin" : "idle-checkin:2");
    },
    [getNow, placeCall],
  );

  useEffect(() => {
    if (!now || !startedRef.current) return;
    const t = now.getTime();
    // Never talk over a running turn. Keep the last tick so a routine passed meanwhile still fires after.
    if (pendingRef.current > 0) return;
    const prev = prevTickRef.current ?? t;
    prevTickRef.current = t;

    // Routines fire once when the clock passes their time (also after F jumps).
    for (const r of routinesRef.current) {
      const at = new Date(now);
      at.setHours(r.hour, r.minute, 0, 0);
      if (prev < at.getTime() && at.getTime() <= t) {
        placeCall(`routine:${r.name}`);
        return;
      }
    }

    const idleMs = secondsParam("idle", IDLE_DEFAULT_MS);
    const heard = lastHeardRef.current ?? t;
    if (idleTriesRef.current === 0 && t - heard >= idleMs) idleCheckin(1);
    else if (idleTriesRef.current === 1 && t - idleTriedAtRef.current >= Math.min(idleMs, IDLE_RETRY_MAX_MS)) idleCheckin(2);
  }, [now, placeCall, idleCheckin]);

  useWakeLock(started);

  // Nobody has talked for a while: dim the orb and let it drift (screen burn-in).
  useEffect(() => {
    if (!started) return;
    const restMs = secondsParam("rest", REST_DEFAULT_MS);
    const id = setInterval(() => {
      const quiet = signal.current.mode === "listening" || signal.current.mode === "idle";
      setResting(quiet && Date.now() - lastActivityRef.current > restMs);
    }, 1000);
    return () => clearInterval(id);
  }, [started]);

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
        if (answerRef.current) answerRef.current(true); // remote OK answers Sonny's call
        else onTap(); // remote OK: start, or interrupt the voice and listen
        break;
      case "KeyC":
        if (startedRef.current && !answerRef.current) idleCheckin(1); // demo: Sonny calls now
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
      case "KeyI":
        if (startedRef.current && !answerRef.current) idleCheckin(1);
        break;
      case "KeyN": {
        const target = getNow();
        target.setDate(target.getDate() + 1);
        target.setHours(8, 0, 0, 0);
        timersRef.current = timersRef.current.filter((x) => x.at >= target.getTime());
        jumpTo(target);
        prevTickRef.current = target.getTime(); // the jump itself is not a routine crossing
        lastHeardRef.current = target.getTime();
        idleTriesRef.current = 0;
        sayGenRef.current++;
        stopVoice();
        showCard({ title: copy().nextDay, body: formatTime(target) }, 2500);
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

  const router = useRouter();
  const goToSetup = useCallback(() => router.push("/setup"), [router]);

  // Remote: hold Menu or S for 2 s to open the hidden setup. A short press does nothing.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const isSetupKey = (e: KeyboardEvent) => e.key === "ContextMenu" || e.key === "Menu" || e.code === "KeyS";
    const down = (e: KeyboardEvent) => {
      if (!isSetupKey(e) || e.repeat || timer || e.target instanceof HTMLInputElement) return;
      timer = setTimeout(goToSetup, SETUP_HOLD_MS);
    };
    const up = (e: KeyboardEvent) => {
      if (!isSetupKey(e) || !timer) return;
      clearTimeout(timer);
      timer = null;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [goToSetup]);

  // Touch: hold the invisible top-left corner for 2 s. Taps there are swallowed.
  const cornerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cornerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (cornerTimer.current) clearTimeout(cornerTimer.current);
    cornerTimer.current = setTimeout(goToSetup, SETUP_HOLD_MS);
  };
  const cornerUp = () => {
    if (cornerTimer.current) clearTimeout(cornerTimer.current);
    cornerTimer.current = null;
  };

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

  // Design options for the owner: ?eyes=1 adds two blinking dots, ?look=character shows a
  // plain warm round character instead of particles. Default is the particle orb only.
  const params = new URLSearchParams(window.location.search);
  const look = params.get("look") === "character" ? "character" : params.get("eyes") === "1" ? "eyes" : "orb";

  return (
    <main
      className={`orb-root is-${mode} ${resting ? "is-resting" : ""}`}
      onPointerDown={onTap}
      style={{ "--text-scale": getSettings().textScale } as React.CSSProperties}
    >
      <div
        className="orb-corner"
        aria-hidden
        onPointerDown={cornerDown}
        onPointerUp={cornerUp}
        onPointerLeave={cornerUp}
        onPointerCancel={cornerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      {look !== "character" && <Orb signal={signal} />}
      {look === "character" && <span className={`orb-character is-${mode}`} aria-hidden />}
      {(look === "eyes" || look === "character") && (
        <span className={`orb-eyes is-${mode} ${look === "character" ? "on-character" : ""}`} aria-hidden>
          <i />
          <i />
        </span>
      )}

      {!started && (
        <button
          type="button"
          className="orb-start"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={start}
          aria-label={copy().start}
        >
          {copy().start}
        </button>
      )}
      {notice && <p className="orb-notice">{notice}</p>}

      {card && (
        <section className={`orb-card ${card.learned ? "is-learned" : ""}`} role="dialog" aria-label={card.title}>
          {card.learned && <span className="orb-card-num">{card.learned}</span>}
          <span className="orb-card-text">
            {card.learned && <span className="orb-card-label">{copy().taught}</span>}
            <h2 className="orb-card-title">{card.title}</h2>
            {card.body && <p className="orb-card-body">{card.body}</p>}
          </span>
        </section>
      )}

      {toast && <p className="orb-toast">{toast}</p>}

      {calling && (
        <section className="orb-call" role="dialog" aria-modal="true" aria-label={copy().calling} onPointerDown={(e) => e.stopPropagation()}>
          <div className="orb-call-top">
            <span className="orb-call-orb" aria-hidden />
            <h2 className="orb-call-title">{copy().calling}</h2>
            <p className="orb-call-sub">{copy().callSub}</p>
          </div>
          <button type="button" className="orb-call-answer" onClick={() => answerRef.current?.(true)}>
            <svg viewBox="0 0 24 24" className="orb-call-icon" aria-hidden>
              <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
            </svg>
            <span>{copy().answer}</span>
          </button>
        </section>
      )}

      {getSettings().captions && (
        <div className="orb-line" aria-live="polite">
          {line && <p className={`orb-line-ko ${line.who === "user" ? "is-user" : ""}`}>{line.text}</p>}
          {english && line?.en && <p className="orb-line-en">{line.en}</p>}
        </div>
      )}

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
            placeholder={copy().type}
            aria-label={copy().type}
          />
        </form>
      )}
    </main>
  );
}
