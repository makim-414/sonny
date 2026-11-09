import { syncShared } from "@/lib/shared-state";
import { familyState } from "@/app/api/family/state";
import { resetSession } from "@/lib/agent/session";
import { shared } from "@/lib/agent/tools";
import { resetWatch } from "@/lib/agent/watch";
import { resetConnections } from "@/lib/agent/connections";
import { ensureHeadsUp, resetWellness } from "@/lib/agent/wellness";
import { getMemory, resetMemory } from "@/lib/memory";
import { store } from "@/lib/store";

// POST /api/agent/reset : demo reset before a recording. Memory back to the seed (a new
// GBrain run entity); conversation, health log, pending approvals, calls, the TV inbox,
// TV timers, mom's feed and her approvals cleared; wallet back to $80.
export async function POST() {
  await syncShared();
  resetSession();
  await resetMemory();
  shared.health.length = 0;
  shared.requests.length = 0;
  shared.lastLater = undefined;
  shared.confirmOrder = undefined;
  shared.offer = undefined;
  shared.lastRide = undefined;
  store.tvInbox.length = 0; // approvals or messages left from an earlier run
  store.events.length = 0; // mom's feed starts empty for the next recording
  // Family app approvals from the last run. Paired devices and routines stay.
  familyState.approvedIds.length = 0;
  resetWatch();
  resetConnections();
  resetWellness();
  store.calls.length = 0;
  ensureHeadsUp(); // the demo week's "forgot the clinic's name twice" note, back in mom's feed
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
