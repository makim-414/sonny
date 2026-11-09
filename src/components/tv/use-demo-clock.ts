"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Demo clock: real time plus an offset that the hidden F key pushes forward.
// Start time can be set with ?t=08:00 so the demo can open in the morning.

function initialOffset(): number {
  if (typeof window === "undefined") return 0;
  const t = new URLSearchParams(window.location.search).get("t");
  const m = t?.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  const start = new Date();
  start.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return start.getTime() - Date.now();
}

export function useDemoClock() {
  const offsetRef = useRef(0);
  // 0 until mounted: reading the time during prerender is not allowed.
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    offsetRef.current = initialOffset();
    setNowMs(Date.now() + offsetRef.current);
    const id = setInterval(() => setNowMs(Date.now() + offsetRef.current), 500);
    return () => clearInterval(id);
  }, []);

  const getNow = useCallback(() => new Date(Date.now() + offsetRef.current), []);

  const forward = useCallback((minutes: number) => {
    offsetRef.current += minutes * 60_000;
    setNowMs(Date.now() + offsetRef.current);
  }, []);

  // Moves the clock so it reads `target` right now (the hidden N key: next morning).
  const jumpTo = useCallback((target: Date) => {
    offsetRef.current = target.getTime() - Date.now();
    setNowMs(target.getTime());
  }, []);

  return { jumpTo, now: nowMs > 0 ? new Date(nowMs) : null, getNow, forward };
}

export function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const half = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${half} ${h12}:${m}`;
}

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function formatDate(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${DAYS[d.getDay()]}요일`;
}
