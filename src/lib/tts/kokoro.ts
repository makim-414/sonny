import os from "node:os";
import path from "node:path";
import { env } from "@huggingface/transformers";
import { KokoroTTS } from "kokoro-js";

// Kokoro 82M (hexgrad/kokoro, Apache-2.0) running on the Node server, no API key.
// The model is cached outside the repo so every worktree and the venue laptop share one download.

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
export const DEFAULT_VOICE = "af_heart"; // warm US English female voice
const SAMPLE_RATE = 24_000;
// A little slower than normal so older ears catch every word (owner, 11/9). Clients may pass speed.
export const DEFAULT_SPEED = 0.85;

env.cacheDir = process.env.TTS_CACHE_DIR || path.join(os.homedir(), ".cache", "hyodo-tts");

const g = globalThis as unknown as { __kokoro?: Promise<KokoroTTS> };

export function loadKokoro(): Promise<KokoroTTS> {
  if (!g.__kokoro) {
    g.__kokoro = KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "cpu" }).catch((err) => {
      g.__kokoro = undefined;
      throw err;
    });
  }
  return g.__kokoro;
}

// 16-bit PCM WAV: decodes everywhere, including iOS Safari.
function toWav16(samples: Float32Array, sampleRate: number): Buffer {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2);
  }
  return buf;
}

export async function synthesize(text: string, voice = DEFAULT_VOICE, speed = DEFAULT_SPEED): Promise<Buffer> {
  const tts = await loadKokoro();
  const audio = await tts.generate(text, { voice: voice as "af_heart", speed });
  return toWav16(audio.audio as Float32Array, audio.sampling_rate || SAMPLE_RATE);
}
