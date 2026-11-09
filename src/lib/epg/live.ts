import { APP_LANG } from "@/lib/brand";
import { searchPerson, TVMAZE_ATTRIBUTION, warmTvmaze, type TvmazeAppearance } from "./providers/tvmaze";

// Live US TV listings for the English demo, with the seed guide as the safety net.
// A cold TVmaze cache takes minutes (rate limit), so it is warmed in the background
// and a turn never waits more than LIVE_TIMEOUT_MS for it.

export const LIVE_TIMEOUT_MS = 3_000;
export { TVMAZE_ATTRIBUTION };

type WarmState = { started: number; done: number | null; error: string | null };
const g = globalThis as unknown as { __sonnyTvmazeWarm?: WarmState };

export function warmLiveGuide(): WarmState | null {
  if (APP_LANG !== "en") return null;
  if (!g.__sonnyTvmazeWarm) {
    const state: WarmState = { started: Date.now(), done: null, error: null };
    g.__sonnyTvmazeWarm = state;
    warmTvmaze(new Date().toISOString())
      .then(() => {
        state.done = Date.now();
        console.log(`[epg] TVmaze cache warm in ${Math.round((state.done - state.started) / 1000)} s`);
      })
      .catch((err) => {
        state.error = String(err);
        g.__sonnyTvmazeWarm = undefined; // allow a retry later
      });
  }
  return g.__sonnyTvmazeWarm ?? null;
}

export type LiveHit = TvmazeAppearance & { status: "now" | "later"; startsInMin: number; when: string };

const ET = "America/New_York";
/** "Thursday 7:00 AM" in US Eastern time (TVmaze lists US airtimes). */
export function etWhen(iso: string, now: Date): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: ET, weekday: "long" }).format(d);
  const today = new Intl.DateTimeFormat("en-US", { timeZone: ET, weekday: "long" }).format(now);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: ET, hour: "numeric", minute: "2-digit" }).format(d);
  return `${day === today ? "today" : day} ${time}`;
}

/** Live appearances, or null when not English, not warm yet, slow, or empty. */
export async function liveSearch(query: string, now: Date): Promise<LiveHit[] | null> {
  if (APP_LANG !== "en") return null;
  const warm = warmLiveGuide();
  if (!warm?.done) return null; // still filling the cache: answer from the seed guide now
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), LIVE_TIMEOUT_MS));
  const found = await Promise.race([searchPerson(query, now.toISOString()), timeout]);
  if (!found || found.length === 0) return null;
  const t = now.getTime();
  return found.slice(0, 4).map((a) => {
    const s = Date.parse(a.startISO);
    return {
      ...a,
      status: s <= t && t < s + 30 * 60_000 ? "now" : "later",
      startsInMin: Math.round((s - t) / 60_000),
      when: etWhen(a.startISO, now),
    };
  });
}

// Start warming as soon as the agent code loads in an English build.
warmLiveGuide();
