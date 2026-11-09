"use client";

import { APP_LANG } from "@/lib/brand";

// Family settings saved on grandma's phone by the hidden /setup screen (localStorage,
// keys "sonny.*"). URL params (?rate=, ?wait=) win over them for the live demo.

export type OrbSettings = {
  rate: number; // voice speed
  waitMs: number; // silence before her turn ends
  textScale: number; // caption and card size
  captions: boolean;
  volume: number; // 0..1
  lang: "en" | "ko";
};

const DEFAULTS: OrbSettings = { rate: 0.85, waitMs: 2000, textScale: 1, captions: true, volume: 1, lang: APP_LANG };

const SCALE_NAMES: Record<string, number> = { normal: 1, large: 1.25, xlarge: 1.5 };

function stored(name: string): string | null {
  try {
    return window.localStorage.getItem(`sonny.${name}`);
  } catch {
    return null; // storage blocked (private mode)
  }
}

function num(v: string | null, min: number, max: number): number | null {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function query(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

// Read fresh each time (cheap): coming back from /setup must show the new values.
export function getSettings(): OrbSettings {
  if (typeof window === "undefined") return DEFAULTS;

  // ?wait= takes seconds (2.5) or milliseconds (2500).
  const qWait = num(query("wait"), 0.2, 20_000);
  const waitMs = qWait !== null ? (qWait <= 20 ? qWait * 1000 : qWait) : num(stored("waitMs"), 200, 20_000) ?? DEFAULTS.waitMs;
  const rate = num(query("rate"), 0.5, 1.5) ?? num(stored("rate"), 0.5, 1.5) ?? DEFAULTS.rate;

  const scaleRaw = stored("textScale");
  const named = scaleRaw !== null ? SCALE_NAMES[scaleRaw] : undefined;
  const textScale = named ?? num(scaleRaw, 0.75, 2) ?? DEFAULTS.textScale;

  const cap = stored("captions");
  const captions = cap === null ? DEFAULTS.captions : !(cap === "off" || cap === "false" || cap === "0");

  const volume = num(stored("volume"), 0, 1) ?? DEFAULTS.volume;
  const langRaw = stored("lang");
  const lang = langRaw === "en" || langRaw === "ko" ? langRaw : DEFAULTS.lang;

  return { rate, waitMs, textScale, captions, volume, lang };
}
