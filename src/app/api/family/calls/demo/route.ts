import { randomUUID } from "node:crypto";
import { logEvent, store } from "@/lib/store";
import type { GuardianCall, WalletEntry } from "@/lib/types";

// POST /api/family/calls/demo { script?, amount?, label? } -> rings mom's phone with a test call.
// For rehearsals and the video fallback when the agent does not place the call itself.
// It creates the pending spend the call is about, the same shape the agent uses.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { script?: string; amount?: number; label?: string };
  const amount = Number.isInteger(body.amount) && body.amount! > 0 ? body.amount! : 4800;
  const label = body.label?.trim().slice(0, 80) || "Groceries for two (demo data)";
  const at = new Date().toISOString();

  const entry: WalletEntry = { id: randomUUID(), at, amount: -amount, label, status: "pending_approval", by: "grandma" };
  store.wallet.ledger.push(entry);

  const dollars = `$${(amount / 100).toFixed(2)}`;
  const script =
    body.script?.trim().slice(0, 400) ||
    `Hi, it's Sonny. Grandma asked me to order ${label.replace(/ \(demo data\)$/, "").toLowerCase()} for ${dollars}. That's over her $${(store.wallet.perSpendLimit / 100).toFixed(0)} limit. Should I go ahead?`;
  const call: GuardianCall = { id: randomUUID(), at, walletEntryId: entry.id, script, amount, reason: "over_limit", status: "ringing" };
  store.calls.push(call);
  logEvent("call", `Sonny is calling: ${script}`, at, { visibility: "family", familyText: `Sonny called about ${label} (${dollars})` });
  return Response.json({ ok: true, call }, { status: 201 });
}
