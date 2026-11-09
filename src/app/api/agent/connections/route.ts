import { connect, connections } from "@/lib/agent/connections";
import { currentGuardian } from "@/lib/auth/server";
import { logEvent, store } from "@/lib/store";

// GET  /api/agent/connections        -> "Connected for grandma" list (masked, demo)
// POST /api/agent/connections { id } -> the guardian connects one (guardian only)
export async function GET() {
  return Response.json({ connections });
}

export async function POST(request: Request) {
  const who = await currentGuardian();
  if (!who) return Response.json({ error: "only the guardian can connect accounts" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const c = body?.id ? connect(body.id, who.name) : null;
  if (!c) return Response.json({ error: "unknown connection id" }, { status: 404 });
  // Tell Sonny so grandma hears it.
  store.tvInbox.push({ id: crypto.randomUUID(), at: new Date().toISOString(), from: who.name, text: `${who.name} connected connection ${c.id}` });
  logEvent("family", `${who.name}: connected the ${c.service} account`, undefined, { visibility: "family" });
  return Response.json({ ok: true, connection: c });
}
