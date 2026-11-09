"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import LightPage from "@/components/family/LightPage";
import { APP_LANG } from "@/lib/brand";
import { checkPin, disconnectDevice } from "./actions";
import { SETUP_STRINGS } from "./strings";

// Hidden family setup on grandma's phone (long-press the top-left corner of /).
// Settings live on this phone only, in localStorage; grandma's screen reads the same keys.

type Settings = {
  rate: "0.7" | "0.85" | "1";
  waitMs: "1500" | "2000" | "3000";
  textScale: "normal" | "large" | "xlarge";
  captions: "on" | "off";
  volume: string; // "0" to "1"
  lang: "en" | "ko";
};

const DEFAULTS: Settings = { rate: "0.85", waitMs: "2000", textScale: "normal", captions: "on", volume: "1", lang: APP_LANG };
const KEYS = Object.keys(DEFAULTS) as (keyof Settings)[];
const key = (k: keyof Settings) => `sonny.${k}`;

function load(): Settings {
  const out = { ...DEFAULTS };
  for (const k of KEYS) {
    try {
      const v = window.localStorage.getItem(key(k));
      if (v !== null) (out as Record<string, string>)[k] = v;
    } catch {
      // storage blocked (private mode): keep defaults
    }
  }
  return out;
}

function save(k: keyof Settings, v: string): boolean {
  try {
    window.localStorage.setItem(key(k), v);
    return true;
  } catch {
    return false;
  }
}

type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  abort: () => void;
};

function Seg<V extends string>({ label, value, options, onChange }: { label: string; value: V; options: Record<V, string>; onChange: (v: V) => void }) {
  return (
    <div className="st-seg" role="radiogroup" aria-label={label}>
      {(Object.keys(options) as V[]).map((v) => (
        <button key={v} type="button" role="radio" aria-checked={v === value} className={v === value ? "st-seg-btn is-on" : "st-seg-btn"} onClick={() => onChange(v)}>
          {options[v]}
        </button>
      ))}
    </div>
  );
}

