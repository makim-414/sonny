import { redis, sharedEnabled, syncShared } from "@/lib/shared-state";
import { familyState } from "../state";
import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { decide } from "@/app/admin/wallet";
import { T } from "@/components/family/strings";
import { currentGuardian } from "@/lib/auth/server";
import { logEvent, store } from "@/lib/store";

// GET /api/family/calls -> calls from Sonny that are ringing right now, oldest first.
export async function GET() {
  await syncShared();
  await connection();
  return Response.json({ ringing: store.calls.filter((c) => c.status === "ringing") });
}

type Answer = { id?: string; decision?: "approve" | "decline" | "missed"; name?: string };

// Every family phone rings at once; only the first answer may act. On Vercel two
// instances can see "ringing" at the same moment, so the claim is a Redis SET NX.
// Same rule inside one process: claimed synchronously, before any await, so two requests
// on the same instance cannot both pass the "still ringing" check.
const gl = globalThis as unknown as { __sonnyClaims?: Map<string, string> };
const localClaims = (gl.__sonnyClaims ??= new Map<string, string>());

async function claim(id: string, who: string): Promise<{ ok: true } | { ok: false; by: string }> {
  const mine = localClaims.get(id);
  if (mine !== undefined) return { ok: false, by: mine };
  localClaims.set(id, who);
  if (!sharedEnabled()) return { ok: true };
  const key = `sonny:call-claim:${id}`;
  try {
    const [r] = await redis([["SET", key, who, "NX", "EX", 3600]]);
    if (r === "OK") return { ok: true };
    const [by] = await redis([["GET", key]]);
    const who2 = typeof by === "string" ? by : "Someone";
    localClaims.set(id, who2);
    return { ok: false, by: who2 };
  } catch {
    return { ok: true }; // Redis hiccup: fall back to the status check below
  }
}

const cleanName = (n: unknown) => (typeof n === "string" ? n.replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 24) : "");

// POST /api/family/calls { id, decision } -> mom answered.
//   approve: the pending spend goes through; decline: it is cancelled;
//   missed: mom did not pick up, the spend stays pending in the admin.
// Sonny hears the result through the TV inbox ("Mom approved call <id>").
export async function POST(request: Request) {
  await syncShared();
  const body = (await request.json().catch(() => null)) as Answer | null;
  const call = store.calls.find((c) => c.id === body?.id);
  const decision = body?.decision;
  if (!call || !decision || !["approve", "decline", "missed"].includes(decision)) {
    return Response.json({ error: "need { id, decision: approve | decline | missed }" }, { status: 400 });
  }
  const done = familyState.handled[call.id];
  if (call.status !== "ringing") return Response.json({ error: "already handled", status: call.status, by: done?.by ?? null }, { status: 409 });

  const who = cleanName(body?.name) || (await currentGuardian())?.name || T.mom;
  const c = await claim(call.id, who);
  if (!c.ok) return Response.json({ error: "already handled", status: call.status, by: c.by }, { status: 409 });
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
  familyState.handled[call.id] = { by: who, status: call.status, at };

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

  if (call.reason === "no_answer") {
    // Grandma missed two check-ins. approve: mom calls her; decline: Sonny asks the neighbor.
    const text =
      call.status === "approved"
        ? `${who} approved call ${call.id}: ${who} is calling grandma now.`
        : call.status === "declined"
          ? `${who} declined call ${call.id}: ask grandma's neighbor to check on her.`
          : `${who} missed call ${call.id}: keep trying grandma.`;
    store.tvInbox.push({ id: randomUUID(), at, from: who, text });
    const log = call.status === "approved" ? `${who} is calling grandma` : call.status === "declined" ? `${who} asked Sonny to call the neighbor` : `${who} missed Sonny's call`;
    logEvent("call", `${log}: ${call.script}`, at, { visibility: "family", familyText: log });
    return Response.json({ ok: true, call });
  }

  store.tvInbox.push({ id: randomUUID(), at, from: who, text: `${who} ${verb} call ${call.id}` });
  logEvent("call", `${T.callLog(verb)}: ${call.script}`, at, { visibility: "family", familyText: T.callLog(verb) });
  return Response.json({ ok: true, call });
}
