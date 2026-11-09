import { resetSession } from "@/lib/agent/session";
import { resetJsonMemory } from "@/lib/memory/json-store";
import { store } from "@/lib/store";

// POST /api/agent/reset : demo reset (memory back to seed, conversation cleared, timers dropped).
export async function POST() {
  resetSession();
  await resetJsonMemory();
  store.pending.length = 0;
  return Response.json({ ok: true });
}
