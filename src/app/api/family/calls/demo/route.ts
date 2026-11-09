import { randomUUID } from "node:crypto";
import { logEvent, store } from "@/lib/store";
import type { GuardianCall, WalletEntry } from "@/lib/types";

// POST /api/family/calls/demo { script?, amount?, label? } -> rings mom's phone with a test call.
// For rehearsals and the video fallback when the agent does not place the call itself.
// It creates the pending spend the call is about, the same shape the agent uses.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { script?: string; amount?: number; label?: string; reason?: string };

  // { reason: "struggle" }: grandma has been stuck on a task for a while; Sonny quietly asks mom.
  if (body.reason === "struggle") {
    const at = new Date().toISOString();
    const script =
      body.script?.trim().slice(0, 400) ||
      "Hi, it's Sonny. Grandma has been trying to book a taxi to the doctor for fifteen minutes, and she can't remember the clinic's name. Shall I book Dr. Kim's clinic for her, or would you like to call her?";
    const call: GuardianCall = { id: randomUUID(), at, script, amount: 0, reason: "struggle", status: "ringing" };
    store.calls.push(call);
    logEvent("call", `Sonny is calling: ${script}`, at, { visibility: "family", familyText: "Sonny called: grandma needs a hand with a taxi" });
    return Response.json({ ok: true, call }, { status: 201 });
  }

  // { reason: "nudge" }: Sonny suggests mom calls grandma, with something to talk about. No money.
  if (body.reason === "nudge") {
    const at = new Date().toISOString();
    const script =
      body.script?.trim().slice(0, 400) ||
      "Hi, it's Sonny. Grandma went to the temple this morning and has been quiet since lunch. She'd love to hear your voice. You could ask about the kimchi she just made.";
    const call: GuardianCall = { id: randomUUID(), at, script, amount: 0, reason: "nudge", status: "ringing" };
    store.calls.push(call);
    logEvent("call", `Sonny is calling: ${script}`, at, { visibility: "family", familyText: "Sonny called: grandma would love a call" });
    return Response.json({ ok: true, call }, { status: 201 });
  }
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
