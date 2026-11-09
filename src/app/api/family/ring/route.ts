import { connection } from "next/server";
import { syncShared } from "@/lib/shared-state";
import { store } from "@/lib/store";
import { familyState } from "../state";

// GET /api/family/ring -> the call ringing right now (if any) and calls answered in the
// last minute, with who answered. Polled about once a second by every family phone,
// so the answer is tiny; syncShared costs one small Redis read when nothing changed.
export async function GET() {
  await syncShared();
  await connection();
  const ring = [...store.calls].reverse().find((c) => c.status === "ringing");
  const since = Date.now() - 60_000;
  const handled = Object.entries(familyState.handled)
    .filter(([, h]) => Date.parse(h.at) >= since)
    .map(([id, h]) => ({ id, by: h.by, status: h.status }));
  return Response.json({
    ringing: ring ? { id: ring.id, at: ring.at, reason: ring.reason, script: ring.script, amount: ring.amount, status: ring.status } : null,
    handled,
  });
}
