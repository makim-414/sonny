import { resetSession } from "@/lib/agent/session";
import { getMemory, resetMemory } from "@/lib/memory";
import { store } from "@/lib/store";

// POST /api/agent/reset : demo reset (memory back to seed, conversation cleared, timers dropped).
export async function POST() {
  resetSession();
  await resetMemory();
  store.pending.length = 0;
  store.currentChannel = null;
  return Response.json({ ok: true, memory: (await getMemory()).backend });
}
