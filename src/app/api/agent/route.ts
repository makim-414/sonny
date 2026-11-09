import { runAgent } from "@/lib/agent/run";
import type { AgentRequest } from "@/lib/types";

// POST /api/agent: AgentRequest in, AgentReply out (+ meta for debugging).
export async function POST(request: Request) {
  let body: Partial<AgentRequest>;
  try {
    body = (await request.json()) as Partial<AgentRequest>;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (typeof body.text !== "string" || !body.text.trim()) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }
  const source = body.source === "proactive" || body.source === "family" ? body.source : "voice";
  // x-hyodo-model: debug override for latency comparisons (claude-* ids only).
  const override = request.headers.get("x-hyodo-model");
  const model = override && /^claude-[a-z0-9-]+$/.test(override) ? override : undefined;
  const reply = await runAgent({ text: body.text, source, now: body.now }, { model });
  return Response.json(reply);
}
