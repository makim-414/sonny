"use client";

import { useRef, useState } from "react";
import { listenOnce, type Listener } from "@/lib/voice/listen";

type Lang = "ko" | "en";

const COPY = {
  ko: {
    title: "TV 리모컨",
    speak: "말하기",
    listening: "듣고 있어요",
    hint: "버튼을 누르고 TV에게 말해 보세요",
    sent: "TV로 보냈어요",
    up: "채널 위",
    down: "채널 아래",
    ok: "OK",
    typePlaceholder: "글로 보내기",
    send: "보내기",
    micFail: "마이크를 쓸 수 없어요. 글로 보내 주세요",
    sendFail: "TV에 닿지 않았어요. 다시 눌러 주세요",
  },
  en: {
    title: "TV remote",
    speak: "Speak",
    listening: "Listening",
    hint: "Hold the phone close and talk to the TV",
    sent: "Sent to the TV",
    up: "Channel up",
    down: "Channel down",
    ok: "OK",
    typePlaceholder: "Type instead",
    send: "Send",
    micFail: "Mic is not available. Type instead",
    sendFail: "Could not reach the TV. Try again",
  },
} as const;

async function sendToTv(text: string): Promise<boolean> {
  try {
    const res = await fetch("/remote/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) return true;
  } catch {
    // fall through to the family API
  }
  try {
    const res = await fetch("/api/family", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: "remote", text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="rm-chev" aria-hidden>
      <path d={up ? "M5 15l7-7 7 7" : "M5 9l7 7 7-7"} />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="rm-mic-icon" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <line x1="12" y1="17.5" x2="12" y2="21" />
      <line x1="8.5" y1="21" x2="15.5" y2="21" />
    </svg>
  );
}

export function RemoteApp() {
  const [lang, setLang] = useState<Lang>("ko");
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const listenerRef = useRef<Listener | null>(null);
  const t = COPY[lang];

  const deliver = async (text: string) => {
    setHeard(text);
    const ok = await sendToTv(text);
    setStatus(ok ? t.sent : t.sendFail);
  };

  const press = (key: "up" | "down" | "ok") => {
    navigator.vibrate?.(20);
    void sendToTv(`key:${key}`);
  };

  const toggleMic = () => {
    if (listening) {
      listenerRef.current?.stop();
      return;
    }
    navigator.vibrate?.(30);
    setStatus("");
    setHeard("");
    setListening(true);
    listenerRef.current = listenOnce(
      {
        onInterim: setHeard,
        onFinal: (text) => void deliver(text),
        onError: (code) => {
          if (code === "no-speech" || code === "aborted") return;
          setStatus(t.micFail);
        },
        onEnd: () => {
          setListening(false);
          listenerRef.current = null;
        },
      },
      lang === "ko" ? "ko-KR" : "en-US",
    );
    if (!listenerRef.current) setListening(false);
  };

  return (
    <main className="rm-root">
      <header className="rm-head">
        <h1 className="rm-title">{t.title}</h1>
        <div className="rm-lang" role="group" aria-label="Language">
          <button type="button" className={lang === "ko" ? "is-on" : ""} onClick={() => setLang("ko")}>
            한국어
          </button>
          <button type="button" className={lang === "en" ? "is-on" : ""} onClick={() => setLang("en")}>
            English
          </button>
        </div>
      </header>

      <button type="button" className={`rm-mic ${listening ? "is-on" : ""}`} onClick={toggleMic}>
        <MicIcon />
        <span>{listening ? t.listening : t.speak}</span>
      </button>

      <p className="rm-heard" aria-live="polite">
        {heard || t.hint}
      </p>
      <p className="rm-status" aria-live="polite">
        {status}
      </p>

      <div className="rm-pad">
        <button type="button" className="rm-key" onClick={() => press("up")} aria-label={t.up}>
          <Chevron up />
        </button>
        <button type="button" className="rm-key rm-ok" onClick={() => press("ok")}>
          {t.ok}
        </button>
        <button type="button" className="rm-key" onClick={() => press("down")} aria-label={t.down}>
          <Chevron up={false} />
        </button>
      </div>

      <form
        className="rm-type"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          setDraft("");
          void deliver(text);
        }}
      >
        <input
          className="rm-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.typePlaceholder}
          aria-label={t.typePlaceholder}
        />
        <button type="submit" className="rm-send">
          {t.send}
        </button>
      </form>
    </main>
  );
}
