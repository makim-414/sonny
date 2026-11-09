"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GuardianCall } from "@/lib/types";
import { T } from "./strings";

// Full-screen "Sonny is calling" for mom. Polls for ringing calls, rings, reads the
// script in the Kokoro voice (/api/tts), then takes Approve / Decline by tap or by voice.

const POLL_MS = 2000;

type Phase = "ringing" | "speaking" | "deciding" | "done";

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

// A soft two-tone ring with Web Audio. Silent if the browser has not allowed sound yet.
function startRing(): () => void {
  let ctx: AudioContext | null = null;
  try {
    ctx = new AudioContext();
  } catch {
    return () => undefined;
  }
  const audio = ctx;
  const beep = () => {
    if (audio.state === "suspended") void audio.resume().catch(() => undefined);
    const t = audio.currentTime;
    for (const [freq, start] of [
      [880, 0],
      [660, 0.18],
    ] as const) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + start);
      gain.gain.exponentialRampToValueAtTime(0.15, t + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.16);
      osc.connect(gain).connect(audio.destination);
      osc.start(t + start);
      osc.stop(t + start + 0.18);
    }
  };
  beep();
  const id = setInterval(beep, 1600);
  return () => {
    clearInterval(id);
    void audio.close().catch(() => undefined);
  };
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
    // Fallback: the browser's own voice.
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

export default function IncomingCall() {
  const [call, setCall] = useState<GuardianCall | null>(null);
  const [phase, setPhase] = useState<Phase>("ringing");
  const [result, setResult] = useState<string>("");
  const [heard, setHeard] = useState("");
  const busy = useRef(false);
  const stopRing = useRef<(() => void) | null>(null);
  const recog = useRef<Recognition | null>(null);

  // Load the Kokoro voice early so the first call does not wait for the model.
  useEffect(() => {
    void fetch("/api/tts", { cache: "no-store" }).catch(() => undefined);
  }, []);

  // Poll for a ringing call while none is on screen.
  useEffect(() => {
    if (call) return;
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/family/calls", { cache: "no-store" });
        if (res.ok) {
          const { ringing } = (await res.json()) as { ringing: GuardianCall[] };
          if (!stopped && ringing[0]) {
            setPhase("ringing");
            setResult("");
            setHeard("");
            setCall(ringing[0]);
          }
        }
      } catch {
        // try again next tick
      }
    };
    const first = setTimeout(poll, 0);
    const id = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [call]);

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
      if (!call || busy.current) return;
      busy.current = true;
      recog.current?.abort();
      // A nudge has nothing to decline: "no" means "remind me at 7 PM".
      const nudge = call.reason === "nudge";
      const d = nudge && decision === "decline" ? "missed" : decision;
      const done = nudge ? T.nudgeDone : call.reason === "struggle" ? T.struggleDone : T.callDone;
      try {
        const res = await fetch("/api/family/calls", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: call.id, decision: d }),
        });
        const json = (await res.json().catch(() => ({}))) as { call?: GuardianCall };
        const status = json.call?.status ?? (d === "approve" ? "approved" : d === "decline" ? "declined" : "missed");
        setResult(done(status));
      } catch {
        setResult(done("missed"));
      }
      setPhase("done");
      setTimeout(() => {
        busy.current = false;
        setCall(null);
      }, 2200);
    },
    [call],
  );

  // Listen for "yes" / "no" while deciding, if the browser can.
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
      // "No, don't approve" must decline, so check no first.
      if (T.noWords.test(said)) void finish("decline");
      else if (T.yesWords.test(said)) void finish("approve");
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
    if (!call) return;
    stopRing.current?.();
    setPhase("speaking");
    await speak(call.script);
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
            <button className="fa-call-btn is-no" onClick={() => void finish("missed")}>
              {T.notNow}
            </button>
            <button className="fa-call-btn is-yes" onClick={() => void answer()}>
              {T.answer}
            </button>
          </>
        )}
        {(phase === "deciding" || phase === "speaking") && nudge && (
          <>
            {/* In a real deployment this is a tel: link to grandma's number; the demo leaves it out. */}
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
