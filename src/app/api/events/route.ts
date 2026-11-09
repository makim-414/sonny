import { connection, type NextRequest } from "next/server";
import { logEvent, store } from "@/lib/store";
import type { ActivityEvent } from "@/lib/types";

const KINDS: ActivityEvent["kind"][] = ["heard", "said", "tuned", "scheduled", "alert", "memory", "family"];

// GET /api/events            -> every event, oldest first
// GET /api/events?since=X    -> events after X, where X is an event id or an ISO time
export async function GET(request: NextRequest) {
  await connection();
  const since = request.nextUrl.searchParams.get("since");
  if (!since) return Response.json(store.events);

  const index = store.events.findIndex((e) => e.id === since);
  if (index >= 0) return Response.json(store.events.slice(index + 1));

  const t = Date.parse(since);
  if (Number.isNaN(t)) return Response.json({ error: "since must be an event id or an ISO time" }, { status: 400 });
  return Response.json(store.events.filter((e) => Date.parse(e.at) > t));
}

// POST /api/events { kind, text, at? } -> logs one event.
// For demo seeding and for any surface that has no route of its own yet.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<ActivityEvent> | null;
  if (!body || typeof body.text !== "string" || !body.text.trim() || !KINDS.includes(body.kind as ActivityEvent["kind"])) {
    return Response.json({ error: `need { kind: ${KINDS.join("|")}, text }` }, { status: 400 });
  }
  const event = logEvent(body.kind as ActivityEvent["kind"], body.text.trim(), body.at ?? undefined);
  return Response.json(event, { status: 201 });
}
