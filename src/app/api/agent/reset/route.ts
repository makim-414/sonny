import { resetSession } from "@/lib/agent/session";
import { shared } from "@/lib/agent/tools";
import { getMemory, resetMemory } from "@/lib/memory";
import { store } from "@/lib/store";

// POST /api/agent/reset : demo reset. Memory back to seed (a new GBrain run entity),
// conversation, health log, pending approvals and TV timers cleared.
export async function POST() {
  resetSession();
  await resetMemory();
  shared.health.length = 0;
  shared.requests.length = 0;
  shared.lastLater = undefined;
  store.pending.length = 0;
  store.currentChannel = null;
  const memory = await getMemory();
  return Response.json({ ok: true, memory: memory.backend, facts: (await memory.all()).length });
}
