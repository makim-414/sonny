// Sonny's voice from OpenAI gpt-4o-mini-tts (owner, 11/9: Kokoro sounded too flat).
// The key comes from OPENAI_API_KEY only; without it, /api/tts uses Kokoro as before.

const MODEL = "gpt-4o-mini-tts";
const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"];
const INSTRUCTIONS =
  "Warm, cheerful young grandchild talking to his grandmother on the phone. Natural, relaxed, smiling. Clear and a little slow, never robotic.";
const SAMPLE_RATE = 24_000; // "pcm" output: 16-bit little-endian mono at 24 kHz
const TIMEOUT_MS = 8_000;

export const openaiEnabled = () => Boolean(process.env.OPENAI_API_KEY);

/** SONNY_VOICE, or a voice the client asked for when it is an OpenAI voice name. */
export function openaiVoice(asked?: string): string {
  if (asked && VOICES.includes(asked)) return asked;
  const env = process.env.SONNY_VOICE?.trim().toLowerCase();
  return env && VOICES.includes(env) ? env : "ash";
}

// Raw PCM with our own WAV header: a fixed, correct length that iOS Safari's decodeAudioData accepts.
function pcmToWav(pcm: Buffer): Buffer {
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write("WAVE", 8);
  head.write("fmt ", 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(SAMPLE_RATE, 24);
  head.writeUInt32LE(SAMPLE_RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

export async function synthesizeOpenAI(text: string, voice: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, voice, input: text, instructions: INSTRUCTIONS, response_format: "pcm" }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`openai tts ${res.status}`);
  const pcm = Buffer.from(await res.arrayBuffer());
  if (pcm.length < 2) throw new Error("openai tts returned no audio");
  return pcmToWav(pcm.length % 2 ? pcm.subarray(0, pcm.length - 1) : pcm);
}
