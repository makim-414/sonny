import { syncShared } from "@/lib/shared-state";
import { SONNY_VOICES, chosenVoice, setChosenVoice } from "@/lib/tts/openai";

// GET/POST /api/agent/voice { voice: "cedar" | "marin" } : Sonny's voice, picked in /setup.
// Shared state, so grandma's TV and every phone speak with the same voice.
export async function GET() {
  await syncShared();
  return Response.json({ voice: chosenVoice(), options: SONNY_VOICES });
}

export async function POST(request: Request) {
  await syncShared();
  const body = (await request.json().catch(() => null)) as { voice?: unknown } | null;
  const v = typeof body?.voice === "string" ? body.voice.trim().toLowerCase() : "";
  if (!setChosenVoice(v)) return Response.json({ error: `voice must be one of ${SONNY_VOICES.join(", ")}` }, { status: 400 });
  return Response.json({ voice: chosenVoice() });
}
