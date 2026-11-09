import { warmLiveGuide } from "@/lib/epg/live";

// GET /api/agent/warm : start (or check) the background TVmaze cache fill.
// Call once after the server starts; a cold fill takes several minutes.
export async function GET() {
  const s = warmLiveGuide();
  return Response.json(s ? { warming: s.done === null, startedAt: new Date(s.started).toISOString(), doneAt: s.done ? new Date(s.done).toISOString() : null } : { live: false });
}
