"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityEvent } from "@/lib/types";
import { clock, summarize, toFeedItem, type FeedItem } from "./derive";
import "./family.css";

const POLL_MS = 2000;

const QUICK = ["병원 택시 불러 드려", "오늘 저녁 7시에 갈게요", "약 드셨는지 여쭤봐"];

type FamilyInfo = { approvedIds: string[]; currentChannel: number | null; inboxWaiting: number };

export default function FamilyApp() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [info, setInfo] = useState<FamilyInfo>({ approvedIds: [], currentChannel: null, inboxWaiting: 0 });
  const [online, setOnline] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [ev, fam] = await Promise.all([
        fetch("/api/events", { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
        fetch("/api/family", { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      ]);
      setEvents(ev as ActivityEvent[]);
      setInfo(fam as FamilyInfo);
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
  const feed = useMemo(() => events.map(toFeedItem).reverse(), [events]);
  const summary = useMemo(() => summarize(events, info.currentChannel), [events, info.currentChannel]);
  const pending = feed.filter(
    (f) => f.request && !info.approvedIds.includes(f.event.id) && !dismissed.includes(f.event.id),
  );

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
      await post({ text: t });
      setDraft("");
      setNotice("할머니 TV로 보냈어요");
      refresh();
    } catch {
      setNotice("보내지 못했어요. 다시 눌러 주세요");
    } finally {
      setSending(false);
    }
  }

  async function approve(item: FeedItem) {
    setBusyId(item.event.id);
    try {
      await post({ approve: item.event.id });
      setNotice(item.request === "taxi" ? "택시를 승인했어요" : "주문을 승인했어요");
      refresh();
    } catch {
      setNotice("승인하지 못했어요. 다시 눌러 주세요");
    } finally {
      setBusyId(null);
    }
  }

  const medLabel = summary.medicine === "taken" ? "드셨어요" : summary.medicine === "asked" ? "여쭤봤어요" : "기록 없음";

  return (
    <div className="fa">
      <header className="fa-header">
        <div>
          <h1 className="fa-title">할머니 집</h1>
          <p className="fa-sub">{online ? "실시간으로 보고 있어요" : "연결이 끊겼어요. 다시 잇는 중"}</p>
        </div>
        <span className={online ? "fa-live" : "fa-live fa-live-off"} aria-hidden />
      </header>

      <section className="fa-summary" aria-label="할머니 오늘">
        <h2 className="fa-summary-title">할머니 오늘</h2>
        <p className="fa-summary-line">{summary.sentence}</p>
        <dl className="fa-stats">
          <div>
            <dt>마지막 대화</dt>
            <dd>{summary.lastTalk || "·"}</dd>
          </div>
          <div>
            <dt>약</dt>
            <dd className={summary.medicine === "taken" ? "fa-ok" : undefined}>{medLabel}</dd>
          </div>
          <div>
            <dt>지금 TV</dt>
            <dd>{summary.tv}</dd>
          </div>
        </dl>
      </section>

      {pending.length > 0 && (
        <section className="fa-approvals" aria-label="승인 기다리는 요청">
          {pending.map((p) => (
            <article key={p.event.id} className="fa-approval">
              <div className="fa-approval-head">
                <h3>{p.label}</h3>
                <time>{clock(p.event.at)}</time>
              </div>
              <p>{p.text}</p>
              <div className="fa-approval-actions">
                <button className="fa-btn fa-btn-primary" disabled={busyId === p.event.id} onClick={() => approve(p)}>
                  {busyId === p.event.id ? "보내는 중" : "승인"}
                </button>
                <button className="fa-btn" onClick={() => setDismissed((d) => [...d, p.event.id])}>
                  나중에
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="fa-feed" aria-label="활동 기록" aria-live="polite">
        <h2 className="fa-section-title">오늘 있었던 일</h2>
        {feed.length === 0 ? (
          <p className="fa-empty">아직 기록이 없어요. TV가 켜지면 여기에 바로 보여요.</p>
        ) : (
          <ol className="fa-list">
            {feed.map((f) => {
              const approved = f.request && info.approvedIds.includes(f.event.id);
              return (
                <li key={f.event.id} className={`fa-item fa-tone-${f.tone}`}>
                  <div className="fa-item-meta">
                    <span className="fa-item-label">{f.label}</span>
                    <time>{clock(f.event.at)}</time>
                  </div>
                  <p className="fa-item-text">{f.text}</p>
                  {approved && <p className="fa-item-note">승인함</p>}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <footer className="fa-composer">
        {notice && (
          <p className="fa-notice" role="status">
            {notice}
          </p>
        )}
        <div className="fa-quick">
          {QUICK.map((q) => (
            <button key={q} className="fa-chip" disabled={sending} onClick={() => send(q)}>
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
            placeholder="할머니께 전할 말"
            aria-label="할머니께 전할 말"
            maxLength={500}
          />
          <button className="fa-btn fa-btn-primary" type="submit" disabled={sending || !draft.trim()}>
            보내기
          </button>
        </form>
      </footer>
    </div>
  );
}
