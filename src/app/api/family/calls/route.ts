import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { decide } from "@/app/admin/wallet";
import { T } from "@/components/family/strings";
import { currentGuardian } from "@/lib/auth/server";
import { logEvent, store } from "@/lib/store";

// GET /api/family/calls -> calls from Sonny that are ringing right now, oldest first.
export async function GET() {
  await connection();
  return Response.json({ ringing: store.calls.filter((c) => c.status === "ringing") });
}

type Answer = { id?: string; decision?: "approve" | "decline" | "missed" };

// POST /api/family/calls { id, decision } -> mom answered.
//   approve: the pending spend goes through; decline: it is cancelled;
//   missed: mom did not pick up, the spend stays pending in the admin.
// Sonny hears the result through the TV inbox ("Mom approved call <id>").
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Answer | null;
  const call = store.calls.find((c) => c.id === body?.id);
  const decision = body?.decision;
  if (!call || !decision || !["approve", "decline", "missed"].includes(decision)) {
    return Response.json({ error: "need { id, decision: approve | decline | missed }" }, { status: 400 });
  }
  if (call.status !== "ringing") return Response.json({ error: "call is not ringing", status: call.status }, { status: 409 });

  const who = (await currentGuardian())?.name ?? T.mom;
  if (decision === "missed") {
    call.status = "missed";
  } else {
    // Nudge calls carry no spend; only spend calls settle a wallet entry.
    if (call.walletEntryId) {
      const r = decide(call.walletEntryId, decision === "approve");
      // The spend may already have been settled in the admin; the call still records mom's answer.
      if (!r.ok && r.message !== "not pending") return Response.json({ error: r.message }, { status: 409 });
    }
    call.status = decision === "approve" ? "approved" : "declined";
  }

  const verb = call.status === "approved" ? "approved" : call.status === "declined" ? "declined" : "missed";
  const at = new Date().toISOString();

  if (call.reason === "struggle") {
    // Grandma got stuck on a task. approve: Sonny finishes it for her; decline: mom calls her herself.
    const text =
      call.status === "approved"
        ? `${who} approved call ${call.id}: book it for grandma now and tell her it's done.`
        : call.status === "declined"
          ? `${who} declined call ${call.id}: ${who} will call grandma to help. Tell grandma "${who}'s going to call you."`
          : `${who} missed call ${call.id}: keep helping grandma gently.`;
    store.tvInbox.push({ id: randomUUID(), at, from: who, text });
    logEvent("call", `${T.struggleLog(verb)}: ${call.script}`, at, { visibility: "family", familyText: T.struggleLog(verb) });
    return Response.json({ ok: true, call });
  }

  if (call.reason === "nudge") {
    // A nudge has no money in it: "approve" means she is calling grandma now,
    // anything else means "remind me at 7 PM".
    const now = call.status === "approved";
    const text = now
      ? `${who} approved call ${call.id}: ${who} is calling grandma now. Tell grandma "${who}'s going to call you."`
      : `${who} missed call ${call.id}: ${who} will call grandma at 7 PM.`;
    store.tvInbox.push({ id: randomUUID(), at, from: who, text });
    logEvent("call", `${T.nudgeLog(verb)}: ${call.script}`, at, { visibility: "family", familyText: T.nudgeLog(verb) });
    if (!now) logEvent("task", T.nudgeReminder, at, { visibility: "family" });
    return Response.json({ ok: true, call });
  }

  store.tvInbox.push({ id: randomUUID(), at, from: who, text: `${who} ${verb} call ${call.id}` });
  logEvent("call", `${T.callLog(verb)}: ${call.script}`, at, { visibility: "family", familyText: T.callLog(verb) });
  return Response.json({ ok: true, call });
}
