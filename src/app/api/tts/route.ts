import { loadKokoro, synthesize } from "@/lib/tts/kokoro";

// Node.js runtime is the default (cacheComponents forbids a runtime export).
const MAX_CHARS = 400;

// GET /api/tts : loads the model so the first spoken line is not slow. The app calls it on open.
export async function GET() {
  try {
    await loadKokoro();
    return Response.json({ ready: true });
  } catch (err) {
    console.error("[tts] load failed", err);
    return Response.json({ ready: false }, { status: 503 });
  }
}

// POST /api/tts { text, voice?, speed? (0.5..1.5, default 0.85) } -> audio/wav (16-bit mono, 24 kHz). The phone falls back
// to the browser voice when this fails.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: unknown; voice?: unknown; speed?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return Response.json({ error: "need { text }" }, { status: 400 });
  if (text.length > MAX_CHARS) return Response.json({ error: "text is too long" }, { status: 400 });
  try {
    const speed = typeof body?.speed === "number" && body.speed >= 0.5 && body.speed <= 1.5 ? body.speed : undefined;
    const wav = await synthesize(text, typeof body?.voice === "string" ? body.voice : undefined, speed);
    return new Response(new Uint8Array(wav), {
      headers: { "content-type": "audio/wav", "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("[tts] synth failed", err);
    return Response.json({ error: "tts failed" }, { status: 500 });
  }
}
