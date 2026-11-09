"use client";

// Server speech-to-text (POST /api/stt, faster-whisper) for phones without Web Speech,
// e.g. an iPhone home-screen app. Takes the 16 kHz Float32 segment the VAD captured.

const VAD_SAMPLE_RATE = 16_000;

function toWav16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

// Smart turn (POST /api/turn, pipecat smart-turn): did the speaker finish, judged from the audio?
// Null when the service is missing or down, so the caller falls back to a fixed silence wait.
export async function isTurnComplete(audio: Float32Array): Promise<boolean | null> {
  try {
    const res = await fetch("/api/turn", {
      method: "POST",
      headers: { "content-type": "audio/wav" },
      body: toWav16(audio, VAD_SAMPLE_RATE),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { complete?: boolean };
    return typeof json.complete === "boolean" ? json.complete : null;
  } catch {
    return null;
  }
}

export type SttResult = { ok: true; text: string } | { ok: false; unavailable: boolean };

export async function transcribe(audio: Float32Array): Promise<SttResult> {
  try {
    const res = await fetch("/api/stt", {
      method: "POST",
      headers: { "content-type": "audio/wav" },
      body: toWav16(audio, VAD_SAMPLE_RATE),
    });
    if (!res.ok) return { ok: false, unavailable: res.status === 503 || res.status === 404 };
    const json = (await res.json()) as { text?: string };
    return { ok: true, text: (json.text ?? "").trim() };
  } catch {
    return { ok: false, unavailable: true };
  }
}
