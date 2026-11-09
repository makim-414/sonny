"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GuardianCall } from "@/lib/types";
import { T } from "./strings";

// Full-screen "Sonny is calling". Every family phone polls /api/family/ring about once a
// second, so a call rings on all of them at once. The first person to answer handles it
// (the server keeps a lock); everyone else sees "Daniel booked it. Grandma's ride is on the way."

const POLL_MS = 800; // visible tab
const HIDDEN_POLL_MS = 3000; // background tab: keep the server load low
const NAME_KEY = "sonny.familyName";

type Phase = "ringing" | "speaking" | "deciding" | "done";
type RingCall = Pick<GuardianCall, "id" | "at" | "reason" | "script" | "amount" | "status">;
type Handled = { id: string; by: string; status: string };

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

function makeRecognition(): Recognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

// One AudioContext for the page. iOS Safari only lets it make sound after a tap, so the
// join card calls unlockAudio() from its button; later rings reuse the unlocked context.
const W = typeof window === "undefined" ? null : (window as unknown as { __sonnyAudio?: AudioContext });

export function unlockAudio() {
  if (!W) return;
  try {
    W.__sonnyAudio ??= new AudioContext();
    const ctx = W.__sonnyAudio;
    void ctx.resume().catch(() => undefined);
    // Play one silent buffer inside the tap: this is what unlocks audio on iOS.
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
    // HTML audio and speech too, so the Kokoro voice and the fallback voice may play later.
    const a = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=");
    void a.play().catch(() => undefined);
    if ("speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  } catch {
    // no audio on this device: the screen still rings visually
  }
}

function startRing(): () => void {
  if (!W) return () => undefined;
  let ctx: AudioContext;
  try {
    ctx = W.__sonnyAudio ??= new AudioContext();
  } catch {
    return () => undefined;
  }
  const beep = () => {
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    for (const [freq, start] of [
      [880, 0],
      [660, 0.18],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + start);
      gain.gain.exponentialRampToValueAtTime(0.2, t + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + start);
      osc.stop(t + start + 0.18);
    }
    // Android buzzes; iOS has no vibration API. Only after a tap, or Chrome logs an error.
    const active = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive;
    if (active && "vibrate" in navigator) navigator.vibrate([300, 150, 300]);
  };
  beep();
  const id = setInterval(beep, 1600);
  return () => clearInterval(id);
}

async function speak(text: string): Promise<void> {
  try {
    // Kokoro can take many seconds on a cold server; mom should not stare at a silent call.
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const url = URL.createObjectURL(await res.blob());
    await new Promise<void>((resolve) => {
      const a = new Audio(url);
      a.onended = () => resolve();
      a.onerror = () => resolve();
      void a.play().catch(() => resolve());
    });
    URL.revokeObjectURL(url);
  } catch {
    await new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = T.locale;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }
}

function myName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

export default function IncomingCall() {
  const [call, setCall] = useState<RingCall | null>(null);
  const [phase, setPhase] = useState<Phase>("ringing");
  const [result, setResult] = useState("");
  const [heard, setHeard] = useState("");
  const busy = useRef(false);
  const callRef = useRef<RingCall | null>(null);
  const phaseRef = useRef<Phase>("ringing");
  const dismissed = useRef(new Set<string>());
  const stopRing = useRef<(() => void) | null>(null);
  const recog = useRef<Recognition | null>(null);

  useEffect(() => {
    callRef.current = call;
  }, [call]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const close = useCallback((text: string) => {
    recog.current?.abort();
    stopRing.current?.();
    setResult(text);
    setPhase("done");
    setTimeout(() => {
      busy.current = false;
      setCall(null);
    }, 2600);
  }, []);

  // Warm the Kokoro voice so the first call does not wait for the model.
  useEffect(() => {
    void fetch("/api/tts", { cache: "no-store" }).catch(() => undefined);
  }, []);

  // Fast, light poll. Rings when a new call appears; when someone else answers the call
  // on screen, shows who did and closes.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await fetch("/api/family/ring", { cache: "no-store" });
        if (res.ok && !stopped) {
          const { ringing, handled } = (await res.json()) as { ringing: RingCall | null; handled: Handled[] };
          const cur = callRef.current;
          if (cur && !busy.current) {
            const h = handled.find((x) => x.id === cur.id);
            if (h) {
              busy.current = true;
              close(T.handledText(h.by, h.status, cur.reason));
            } else if (phaseRef.current === "ringing" && ringing?.id !== cur.id) {
              // Still ringing here but no longer the live call (replaced or withdrawn).
              stopRing.current?.();
              setCall(ringing && !dismissed.current.has(ringing.id) ? ringing : null);
            }
          } else if (!cur && ringing && !dismissed.current.has(ringing.id)) {
            setPhase("ringing");
            setResult("");
            setHeard("");
            setCall(ringing);
          }
        }
      } catch {
        // try again next tick
      }
      if (!stopped) timer = setTimeout(poll, document.hidden ? HIDDEN_POLL_MS : POLL_MS);
    };
    timer = setTimeout(poll, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [close]);

  // Ring while ringing.
  useEffect(() => {
    if (!call || phase !== "ringing") return;
    stopRing.current = startRing();
    return () => {
      stopRing.current?.();
      stopRing.current = null;
    };
  }, [call, phase]);

  const finish = useCallback(
    async (decision: "approve" | "decline" | "missed") => {
      const c = callRef.current;
      if (!c || busy.current) return;
      busy.current = true;
      recog.current?.abort();
      // A nudge has nothing to decline: "no" means "remind me at 7 PM".
      const nudge = c.reason === "nudge";
      const d = nudge && decision === "decline" ? "missed" : decision;
      const done = nudge ? T.nudgeDone : c.reason === "struggle" ? T.struggleDone : T.callDone;
      try {
        const res = await fetch("/api/family/calls", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: c.id, decision: d, name: myName() }),
        });
        const json = (await res.json().catch(() => ({}))) as { call?: GuardianCall; by?: string | null; status?: string };
        if (res.status === 409) {
          // Someone else got there first.
          close(T.handledText(json.by ?? T.joinGuest, json.status ?? "approved", c.reason));
          return;
        }
        const status = json.call?.status ?? (d === "approve" ? "approved" : d === "decline" ? "declined" : "missed");
        close(done(status));
      } catch {
        close(done("missed"));
      }
    },
    [close],
  );

  // Ring-screen Decline only silences this phone; the call keeps ringing for the others.
  const silence = () => {
    const c = callRef.current;
    if (!c) return;
    dismissed.current.add(c.id);
    stopRing.current?.();
    setCall(null);
  };

  const listen = useCallback(() => {
    const r = makeRecognition();
    if (!r) return;
    recog.current = r;
    r.lang = T.locale;
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      const said = Array.from(e.results)
        .map((x) => x[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setHeard(said);
      if (T.yesWords.test(said)) void finish("approve");
      else if (T.noWords.test(said)) void finish("decline");
    };
    r.onerror = () => undefined;
    r.onend = () => {
      recog.current = null;
    };
    try {
      r.start();
    } catch {
      // mic blocked: buttons still work
    }
  }, [finish]);

  const answer = async () => {
    const c = callRef.current;
    if (!c) return;
    stopRing.current?.();
    setPhase("speaking");
    await speak(c.script);
    if (callRef.current?.id !== c.id || busy.current) return; // someone else answered meanwhile
    setPhase("deciding");
    listen();
  };

  if (!call) return null;

  const nudge = call.reason === "nudge";
  const struggle = call.reason === "struggle";
  const dollars = new Intl.NumberFormat(T.locale, { style: "currency", currency: "USD" }).format(call.amount / 100);
  const sub = nudge ? T.nudgeSub : struggle ? T.struggleSub : `${T.callSub} · ${dollars}`;
  return (
    <div className="fa-call" role="dialog" aria-modal="true" aria-label={T.callTitle}>
      <div className="fa-call-top">
        <span className={phase === "ringing" ? "fa-call-orb is-ringing" : "fa-call-orb"} aria-hidden />
        <h2 className="fa-call-title">{T.callTitle}</h2>
        <p className="fa-call-sub">{sub}</p>
      </div>

      {phase !== "ringing" && <p className="fa-call-script">{call.script}</p>}
      {phase === "speaking" && <p className="fa-call-hint">{T.speaking}</p>}
      {phase === "deciding" && <p className="fa-call-hint">{heard ? `"${heard}"` : T.listening}</p>}
      {phase === "done" && <p className="fa-call-result">{result}</p>}

      <div className="fa-call-actions">
        {phase === "ringing" && (
          <>
            <button className="fa-call-btn is-no" onClick={silence}>
              {T.notNow}
            </button>
            <button className="fa-call-btn is-yes" onClick={() => void answer()}>
              {T.answer}
            </button>
          </>
        )}
        {(phase === "deciding" || phase === "speaking") && nudge && (
          <>
            <button className="fa-call-btn is-later" onClick={() => void finish("missed")}>
              {T.nudgeLater}
            </button>
            <button className="fa-call-btn is-yes" onClick={() => void finish("approve")}>
              {T.nudgeCall}
            </button>
          </>
        )}
        {(phase === "deciding" || phase === "speaking") && struggle && (
          <>
            <button className="fa-call-btn is-later" onClick={() => void finish("decline")}>
              {T.struggleCallHer}
            </button>
            <button className="fa-call-btn is-yes" onClick={() => void finish("approve")}>
              {T.struggleBook}
            </button>
          </>
        )}
        {(phase === "deciding" || phase === "speaking") && !nudge && !struggle && (
          <>
            <button className="fa-call-btn is-no" onClick={() => void finish("decline")}>
              {T.callDecline}
            </button>
            <button className="fa-call-btn is-yes" onClick={() => void finish("approve")}>
              {T.callApprove}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