export default function SetupApp() {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [disconnected, setDisconnected] = useState(false);

  // mic test
  const [micOn, setMicOn] = useState(false);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState("");
  const [micMsg, setMicMsg] = useState("");
  const micRef = useRef<{ stop: () => void } | null>(null);

  const S = SETUP_STRINGS[s.lang] ?? SETUP_STRINGS.en;

  useEffect(() => {
    const id = setTimeout(() => setS(load()), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 1800);
    return () => clearTimeout(id);
  }, [notice]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setS((prev) => ({ ...prev, [k]: v }));
    if (save(k, v)) setNotice((SETUP_STRINGS[k === "lang" ? (v as Settings["lang"]) : s.lang] ?? SETUP_STRINGS.en).saved);
  };

  const submitPin = async (value: string) => {
    if (await checkPin(value)) {
      setUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin("");
    }
  };

  const testSound = async () => {
    const volume = Math.min(1, Math.max(0, Number(s.volume) || 0));
    const rate = Number(s.rate) || 1;
    try {
      const res = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: S.testLine }) });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const a = new Audio(url);
      a.volume = volume;
      a.playbackRate = rate;
      a.onended = () => URL.revokeObjectURL(url);
      await a.play();
    } catch {
      if (!("speechSynthesis" in window)) return;
      const u = new SpeechSynthesisUtterance(S.testLine);
      u.lang = s.lang === "ko" ? "ko-KR" : "en-US";
      u.rate = rate;
      u.volume = volume;
      window.speechSynthesis.speak(u);
    }
  };

  const stopMic = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    setMicOn(false);
    setLevel(0);
  }, []);

  const startMic = async () => {
    setHeard("");
    setMicMsg("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicMsg(S.micBlocked);
      return;
    }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const b of buf) sum += ((b - 128) / 128) ** 2;
      setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
      raf = requestAnimationFrame(tick);
    };
    tick();

    const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    let recog: RecognitionLike | null = null;
    if (Ctor) {
      recog = new Ctor();
      recog.lang = s.lang === "ko" ? "ko-KR" : "en-US";
      recog.interimResults = true;
      recog.continuous = true;
      recog.onresult = (e) =>
        setHeard(
          Array.from(e.results)
            .map((r) => r[0]?.transcript ?? "")
            .join(" ")
            .trim(),
        );
      recog.onerror = () => undefined;
      try {
        recog.start();
      } catch {
        recog = null;
      }
    } else {
      setMicMsg(S.micNoSpeech);
    }

    micRef.current = {
      stop: () => {
        cancelAnimationFrame(raf);
        recog?.abort();
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close().catch(() => undefined);
      },
    };
    setMicOn(true);
  };

  useEffect(() => stopMic, [stopMic]);

  const disconnect = async () => {
    if (await disconnectDevice(pin)) {
      setDisconnected(true);
      setConfirming(false);
      setTimeout(() => window.location.assign("/login/device"), 1200);
    }
  };

  return (
    <div className={`fa st theme-light st-scale-${s.textScale}`}>
      <LightPage />
      <header className="fa-header">
        <h1 className="fa-title">{unlocked ? S.title : S.pinTitle}</h1>
        <Link href="/" className="st-back-link">
          {S.back}
        </Link>
      </header>

      {!unlocked ? (
        <form
          className="st-card st-pin"
          onSubmit={(e) => {
            e.preventDefault();
            void submitPin(pin);
          }}
        >
          <p className="st-hint">{S.pinHint}</p>
          <input
            className="st-pin-input"
            value={pin}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 4);
              setPin(v);
              if (v.length === 4) void submitPin(v);
            }}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            aria-label={S.pinTitle}
            autoFocus
          />
          {pinError && (
            <p className="st-error" role="alert">
              {S.pinWrong}
            </p>
          )}
          <button className="fa-btn fa-btn-primary st-wide" type="submit" disabled={pin.length !== 4}>
            {S.enter}
          </button>
        </form>
      ) : (
        <main className="st-list">
          {notice && (
            <p className="fa-notice" role="status">
              {notice}
            </p>
          )}

          <section className="st-card">
            <h2 className="st-label">{S.rate}</h2>
            <Seg label={S.rate} value={s.rate} options={S.rateOpts} onChange={(v) => set("rate", v)} />
          </section>

          <section className="st-card">
            <h2 className="st-label">{S.wait}</h2>
            <p className="st-hint">{S.waitHint}</p>
            <Seg label={S.wait} value={s.waitMs} options={S.waitOpts} onChange={(v) => set("waitMs", v)} />
          </section>

          <section className="st-card">
            <h2 className="st-label">{S.text}</h2>
            <Seg label={S.text} value={s.textScale} options={S.textOpts} onChange={(v) => set("textScale", v)} />
          </section>

          <section className="st-card">
            <h2 className="st-label">{S.captions}</h2>
            <Seg label={S.captions} value={s.captions} options={{ on: S.on, off: S.off }} onChange={(v) => set("captions", v)} />
          </section>

          <section className="st-card">
            <h2 className="st-label">{S.volume}</h2>
            <div className="st-row">
              <input
                className="st-range"
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={s.volume}
                onChange={(e) => set("volume", e.target.value)}
                aria-label={S.volume}
              />
              <span className="st-value">{Math.round(Number(s.volume) * 100)}%</span>
            </div>
            <button className="fa-btn st-wide" type="button" onClick={() => void testSound()}>
              {S.testSound}
            </button>
          </section>

          <section className="st-card">
            <h2 className="st-label">{S.mic}</h2>
            <p className="st-hint">{S.micHint}</p>
            <div className="st-meter" aria-hidden>
              <span className="st-meter-fill" style={{ transform: `scaleX(${level})` }} />
            </div>
            {micMsg && <p className="st-hint">{micMsg}</p>}
            {heard && (
              <p className="st-heard">
                <span>{S.heard}</span> {heard}
              </p>
            )}
            <button className="fa-btn st-wide" type="button" onClick={() => (micOn ? stopMic() : void startMic())}>
              {micOn ? S.micStop : S.micStart}
            </button>
          </section>

          <section className="st-card">
            <h2 className="st-label">{S.lang}</h2>
            <Seg label={S.lang} value={s.lang} options={S.langOpts} onChange={(v) => set("lang", v)} />
          </section>

          <section className="st-card">
            <h2 className="st-label">{S.disconnect}</h2>
            <p className="st-hint">{S.disconnectHint}</p>
            {disconnected ? (
              <p className="fa-notice">{S.disconnected}</p>
            ) : confirming ? (
              <div className="st-row">
                <button className="fa-btn st-danger" type="button" onClick={() => void disconnect()}>
                  {S.disconnectConfirm}
                </button>
                <button className="fa-btn" type="button" onClick={() => setConfirming(false)}>
                  {S.cancel}
                </button>
              </div>
            ) : (
              <button className="fa-btn st-wide" type="button" onClick={() => setConfirming(true)}>
                {S.disconnect}
              </button>
            )}
          </section>

          <Link href="/" className="fa-btn fa-btn-primary st-wide st-back">
            {S.back}
          </Link>
        </main>
      )}
    </div>
  );
}
