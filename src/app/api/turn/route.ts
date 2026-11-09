// POST /api/turn
// "Has grandma finished talking?" Older speakers pause mid-sentence ("um... so..."),
// and a loudness-only VAD cuts them off. The screen sends the recent audio of the
// current turn (16 kHz, up to 8 s is used) when the VAD hears ~0.7 s of silence;
// the smart-turn model on the local STT server (scripts/stt-server.py, 127.0.0.1:3201)
// judges from the audio itself. Returns { complete, prob, ms }, or 503 if that server is down.

const STT_URL = process.env.STT_URL ?? "http://127.0.0.1:3201";
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "application/octet-stream";
  const audio = await request.arrayBuffer();
  if (audio.byteLength === 0) {
    return Response.json({ error: "empty audio" }, { status: 400 });
  }
  if (audio.byteLength > MAX_BYTES) {
    return Response.json({ error: "audio too large" }, { status: 413 });
  }

  const started = Date.now();
  let upstream: Response;
  try {
    upstream = await fetch(`${STT_URL}/turn`, {
      method: "POST",
      headers: { "content-type": contentType },
      body: audio,
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        error: "turn server unavailable",
        reason: `${STT_URL} not reachable (${reason}). Start it with scripts/stt-server.py`,
      },
      { status: 503 },
    );
  }

  const payload = (await upstream.json().catch(() => null)) as
    | { complete?: boolean; prob?: number; error?: string }
    | null;
  if (!upstream.ok || !payload || typeof payload.complete !== "boolean") {
    return Response.json(
      { error: payload?.error ?? `turn server error ${upstream.status}` },
      { status: upstream.status >= 400 ? upstream.status : 502 },
    );
  }
  // ms = full round trip seen by the app (decode + features + model on the STT server)
  return Response.json({ complete: payload.complete, prob: payload.prob, ms: Date.now() - started });
}
