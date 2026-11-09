"use client";

// Plays Kokoro clips from POST /api/tts through WebAudio so the orb can read the real voice level.
// Falls back to the browser voice (speechSynthesis) for any clip that fails.

import { setSpeechVolume as setBrowserVolume, speak as speakBrowser, stopSpeaking as stopBrowser } from "@/lib/voice/speak";

type Ctx = { ctx: AudioContext; analyser: AnalyserNode; gain: GainNode; data: Uint8Array<ArrayBuffer> };

let volume = 1;

let audio: Ctx | null = null;
let current: AudioBufferSourceNode | null = null;
let playing = false;

function ensureAudio(): Ctx | null {
  if (audio) return audio;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.6;
  // source -> analyser (orb reads the level before volume) -> gain -> speakers
  const gain = ctx.createGain();
  gain.gain.value = volume;
  analyser.connect(gain);
  gain.connect(ctx.destination);
  audio = { ctx, analyser, gain, data: new Uint8Array(new ArrayBuffer(analyser.fftSize)) };
  return audio;
}

// Voice volume 0..1 (family setting). Applies to Kokoro and the browser voice.
export function setVoiceVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (audio) audio.gain.gain.value = volume;
  setBrowserVolume(volume);
}

// Call from a tap: browsers only start audio after a user gesture.
export function unlockAudio() {
  const a = ensureAudio();
  if (a && a.ctx.state === "suspended") void a.ctx.resume();
}

// Ask the server to load the model early.
export function warmTts() {
  void fetch("/api/tts", { cache: "no-store" }).catch(() => {});
}

// Loudness of the voice playing right now, 0..1. Null when no real audio is playing.
export function voiceLevel(): number | null {
  if (!audio || !playing) return null;
  const { analyser, data } = audio;
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / data.length) * 4);
}

const SENTENCE_GAP_MS = 250; // a short breath between sentences makes them clearer

async function fetchClip(text: string, speed: number): Promise<AudioBuffer | null> {
  const a = ensureAudio();
  if (!a) return null;
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, speed }),
    });
    if (!res.ok) return null;
    return await a.ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function playClip(buffer: AudioBuffer): Promise<void> {
  const a = ensureAudio();
  if (!a) return Promise.resolve();
  if (a.ctx.state === "suspended") void a.ctx.resume();
  return new Promise((resolve) => {
    const src = a.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(a.analyser);
    current = src;
    playing = true;
    src.onended = () => {
      if (current === src) {
        current = null;
        playing = false;
      }
      resolve();
    };
    src.start();
  });
}

export function stopVoice() {
  try {
    current?.stop();
  } catch {
    // already stopped
  }
  current = null;
  playing = false;
  stopBrowser();
}

// Speaks sentences in order, fetching the next clip while the current one plays.
// `onSentence` fires as each sentence starts; `isCancelled` lets a tap cut it short.
export async function speakSentences(
  sentences: string[],
  opts: { lang: string; rate: number; onSentence: (i: number) => void; isCancelled: () => boolean },
): Promise<void> {
  // Kokoro here is English only; Korean lines go to the browser's Korean voice.
  const hangul = (s: string) => /[가-힣]/.test(s);
  const clips = sentences.map((s) => (hangul(s) ? Promise.resolve(null) : fetchClip(s, opts.rate)));
  for (let i = 0; i < sentences.length; i++) {
    const clip = await clips[i];
    if (opts.isCancelled()) return;
    if (i > 0) await new Promise((r) => setTimeout(r, SENTENCE_GAP_MS));
    if (opts.isCancelled()) return;
    opts.onSentence(i);
    if (clip) await playClip(clip);
    else await speakBrowser(sentences[i], hangul(sentences[i]) ? "ko-KR" : opts.lang, opts.rate);
  }
}
