// Speech to text with the browser Web Speech API (ko-KR).
// Chrome exposes it as webkitSpeechRecognition. No keys needed.

type RecognitionAlternative = { transcript: string };
type RecognitionResult = { isFinal: boolean; 0: RecognitionAlternative; length: number };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionErrorEvent = { error: string };

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isListenSupported(): boolean {
  return getCtor() !== null;
}

export type ListenHandlers = {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  // "not-allowed", "no-speech", "audio-capture", "network", "unsupported", ...
  onError?: (code: string) => void;
  onEnd?: () => void;
};

export type Listener = { stop(): void; abort(): void };

// Starts one listening turn. Ends by itself after the speaker pauses.
export function listenOnce(handlers: ListenHandlers): Listener | null {
  const Ctor = getCtor();
  if (!Ctor) {
    handlers.onError?.("unsupported");
    return null;
  }
  const rec = new Ctor();
  rec.lang = "ko-KR";
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let finalText = "";
  let interimText = "";
  let delivered = false;

  const deliver = (text: string) => {
    const clean = text.trim();
    if (delivered || !clean) return;
    delivered = true;
    handlers.onFinal(clean);
  };

  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    interimText = interim;
    handlers.onInterim?.((finalText + interim).trim());
    if (finalText && !interim) deliver(finalText);
  };
  rec.onerror = (e) => handlers.onError?.(e.error);
  rec.onend = () => {
    // Chrome sometimes ends without marking the last chunk final.
    deliver(finalText || interimText);
    handlers.onEnd?.();
  };

  try {
    rec.start();
  } catch {
    handlers.onError?.("start-failed");
    return null;
  }
  return {
    stop: () => rec.stop(),
    abort: () => {
      delivered = true;
      rec.abort();
    },
  };
}
