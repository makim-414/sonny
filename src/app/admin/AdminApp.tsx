"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { encode } from "uqr";
import FamilyApp from "@/components/family/FamilyApp";
import IncomingCall from "@/components/family/IncomingCall";
import LightPage from "@/components/family/LightPage";
import { clock } from "@/components/family/derive";
import { T } from "@/components/family/strings";
import type { WalletEntry } from "@/lib/types";
import type { Routine } from "@/app/api/family/state";
import { logout } from "../login/actions";
import { addRoutine, confirmTopUp, createPairLink, decideSpend, removeRoutine, topUp, updateLimit } from "./actions";
import { A } from "./strings";

const TABS = ["today", "taught", "routines", "allowance", "privacy", "device"] as const;
type Tab = (typeof TABS)[number];

type AdminData = {
  guardian: { name: string; email: string };
  taught: { lessons: { id: string; text: string; at: string; provenance?: string }[]; personalCount: number; memoryBackend: string };
  routines: Routine[];
  wallet: { currency: "usd" | "krw"; balance: number; perSpendLimit: number; ledger: WalletEntry[]; stripe: boolean };
  privacy: { shown: number; summaryOnly: number; hidden: number };
  device: { paired: { id: string; pairedAt: string; label: string }[]; lastTalk: string };
};

const POLL_MS = 3000;

function money(cents: number, currency: "usd" | "krw") {
  return new Intl.NumberFormat(T.locale, { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: currency === "krw" ? 0 : 2 }).format(
    currency === "krw" ? cents : cents / 100,
  );
}

function Qr({ text }: { text: string }) {
  const { d, size } = useMemo(() => {
    const { data } = encode(text, { border: 2 });
    let path = "";
    data.forEach((row, y) => row.forEach((on, x) => on && (path += `M${x} ${y}h1v1h-1z`)));
    return { d: path, size: data.length };
  }, [text]);
  return (
    <svg className="ad-qr" viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label={A.connect}>
      <rect className="ad-qr-bg" width={size} height={size} />
      <path className="ad-qr-fg" d={d} />
    </svg>
  );
}

export default function AdminApp() {
  const [tab, setTab] = useState<Tab>("today");
  const [data, setData] = useState<AdminData | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/admin/data", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login?next=/admin";
        return;
      }
      if (res.ok) setData((await res.json()) as AdminData);
    } catch {
      // keep the last data on screen
    }
  }, []);

  // Tab from the URL, and the Stripe return trip (?checkout=cs_...).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    const fromUrl = TABS.find((x) => x === t);
    const checkout = params.get("checkout");
    const id = setTimeout(() => {
      if (fromUrl) setTab(fromUrl);
      if (checkout) void confirmTopUp(checkout).then(() => refresh());
    }, 0);
    return () => clearTimeout(id);
  }, [refresh]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const id = setInterval(refresh, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(id);
  }, [notice]);

  const choose = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    url.searchParams.delete("checkout");
    window.history.replaceState(null, "", url);
  };

  const run = (fn: () => Promise<unknown>, ok?: string) =>
    startTransition(async () => {
      try {
        await fn();
        if (ok) setNotice(ok);
      } catch {
        setNotice(A.error);
      }
      await refresh();
    });

  return (
    <div className="fa ad theme-light">
      <LightPage />
      <IncomingCall />
      <header className="fa-header ad-header">
        <div>
          <h1 className="fa-title">{A.title}</h1>
          <p className="fa-sub">{data ? A.signedInAs(data.guardian.name) : T.loading}</p>
        </div>
        <form action={logout}>
          <button className="ad-link" type="submit">
            {A.signOut}
          </button>
        </form>
      </header>

      <nav className="ad-tabs" aria-label={A.title}>
        {TABS.map((t) => (
          <button key={t} className={t === tab ? "ad-tab is-on" : "ad-tab"} aria-current={t === tab ? "page" : undefined} onClick={() => choose(t)}>
            {A.tabs[t]}
          </button>
        ))}
      </nav>

      {notice && (
        <p className="fa-notice ad-notice" role="status">
          {notice}
        </p>
      )}

      {tab === "today" && <FamilyApp embedded />}
      {tab === "taught" && data && <Taught data={data} />}
      {tab === "routines" && data && <Routines data={data} busy={pending} run={run} />}
      {tab === "allowance" && data && <Allowance data={data} busy={pending} run={run} />}
      {tab === "privacy" && data && <Privacy data={data} />}
      {tab === "device" && data && <Device data={data} />}
    </div>
  );
}

type RunFn = (fn: () => Promise<unknown>, ok?: string) => void;

