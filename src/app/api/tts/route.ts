import { loadKokoro, synthesize } from "@/lib/tts/kokoro";
import { openaiEnabled, openaiVoice, synthesizeOpenAI } from "@/lib/tts/openai";

// Node.js runtime is the default (cacheComponents forbids a runtime export).
const MAX_CHARS = 400;
const CACHE_MAX = 300;

// Same line, same voice: reuse the clip (greetings, pill reminders, call scripts repeat a lot).
const g = globalThis as unknown as { __ttsCache?: Map<string, Buffer> };
const cache = (g.__ttsCache ??= new Map());
function remember(key: string, wav: Buffer) {
  cache.set(key, wav);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

// GET /api/tts : warms the engine so the first spoken line is not slow. The app calls it on open.
// With OpenAI there is nothing to load; Kokoro still loads in the background as the fallback.
export async function GET() {
  if (openaiEnabled()) {
    void loadKokoro().catch(() => {});
    return Response.json({ ready: true, engine: "openai" });
  }
  try {
    await loadKokoro();
    return Response.json({ ready: true, engine: "kokoro" });
  } catch (err) {
    console.error("[tts] load failed", err);
    return Response.json({ ready: false }, { status: 503 });
  }
}

// POST /api/tts { text, voice?, speed? (0.5..1.5, Kokoro only) } -> audio/wav (16-bit mono, 24 kHz).
// OpenAI gpt-4o-mini-tts first; Kokoro when there is no key or OpenAI fails. The phone falls back
// to the browser voice when both fail.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: unknown; voice?: unknown; speed?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return Response.json({ error: "need { text }" }, { status: 400 });
  if (text.length > MAX_CHARS) return Response.json({ error: "text is too long" }, { status: 400 });
  const asked = typeof body?.voice === "string" ? body.voice : undefined;
  const speed = typeof body?.speed === "number" && body.speed >= 0.5 && body.speed <= 1.5 ? body.speed : undefined;

  const send = (wav: Buffer, engine: string, hit = false) =>
    new Response(new Uint8Array(wav), {
      headers: { "content-type": "audio/wav", "cache-control": "no-store", "x-tts-engine": engine, "x-tts-cache": hit ? "hit" : "miss" },
    });

  if (openaiEnabled()) {
    const voice = openaiVoice(asked);
    const key = `openai:${voice}:${text}`;
    const hit = cache.get(key);
    if (hit) return send(hit, "openai", true);
    try {
      const wav = await synthesizeOpenAI(text, voice);
      remember(key, wav);
      return send(wav, "openai");
    } catch (err) {
      console.error("[tts] openai failed, using kokoro", err instanceof Error ? err.message : err);
    }
  }

  const kokoroVoice = asked && !/^[a-z]+$/.test(asked) ? asked : undefined; // Kokoro names look like af_heart
  const key = `kokoro:${kokoroVoice ?? ""}:${speed ?? ""}:${text}`;
  const hit = cache.get(key);
  if (hit) return send(hit, "kokoro", true);
  try {
    const wav = await synthesize(text, kokoroVoice, speed);
    remember(key, wav);
    return send(wav, "kokoro");
  } catch (err) {
    console.error("[tts] synth failed", err);
    return Response.json({ error: "tts failed" }, { status: 500 });
  }
}
