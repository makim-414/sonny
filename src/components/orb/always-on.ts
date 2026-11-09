"use client";

import { useEffect } from "react";

// Always-on mode: grandma's phone stands on its charger like a small dedicated device.

type WakeLockSentinelLike = { released: boolean; release(): Promise<void>; addEventListener(t: "release", f: () => void): void };
type WakeLockLike = { request(type: "screen"): Promise<WakeLockSentinelLike> };

// Keeps the screen on while `active`. Browsers drop the lock when the tab hides, so it is
// asked for again whenever the page becomes visible. Silently does nothing when unsupported.
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const wl = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
    if (!wl) return;
    let lock: WakeLockSentinelLike | null = null;
    let stopped = false;
    const request = async () => {
      if (stopped || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        lock = await wl.request("screen");
        lock.addEventListener("release", () => {
          lock = null;
        });
      } catch {
        // denied (battery saver, no gesture yet): try again on the next visibility change
      }
    };
    void request();
    const onVis = () => void request();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

export type Routine = { name: string; hour: number; minute: number };

// Always there, so Sonny greets her even with an empty memory.
export const DEFAULT_ROUTINES: Routine[] = [
  { name: "morning", hour: 8, minute: 0 },
  { name: "evening", hour: 19, minute: 0 },
];

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .join("-") || "routine"
  );
}

// Finds clock times in memory facts: "8 am", "7:30 pm", "at 19:00", "저녁 7시", "8시 30분".
export function routineTimes(text: string): { hour: number; minute: number }[] {
  const out: { hour: number; minute: number }[] = [];
  for (const m of text.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/gi)) {
    let h = Number(m[1]) % 12;
    if (/p/i.test(m[3])) h += 12;
    out.push({ hour: h, minute: Number(m[2] ?? 0) });
  }
  for (const m of text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*[ap]\.?m)/gi)) {
    out.push({ hour: Number(m[1]), minute: Number(m[2]) });
  }
  for (const m of text.matchAll(/(오후|저녁|밤)?\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/g)) {
    let h = Number(m[2]);
    if (m[1] && h < 12) h += 12;
    out.push({ hour: h, minute: Number(m[3] ?? 0) });
  }
  return out.filter((t) => t.hour < 24 && t.minute < 60);
}

// Routine and health facts from the agent's memory that carry a clock time.
export async function loadRoutines(): Promise<Routine[]> {
  const list = [...DEFAULT_ROUTINES];
  try {
    const res = await fetch("/api/agent/memory", { cache: "no-store" });
    if (!res.ok) return list;
    const json = (await res.json()) as { facts?: { text?: string; category?: string }[] };
    for (const f of json.facts ?? []) {
      if (!f.text || (f.category !== "routine" && f.category !== "health")) continue;
      for (const t of routineTimes(f.text)) list.push({ name: slug(f.text), ...t });
    }
  } catch {
    // offline: defaults only
  }
  return list;
}
