import { store } from "@/lib/store";
import type { WalletEntry } from "@/lib/types";

// Grandma's allowance. Demo money only: nothing is charged anywhere.
// At or under the per-spend limit (and with enough balance) it is paid at once;
// otherwise the spend waits for the family's OK.

export type SpendResult = {
  status: "done" | "pending_approval";
  entry: WalletEntry;
  balance: number;
  reason?: "over_limit" | "not_enough_left";
};

export function spend(cents: number, label: string, at: string): SpendResult {
  const w = store.wallet;
  const ok = cents <= w.perSpendLimit && w.balance >= cents;
  const entry: WalletEntry = {
    id: crypto.randomUUID(),
    at,
    amount: -cents,
    label,
    status: ok ? "done" : "pending_approval",
    by: "grandma",
  };
  if (ok) w.balance -= cents;
  w.ledger.push(entry);
  const reason = ok ? undefined : cents > w.perSpendLimit ? "over_limit" : "not_enough_left";
  return { status: entry.status as SpendResult["status"], entry, balance: w.balance, reason };
}

/** The family approved a pending spend: take it from the allowance now. */
export function settle(entryId: string): WalletEntry | null {
  const w = store.wallet;
  const entry = w.ledger.find((e) => e.id === entryId);
  if (!entry || entry.status !== "pending_approval") return null;
  entry.status = "done";
  w.balance += entry.amount; // amount is negative
  return entry;
}

export function walletSnapshot() {
  const w = store.wallet;
  return {
    balanceCents: w.balance,
    limitCents: w.perSpendLimit,
    pending: w.ledger.filter((e) => e.status === "pending_approval").length,
    recent: w.ledger.slice(-3).map((e) => ({ label: e.label, cents: e.amount, status: e.status })),
  };
}
