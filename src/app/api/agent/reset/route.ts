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
  // Wallet back to the demo seed ($80, family OK above $30), same as store.ts.
  store.wallet = {
    currency: "usd",
    balance: 8000,
    perSpendLimit: 3000,
    ledger: [
      { id: "seed-topup", at: new Date().toISOString(), amount: 8000, label: "Weekly allowance from Mom (demo data)", status: "done", by: "family" },
    ],
  };
  const memory = await getMemory();
  return Response.json({ ok: true, memory: memory.backend, facts: (await memory.all()).length });
}