function Taught({ data }: { data: AdminData }) {
  const { lessons, personalCount, memoryBackend } = data.taught;
  return (
    <section className="ad-section">
      <div className="ad-hero">
        <span className="ad-hero-num">{lessons.length}</span>
        <span className="ad-hero-text">{A.taughtCount(lessons.length)}</span>
      </div>
      <h2 className="fa-section-title">{A.taughtTitle}</h2>
      {lessons.length === 0 ? (
        <p className="fa-empty">{A.taughtNone}</p>
      ) : (
        <ol className="fa-list">
          {lessons.map((l) => (
            <li key={l.id} className="fa-item fa-tone-memory">
              <p className="fa-item-text">{l.text}</p>
              {l.provenance && <p className="ad-caption">{l.provenance}</p>}
            </li>
          ))}
        </ol>
      )}
      <p className="fa-private">{A.personalHidden(personalCount)}</p>
      <p className="ad-caption ad-center">{A.memoryFrom(memoryBackend)}</p>
    </section>
  );
}

function Routines({ data, busy, run }: { data: AdminData; busy: boolean; run: RunFn }) {
  const [kind, setKind] = useState<Routine["kind"]>("pills");
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("08:00");
  const [days, setDays] = useState("");
  return (
    <section className="ad-section">
      <h2 className="fa-section-title">{A.routinesTitle}</h2>
      <p className="ad-caption">{A.routinesHint}</p>
      <form
        className="ad-card ad-form"
        onSubmit={(e) => {
          e.preventDefault();
          const l = label.trim() || A.labelPh;
          const d = days.trim() || A.daysPh;
          run(async () => {
            const r = await addRoutine({ kind, label: l, time, days: d });
            if (!r.ok) throw new Error("bad");
            setLabel("");
            setDays("");
          }, A.saved);
        }}
      >
        <div className="ad-seg" role="radiogroup" aria-label={A.label}>
          {(["pills", "outing", "doctor"] as const).map((k) => (
            <button type="button" key={k} role="radio" aria-checked={k === kind} className={k === kind ? "ad-seg-btn is-on" : "ad-seg-btn"} onClick={() => setKind(k)}>
              {A.kinds[k]}
            </button>
          ))}
        </div>
        <label className="ad-field">
          <span>{A.label}</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={A.labelPh} maxLength={60} />
        </label>
        <div className="ad-row">
          <label className="ad-field">
            <span>{A.time}</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </label>
          <label className="ad-field">
            <span>{A.days}</span>
            <input value={days} onChange={(e) => setDays(e.target.value)} placeholder={A.daysPh} maxLength={40} />
          </label>
        </div>
        <button className="fa-btn fa-btn-primary" type="submit" disabled={busy}>
          {A.add}
        </button>
      </form>
      {data.routines.length === 0 ? (
        <p className="fa-empty">{A.routinesNone}</p>
      ) : (
        <ol className="fa-list">
          {data.routines.map((r) => (
            <li key={r.id} className="fa-item ad-routine">
              <div>
                <span className="fa-item-label">{A.kinds[r.kind]}</span>
                <p className="fa-item-text">{r.label}</p>
                <p className="ad-caption">
                  {r.time} · {r.days}
                </p>
              </div>
              <button className="ad-link" disabled={busy} onClick={() => run(() => removeRoutine(r.id))}>
                {A.remove}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Allowance({ data, busy, run }: { data: AdminData; busy: boolean; run: RunFn }) {
  const w = data.wallet;
  const [limit, setLimit] = useState(String(w.perSpendLimit / 100));
  const waiting = w.ledger.filter((e) => e.status === "pending_approval");
  const history = w.ledger.filter((e) => e.status !== "pending_approval");

  const top = (cents: number) =>
    run(async () => {
      const r = await topUp(cents);
      if (r.mode === "stripe") window.location.href = r.url;
      if (r.mode === "error") throw new Error(r.message);
    });

  return (
    <section className="ad-section">
      <div className="ad-hero">
        <span className="ad-hero-text">{A.balance}</span>
        <span className="ad-hero-num">{money(w.balance, w.currency)}</span>
      </div>

      <div className="ad-card">
        <h2 className="fa-section-title">{A.topUp}</h2>
        <div className="ad-row">
          {[2000, 5000].map((c) => (
            <button key={c} className="fa-btn fa-btn-primary" disabled={busy} onClick={() => top(c)}>
              + {money(c, w.currency)}
            </button>
          ))}
        </div>
        <p className="ad-caption">{w.stripe ? A.stripeTopUp : A.demoTopUp}</p>
      </div>

      {waiting.length > 0 && (
        <div className="ad-waiting">
          <h2 className="fa-section-title">{A.waiting}</h2>
          {waiting.map((e) => (
            <article key={e.id} className="fa-approval">
              <div className="fa-approval-head">
                <h3>{money(Math.abs(e.amount), w.currency)}</h3>
                <time>{clock(e.at)}</time>
              </div>
              <p>{e.label}</p>
              <div className="fa-approval-actions">
                <button className="fa-btn fa-btn-primary" disabled={busy} onClick={() => run(() => decideSpend(e.id, true), T.approved)}>
                  {A.approve}
                </button>
                <button className="fa-btn" disabled={busy} onClick={() => run(() => decideSpend(e.id, false), A.declined)}>
                  {A.decline}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <form
        className="ad-card ad-form"
        onSubmit={(e) => {
          e.preventDefault();
          const cents = Math.round(Number(limit) * 100);
          run(async () => {
            const r = await updateLimit(cents);
            if (!r.ok) throw new Error("bad");
          }, A.saved);
        }}
      >
        <label className="ad-field">
          <span>{A.limit}</span>
          <div className="ad-row">
            <input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} aria-label={A.limit} />
            <button className="fa-btn" type="submit" disabled={busy}>
              {A.save}
            </button>
          </div>
        </label>
        <p className="ad-caption">{A.limitHint}</p>
      </form>

      <h2 className="fa-section-title">{A.recent}</h2>
      {history.length === 0 ? (
        <p className="fa-empty">{A.noSpend}</p>
      ) : (
        <ol className="fa-list">
          {history.map((e) => (
            <li key={e.id} className="fa-item ad-ledger">
              <div>
                <p className="fa-item-text">{e.label}</p>
                <p className="ad-caption">
                  {clock(e.at)}
                  {e.status === "declined" ? ` · ${A.declined}` : ""}
                </p>
              </div>
              <span className={e.amount >= 0 ? "ad-amount is-in" : "ad-amount"}>
                {e.amount >= 0 ? "+" : "-"}
                {money(Math.abs(e.amount), w.currency)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Privacy({ data }: { data: AdminData }) {
  const p = data.privacy;
  const rows = [
    { title: A.privacyShown, body: A.privacyShownBody, n: p.shown, tone: "fa-tone-family" },
    { title: A.privacySummary, body: A.privacySummaryBody, n: p.summaryOnly, tone: "fa-tone-info" },
    { title: A.privacyHidden, body: A.privacyHiddenBody, n: p.hidden, tone: "fa-tone-tv" },
  ];
  return (
    <section className="ad-section">
      <h2 className="fa-section-title">{A.privacyTitle}</h2>
      <ol className="fa-list">
        {rows.map((r) => (
          <li key={r.title} className={`fa-item ${r.tone}`}>
            <div className="fa-item-meta">
              <span className="fa-item-label">{r.title}</span>
              <span className="ad-caption">
                {r.n} {A.today}
              </span>
            </div>
            <p className="fa-item-text">{r.body}</p>
          </li>
        ))}
      </ol>
      <p className="ad-caption">{A.privacyNote}</p>
    </section>
  );
}

function Device({ data }: { data: AdminData }) {
  const [link, setLink] = useState<{ url: string; exp: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, startTransition] = useTransition();
  const d = data.device;
  return (
    <section className="ad-section">
      <h2 className="fa-section-title">{A.deviceTitle}</h2>
      <div className="ad-card">
        <p className="fa-summary-line">{d.paired.length ? A.paired(d.paired.length) : A.notPaired}</p>
        <p className="ad-caption">{d.lastTalk ? A.lastTalk(d.lastTalk) : A.noTalk}</p>
      </div>
      <p className="ad-caption">{A.deviceHint}</p>
      <button
        className="fa-btn fa-btn-primary ad-wide"
        disabled={busy}
        onClick={() => startTransition(async () => setLink(await createPairLink()))}
      >
        {A.connect}
      </button>
      {link && (
        <div className="ad-card ad-pair">
          <Qr text={link.url} />
          <p className="ad-caption">{A.expires(15)}</p>
          <p className="ad-caption ad-url" data-testid="pair-url">
            {link.url}
          </p>
          <button
            className="ad-link"
            onClick={() =>
              navigator.clipboard
                ?.writeText(link.url)
                .then(() => setCopied(true))
                .catch(() => setCopied(false))
            }
          >
            {copied ? A.copied : A.copy}
          </button>
        </div>
      )}
    </section>
  );
}
