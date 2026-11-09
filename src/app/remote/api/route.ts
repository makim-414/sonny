import { store } from "@/lib/store";

// POST /remote/api { text } : the phone remote drops a spoken sentence or a key press
// ("key:up", "key:down", "key:ok") into the TV inbox with from: "remote".
// It does not write to the family feed: what grandma says is hers, and the agent
// logs it with the right visibility when it handles the turn.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return Response.json({ error: "need { text }" }, { status: 400 });
  if (text.length > 500) return Response.json({ error: "text is too long" }, { status: 400 });
  const item = { id: crypto.randomUUID(), at: new Date().toISOString(), from: "remote", text };
  store.tvInbox.push(item);
  return Response.json({ ok: true, item }, { status: 201 });
}
