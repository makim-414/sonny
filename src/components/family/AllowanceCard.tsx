"use client";

import { useState } from "react";
import { T } from "./strings";

// Grandma's allowance on mom's phone: balance, this week's spending, the per-purchase
// limit, and top-ups from the signed-in member's card (demo payment).

export type WalletSummary = { currency: "usd" | "krw"; balance: number; perSpendLimit: number; spentThisWeek: number };
export type Me = { name: string; relation: string; role: "admin" | "member"; email: string; card: string };

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat(T.locale, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

export default function AllowanceCard({ wallet, onChanged }: { wallet: WalletSummary | null; onChanged: () => void }) {
  const [other, setOther] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const add = async (cents: number) => {
    if (busy || !Number.isFinite(cents) || cents <= 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/family/topup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: cents }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { by: string; card: string; amount: number };
      setNotice(T.added(money(j.amount, wallet?.currency ?? "usd"), j.by, j.card));
      setOther(false);
      setValue("");
      onChanged();
    } catch {
      setNotice(T.topupFail);
    } finally {
      setBusy(false);
    }
  };

  if (!wallet) return null;
  const c = wallet.currency;
  return (
    <section className="fa-allowance" aria-label={T.allowanceTitle}>
      <div className="fa-allowance-head">
        <h2 className="fa-summary-title">{T.allowanceTitle}</h2>
        <p className="fa-allowance-balance">{money(wallet.balance, c)}</p>
      </div>
      <dl className="fa-stats fa-stats-2">
        <div>
          <dt>{T.spentWeek}</dt>
          <dd>{money(wallet.spentThisWeek, c)}</dd>
        </div>
        <div>
          <dt>{T.perLimit}</dt>
          <dd>{money(wallet.perSpendLimit, c)}</dd>
        </div>
      </dl>
      <div className="fa-allowance-actions">
        <button className="fa-btn fa-btn-primary" disabled={busy} onClick={() => void add(2000)}>
          + {money(2000, c)}
        </button>
        <button className="fa-btn fa-btn-primary" disabled={busy} onClick={() => void add(5000)}>
          + {money(5000, c)}
        </button>
        <button className="fa-btn" disabled={busy} aria-expanded={other} onClick={() => setOther((o) => !o)}>
          {T.addOther}
        </button>
      </div>
      {other && (
        <form
          className="fa-form"
          onSubmit={(e) => {
            e.preventDefault();
            void add(Math.round(Number(value) * 100));
          }}
        >
          <input
            className="fa-input"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
            aria-label={T.amountLabel}
            placeholder={T.amountLabel}
            autoFocus
          />
          <button className="fa-btn fa-btn-primary" type="submit" disabled={busy || !(Number(value) >= 1)}>
            {T.addAmount}
          </button>
        </form>
      )}
      {notice && (
        <p className="fa-notice" role="status">
          {notice}
        </p>
      )}
      <p className="fa-allowance-demo">{T.demoPay}</p>
    </section>
  );
}
