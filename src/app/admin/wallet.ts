import { randomUUID } from "node:crypto";
import { logEvent, store } from "@/lib/store";
import type { WalletEntry } from "@/lib/types";

// One place for money moving in or out of grandma's allowance (amounts in cents).
// Top-ups are demo credits until STRIPE_SECRET_KEY is set; then they go through
// Stripe Checkout in test mode over the REST API (no SDK installed yet).

const g = globalThis as unknown as { __sonjuStripeCredited?: Set<string> };
const credited = (g.__sonjuStripeCredited ??= new Set<string>());

export const stripeEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);

export function credit(amount: number, label: string): WalletEntry {
  const entry: WalletEntry = { id: randomUUID(), at: new Date().toISOString(), amount, label, status: "done", by: "family" };
  store.wallet.balance += amount;
  store.wallet.ledger.push(entry);
  logEvent("task", `Allowance topped up: +$${(amount / 100).toFixed(2)} (${label})`, entry.at, { visibility: "family" });
  return entry;
}

export type TopUpResult = { mode: "demo"; balance: number } | { mode: "stripe"; url: string } | { mode: "error"; message: string };

export async function startTopUp(amount: number, origin: string): Promise<TopUpResult> {
  if (!Number.isInteger(amount) || amount <= 0 || amount > 50000) return { mode: "error", message: "bad amount" };
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    credit(amount, "Demo top-up from Mom");
    return { mode: "demo", balance: store.wallet.balance };
  }
  const body = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/admin/allowance?checkout={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/admin/allowance`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": store.wallet.currency,
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][price_data][product_data][name]": "Allowance top-up for grandma",
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
  if (!res.ok || !json.url) return { mode: "error", message: json.error?.message ?? `Stripe ${res.status}` };
  return { mode: "stripe", url: json.url };
}

// Called when Stripe sends mom back to the admin. Credits a paid session exactly once.
export async function confirmStripeTopUp(sessionId: string): Promise<boolean> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || credited.has(sessionId) || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return false;
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { authorization: `Bearer ${key}` },
  });
  const json = (await res.json().catch(() => ({}))) as { payment_status?: string; amount_total?: number };
  if (!res.ok || json.payment_status !== "paid" || !json.amount_total) return false;
  credited.add(sessionId);
  credit(json.amount_total, "Top-up by card (Stripe test mode)");
  return true;
}

export function setLimit(limit: number): boolean {
  if (!Number.isInteger(limit) || limit < 0 || limit > 100000) return false;
  store.wallet.perSpendLimit = limit;
  return true;
}

// Approve or decline a spend that went over the per-spend limit.
export function decide(id: string, approve: boolean): { ok: boolean; message?: string; label?: string } {
  const entry = store.wallet.ledger.find((e) => e.id === id);
  if (!entry || entry.status !== "pending_approval") return { ok: false, message: "not pending" };
  const cost = Math.abs(entry.amount);
  if (approve && cost > store.wallet.balance) return { ok: false, message: "not enough balance" };
  entry.status = approve ? "done" : "declined";
  if (approve) store.wallet.balance -= cost;
  return { ok: true, label: entry.label };
}
