"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityEvent } from "@/lib/types";
import { clock, toFeedItem, type FeedItem, type Summary } from "./derive";
import { switchMember } from "@/app/family/actions";
import AllowanceCard, { type Me, type WalletSummary } from "./AllowanceCard";
import HealthCard from "./HealthCard";
import WeekDashboard from "./WeekDashboard";
import IncomingCall from "./IncomingCall";
import JoinCard from "./JoinCard";
import LightPage from "./LightPage";
import { T } from "./strings";
import "./family.css";

const POLL_MS = 2000;


type FamilyData = {
  events: ActivityEvent[];
  hiddenCount: number;
  summary: Summary | null;
  approvedIds: string[];
  me?: Me | null;
  members?: { email: string; name: string; relation: string; role: "admin" | "member" }[];
  wallet?: WalletSummary;
};

// A skill grandma taught that needs an account mom connects once (see lib/agent/connections.ts).
const CONNECTION_TAG = /\s*\(connection [\w-]+\)/;
const isConnect = (text: string) => CONNECTION_TAG.test(text) || /Connect her \w+ account\?/i.test(text);

const EMPTY: FamilyData = { events: [], hiddenCount: 0, summary: null, approvedIds: [] };

export default function FamilyApp({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<FamilyData>(EMPTY);
  const [online, setOnline] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sent, setSent] = useState<{ text: string; afterId: string | null } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/family", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as FamilyData);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

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

  // Newest first, like any messaging app.
  const feed = useMemo(() => data.events.map(toFeedItem).reverse(), [data.events]);
  const pending = feed.filter(
    (f) => f.request && !data.approvedIds.includes(f.event.id) && !dismissed.includes(f.event.id),
  );

  // After mom sends something, wait for grandma's answer to come back as a summary.
  const reply = useMemo(() => {
    if (!sent) return null;
    const start = sent.afterId ? data.events.findIndex((e) => e.id === sent.afterId) + 1 : 0;
    const later = data.events.slice(start).map(toFeedItem);
    return later.reverse().find((f) => f.tone === "info") ?? null;
  }, [sent, data.events]);

  async function post(body: Record<string, string>) {
    const res = await fetch("/api/family", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(String(res.status));
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const afterId = data.events.at(-1)?.id ?? null;
      await post({ text: t });
      setDraft("");
      setSent({ text: t, afterId });
      refresh();
    } catch {
      setNotice(T.sendFail);
    } finally {
      setSending(false);
    }
  }

  async function approve(item: FeedItem) {
    setBusyId(item.event.id);
    try {
      await post({ approve: item.event.id });
      setNotice(isConnect(item.event.text) ? T.connected : item.request === "taxi" ? T.approvedTaxi : T.approvedOrder);
      refresh();
    } catch {
      setNotice(T.approveFail);
    } finally {
      setBusyId(null);
    }
  }

  const s = data.summary;
  const medLabel = !s ? "·" : s.medicine === "taken" ? T.medsTaken : s.medicine === "asked" ? T.medsAsked : T.medsUnknown;

  return (
    <div className={embedded ? "fa fa-embedded" : "fa theme-light"}>
      {!embedded && <LightPage />}
      {!embedded && <IncomingCall />}
      {!embedded && <JoinCard />}
      <header className="fa-header">
        <div>
          <h1 className="fa-title">{T.title}</h1>
          <p className="fa-sub">{online ? T.online : T.offline}</p>
        </div>
        <span className={online ? "fa-live" : "fa-live fa-live-off"} aria-hidden />
      </header>
      {!embedded && data.me && (
        <div className="fa-member">
          <p className="fa-member-name">
            {data.me.name} · {data.me.relation}
          </p>
          {data.members && data.members.length > 1 && (
            <select
              className="fa-member-switch"
              aria-label={T.switchMember}
              value={data.me.email}
              onChange={(e) => void switchMember(e.target.value).then(() => refresh())}
            >
              {data.members.map((m) => (
                <option key={m.email} value={m.email}>
                  {m.name} · {m.relation}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <section className="fa-summary" aria-label={T.todayTitle}>
        <h2 className="fa-summary-title">{T.todayTitle}</h2>
        {s?.reassure && <p className={`fa-reassure fa-reassure-${s.reassure.tone}`}>{s.reassure.text}</p>}
        <p className="fa-summary-line">{s ? s.sentence : T.loading}</p>
        <dl className="fa-stats">
          <div>
            <dt>{T.statLastTalk}</dt>
            <dd>{s?.lastTalk || "·"}</dd>
          </div>
          <div>
            <dt>{T.statMeds}</dt>
            <dd className={s?.medicine === "taken" ? "fa-ok" : undefined}>{medLabel}</dd>
          </div>
          <div>
            <dt>{T.statNow}</dt>
            <dd>{s?.tv ?? "·"}</dd>
          </div>
        </dl>
      </section>

      <AllowanceCard wallet={data.wallet ?? null} onChanged={() => void refresh()} />

      <WeekDashboard />

      <HealthCard />

      {pending.length > 0 && (
        <section className="fa-approvals" aria-label={T.approvalsLabel}>
          {pending.map((p) => (
            <article key={p.event.id} className="fa-approval">
              <div className="fa-approval-head">
                <h3>{isConnect(p.event.text) ? T.lSkill : p.label}</h3>
                <time>{clock(p.event.at)}</time>
              </div>
              <p>{p.text.replace(CONNECTION_TAG, "")}</p>
              <div className="fa-approval-actions">
                <button className="fa-btn fa-btn-primary" disabled={busyId === p.event.id} onClick={() => approve(p)}>
                  {busyId === p.event.id ? T.approving : isConnect(p.event.text) ? T.connect : T.approve}
                </button>
                <button className="fa-btn" onClick={() => setDismissed((d) => [...d, p.event.id])}>
                  {T.later}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="fa-composer" aria-label={T.sendTitle}>
        {notice && (
          <p className="fa-notice" role="status">
            {notice}
          </p>
        )}
        <h2 className="fa-section-title">{T.sendTitle}</h2>
        <p className="fa-hint">{T.sendHint}</p>
        <div className="fa-quick">
          {T.quick.map((q) => (
            <button key={q} className="fa-quick-btn" disabled={sending} onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>
        <form
          className="fa-form"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <input
            className="fa-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={T.inputPlaceholder}
            aria-label={T.inputLabel}
            maxLength={500}
          />
          <button className="fa-btn fa-btn-primary" type="submit" disabled={sending || !draft.trim()}>
            {T.send}
          </button>
        </form>
      </section>
      {sent && (
        <section className="fa-reply" aria-live="polite" aria-label={T.sentLabel}>
          <p className="fa-reply-sent">
            <span>{T.sentLabel}</span> {sent.text}
          </p>
          {reply ? (
            <p className="fa-reply-answer">
              <span>{T.replyLabel}</span> {reply.text}
            </p>
          ) : (
            <p className="fa-reply-wait">{T.replyWait}</p>
          )}
        </section>
      )}

      <section className="fa-feed" aria-label={T.feedTitle}>
        <h2 className="fa-section-title">{T.feedTitle}</h2>
        {feed.length === 0 ? (
          <p className="fa-empty">{T.empty}</p>
        ) : (
          <ol className="fa-list">
            {feed.map((f) => {
              const approved = f.request && data.approvedIds.includes(f.event.id);
              return (
                <li key={f.event.id} className={`fa-item fa-tone-${f.tone}`}>
                  <div className="fa-item-meta">
                    <span className="fa-item-label">{f.label}</span>
                    <time>{clock(f.event.at)}</time>
                  </div>
                  <p className="fa-item-text">{f.text.replace(CONNECTION_TAG, "")}</p>
                  {approved && <p className="fa-item-note">{T.approved}</p>}
                </li>
              );
            })}
          </ol>
        )}
        {data.hiddenCount > 0 && (
          <p className="fa-private">{T.hidden(data.hiddenCount)}</p>
        )}
      </section>

    </div>
  );
}
