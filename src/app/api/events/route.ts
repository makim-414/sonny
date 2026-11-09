import { connection, type NextRequest } from "next/server";
import { logEvent, store } from "@/lib/store";
import type { ActivityEvent } from "@/lib/types";
import { familyView } from "../family/view";

const KINDS: ActivityEvent["kind"][] = ["heard", "said", "tuned", "scheduled", "alert", "memory", "family", "task"];
const VIS = ["family", "summary", "private"] as const;

// GET /api/events            -> events as the family may see them (private hidden, summaries only), oldest first
// GET /api/events?view=all   -> every raw event (TV and debugging, not for the phone)
// GET /api/events?since=X    -> only events after X, where X is an event id or an ISO time
export async function GET(request: NextRequest) {
  await connection();
  const params = request.nextUrl.searchParams;
  const all = store.events;
  let list = all;

  const since = params.get("since");
  if (since) {
    const index = all.findIndex((e) => e.id === since);
    if (index >= 0) list = all.slice(index + 1);
    else {
      const t = Date.parse(since);
      if (Number.isNaN(t)) return Response.json({ error: "since must be an event id or an ISO time" }, { status: 400 });
      list = all.filter((e) => Date.parse(e.at) > t);
    }
  }

  return Response.json(params.get("view") === "all" ? list : familyView(list).events);
}

// POST /api/events { kind, text, at?, visibility?, familyText? } -> logs one event.
// For demo seeding and for any surface that has no route of its own yet.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<ActivityEvent> | null;
  if (!body || typeof body.text !== "string" || !body.text.trim() || !KINDS.includes(body.kind as ActivityEvent["kind"])) {
    return Response.json({ error: `need { kind: ${KINDS.join("|")}, text }` }, { status: 400 });
  }
  const visibility = VIS.find((v) => v === body.visibility);
  const familyText = typeof body.familyText === "string" && body.familyText.trim() ? body.familyText.trim() : undefined;
  const event = logEvent(body.kind as ActivityEvent["kind"], body.text.trim(), body.at ?? undefined, {
    ...(visibility ? { visibility } : {}),
    ...(familyText ? { familyText } : {}),
  });
  return Response.json(event, { status: 201 });
}
