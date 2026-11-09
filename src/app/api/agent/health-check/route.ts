import { runAgent } from "@/lib/agent/run";

// POST /api/agent/health-check { kind: "bp" | "mind", now? } : start a check right away
// (demo button). Returns an AgentReply for the screen to speak. Grandma's answers then
// go to POST /api/agent as usual voice turns.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { kind?: string; now?: string } | null;
  const kind = body?.kind === "mind" ? "mind" : body?.kind === "bp" ? "bp" : null;
  if (!kind) return Response.json({ error: "need { kind: bp | mind }" }, { status: 400 });
  return Response.json(await runAgent({ text: `health-check:${kind}`, source: "proactive", now: body?.now }));
}
