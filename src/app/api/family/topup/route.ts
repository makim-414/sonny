import { randomUUID } from "node:crypto";
import { credit } from "@/app/admin/wallet";
import { currentGuardian } from "@/lib/auth/server";
import { memberByEmail } from "@/lib/auth/members";
import { store } from "@/lib/store";

// POST /api/family/topup { amount } (cents) -> the signed-in family member adds to
// grandma's allowance from their card. Demo payment: no card is charged.
// Sonny hears it through the inbox and tells grandma who added it.
export async function POST(request: Request) {
  const guardian = await currentGuardian();
  if (!guardian) return Response.json({ error: "sign in as family" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { amount?: unknown } | null;
  const amount = typeof body?.amount === "number" ? Math.round(body.amount) : NaN;
  if (!Number.isInteger(amount) || amount < 100 || amount > 50000) {
    return Response.json({ error: "amount must be between $1 and $500" }, { status: 400 });
  }

  const member = memberByEmail(guardian.email);
  const name = member?.name ?? guardian.name;
  const card = member?.card ?? "4242";
  const dollars = `$${(amount / 100).toFixed(amount % 100 ? 2 : 0)}`;

  credit(amount, `Added by ${name}, card ending ${card} (demo)`);
  store.tvInbox.push({
    id: randomUUID(),
    at: new Date().toISOString(),
    from: name,
    text: `${name} added ${dollars} to grandma's allowance. Tell grandma: "${name} added ${dollars} to your allowance."`,
  });

  return Response.json({ ok: true, balance: store.wallet.balance, by: name, card, amount });
}
