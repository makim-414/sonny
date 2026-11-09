"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityEvent } from "@/lib/types";
import { clock, toFeedItem, type FeedItem, type Summary } from "./derive";
import "./family.css";

const POLL_MS = 2000;

const QUICK = ["병원 택시 불러 드려", "오늘 저녁 7시에 갈게요", "약 드셨는지 여쭤봐"];

type FamilyData = {
  events: ActivityEvent[];
  hiddenCount: number;
  summary: Summary | null;
  approvedIds: string[];
};

const EMPTY: FamilyData = { events: [], hiddenCount: 0, summary: null, approvedIds: [] };

export default function FamilyApp() {
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

  const s = data.summary;
  const medLabel = !s ? "·" : s.medicine === "taken" ? "드셨어요" : s.medicine === "asked" ? "여쭤봤어요" : "기록 없음";

  return (
    <div className="fa">
      <header className="fa-header">
        <div>
          <h1 className="fa-title">할머니 집</h1>
          <p className="fa-sub">{online ? "할머니 TV와 연결돼 있어요" : "연결이 끊겼어요. 다시 잇는 중"}</p>
        </div>
        <span className={online ? "fa-live" : "fa-live fa-live-off"} aria-hidden />
      </header>

      <section className="fa-summary" aria-label="할머니 오늘">
        <h2 className="fa-summary-title">할머니 오늘</h2>
        {s?.reassure && <p className={`fa-reassure fa-reassure-${s.reassure.tone}`}>{s.reassure.text}</p>}
        <p className="fa-summary-line">{s ? s.sentence : "불러오는 중"}</p>
        <dl className="fa-stats">
          <div>
            <dt>마지막 대화</dt>
            <dd>{s?.lastTalk || "·"}</dd>
          </div>
          <div>
            <dt>약</dt>
            <dd className={s?.medicine === "taken" ? "fa-ok" : undefined}>{medLabel}</dd>
          </div>
          <div>
            <dt>지금 TV</dt>
            <dd>{s?.tv ?? "·"}</dd>
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

      <section className="fa-composer" aria-label="할머니께 보내기">
        {notice && (
          <p className="fa-notice" role="status">
            {notice}
          </p>
        )}
        <h2 className="fa-section-title">할머니께 보내기</h2>
        <p className="fa-hint">누르면 할머니 TV에 바로 떠요</p>
        <div className="fa-quick">
          {QUICK.map((q) => (
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
            placeholder="직접 써서 보내기"
            aria-label="할머니께 전할 말"
            maxLength={500}
          />
          <button className="fa-btn fa-btn-primary" type="submit" disabled={sending || !draft.trim()}>
            보내기
          </button>
        </form>
      </section>
      {sent && (
        <section className="fa-reply" aria-live="polite" aria-label="보낸 메시지">
          <p className="fa-reply-sent">
            <span>TV로 보냈어요</span> {sent.text}
          </p>
          {reply ? (
            <p className="fa-reply-answer">
              <span>할머니 답</span> {reply.text}
            </p>
          ) : (
            <p className="fa-reply-wait">할머니 답을 기다리는 중</p>
          )}
        </section>
      )}

      <section className="fa-feed" aria-label="오늘 있었던 일">
        <h2 className="fa-section-title">오늘 있었던 일</h2>
        {feed.length === 0 ? (
          <p className="fa-empty">아직 기록이 없어요. TV가 무언가 하면 여기에 바로 보여요.</p>
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
                  <p className="fa-item-text">{f.text}</p>
                  {approved && <p className="fa-item-note">승인함</p>}
                </li>
              );
            })}
          </ol>
        )}
        {data.hiddenCount > 0 && (
          <p className="fa-private">할머니의 사적인 대화 {data.hiddenCount}건은 표시하지 않았어요.</p>
        )}
      </section>

    </div>
  );
}
