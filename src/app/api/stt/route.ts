// POST /api/stt
// Server-side speech-to-text fallback for browsers without Web Speech
// (e.g. iPhone home-screen web apps). Forwards the raw audio body to the local
// faster-whisper server (scripts/stt-server.py on 127.0.0.1:3201) and returns { text, ms }.
// If that server is not running, answers 503 with the reason so the screen can say so.

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
    upstream = await fetch(`${STT_URL}/transcribe`, {
      method: "POST",
      headers: { "content-type": contentType },
      body: audio,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        error: "stt server unavailable",
        reason: `${STT_URL} not reachable (${reason}). Start it with scripts/stt-server.py`,
      },
      { status: 503 },
    );
  }

  const payload = (await upstream.json().catch(() => null)) as
    | { text?: string; ms?: number; error?: string }
    | null;
  if (!upstream.ok || !payload || typeof payload.text !== "string") {
    return Response.json(
      { error: payload?.error ?? `stt server error ${upstream.status}` },
      { status: upstream.status >= 400 ? upstream.status : 502 },
    );
  }
  // ms = full round trip seen by the app (includes decoding + model time on the STT server)
  return Response.json({ text: payload.text, ms: Date.now() - started });
}
