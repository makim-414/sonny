// Text to speech with the browser speechSynthesis (ko-KR by default, en-US for the global demo).

const PREFERRED_VOICES: Record<string, string[]> = {
  ko: ["Yuna", "Google 한국의", "Sora", "Jian", "Heami"],
  en: ["Samantha", "Google US English", "Ava", "Allison", "Karen"],
};

// Slightly slow for older ears, a little bright for a grandchild voice.
const DEFAULT_RATE = 0.85;
const PITCH = 1.1;

const cachedVoice = new Map<string, SpeechSynthesisVoice>();
let volume = 1;

export function setSpeechVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
}
// Chrome can garbage collect an utterance mid-sentence and never fire onend.
let current: SpeechSynthesisUtterance | null = null;
let cancelCurrent: (() => void) | null = null;

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

function pickVoice(s: SpeechSynthesis, lang: string): SpeechSynthesisVoice | null {
  const base = lang.slice(0, 2).toLowerCase();
  const hit = cachedVoice.get(base);
  if (hit) return hit;
  const matching = s.getVoices().filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(base));
  if (matching.length === 0) return null;
  const preferred = (PREFERRED_VOICES[base] ?? [])
    .map((name) => matching.find((v) => v.name.includes(name)))
    .find(Boolean);
  const voice = preferred ?? matching[0];
  cachedVoice.set(base, voice);
  return voice;
}

function waitForVoices(s: SpeechSynthesis, timeoutMs = 1200): Promise<void> {
  if (s.getVoices().length > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      s.removeEventListener("voiceschanged", done);
      resolve();
    };
    s.addEventListener("voiceschanged", done);
    setTimeout(done, timeoutMs);
  });
}

// Reading time estimate, used when speech is missing or onend never fires.
export function estimateMs(text: string): number {
  return Math.max(1800, text.length * 190);
}

export function isSpeakSupported(): boolean {
  return synth() !== null;
}

// Call once from a key press or click: Chrome only lets a page speak after a user gesture.
export function unlockSpeech() {
  const s = synth();
  if (!s) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  s.speak(u);
}

export function stopSpeaking() {
  synth()?.cancel();
  cancelCurrent?.();
}

// Speaks one chunk of text. Resolves when done, cancelled, or after a safety timeout.
export async function speak(text: string, lang = "ko-KR", rate = DEFAULT_RATE): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  const s = synth();
  if (!s) {
    await new Promise((r) => setTimeout(r, estimateMs(clean)));
    return;
  }
  await waitForVoices(s);
  return new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(safety);
      if (current === u) current = null;
      cancelCurrent = null;
      resolve();
    };
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = lang;
    u.rate = rate;
    u.volume = volume;
    u.pitch = PITCH;
    const voice = pickVoice(s, lang);
    if (voice) u.voice = voice;
    u.onend = finish;
    u.onerror = finish;
    const safety = setTimeout(finish, estimateMs(clean) + 4000);
    current = u;
    cancelCurrent = finish;
    s.speak(u);
  });
}

// Splits a reply into short sentences so each can be shown as one big caption.
export function splitSentences(text: string): string[] {
  const parts = (text.replace(/\s+/g, " ").match(/.+?(?:[.!?？！~]+(?=\s|$)|$)/g) ?? [])
    .map((p) => p.trim())
    .filter(Boolean);
  // Merge very short pieces into the previous one so captions do not flicker.
  const out: string[] = [];
  for (const p of parts) {
    if (out.length > 0 && p.length < 6) out[out.length - 1] += " " + p;
    else out.push(p);
  }
  return out.length > 0 ? out : [text.trim()];
}
