import { CHANNELS, todaysPrograms } from "@/lib/epg";

// GET /api/agent/epg?now=ISO : channel list and today's lineup for the TV guide.
export async function GET(request: Request) {
  const nowParam = new URL(request.url).searchParams.get("now");
  const now = nowParam && Number.isFinite(Date.parse(nowParam)) ? new Date(nowParam) : new Date();
  return Response.json({ channels: CHANNELS, programs: todaysPrograms(now) });
}
