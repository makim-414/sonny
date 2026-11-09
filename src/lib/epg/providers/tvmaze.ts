// Live US TV lookups from the free TVmaze API (https://www.tvmaze.com/api, no key).
// "When is Dustin Hoffman on TV this week?" -> scan the US schedule for today and
// the next 6 days, then check every show's regular cast and every episode's guest
// cast for the person. Everything is cached in memory for 6 hours, so only the
// first call of a process pays for the network. Notes: docs/tvmaze.md

export const TVMAZE_ATTRIBUTION = "TV data: TVmaze";

export type TvmazeAppearance = {
  show: string;
  network: string;
  startISO: string;
  role: string;
  guest: boolean;
};

const API = "https://api.tvmaze.com";
const USER_AGENT = "sonny-demo";
const TIMEOUT_MS = 5_000;
const MAX_CONCURRENT = 6;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DAYS = 7; // today + next 6
// US schedule dates are US local dates; Eastern time decides which day is "today".
const SCHEDULE_TZ = "America/New_York";
// TVmaze allows 20 calls per 10 s per IP. Above that it answers 429 or (as seen
// on 2026-11-09) simply resets the connection, cached responses included. We stay
// under it client side and retry the few that still bounce.
const RATE_CALLS = 19;
const RATE_WINDOW_MS = 10_000;
const MAX_RETRIES = 4;

// --- TVmaze response shapes (only the fields we read) ---

type Channel = { name?: string | null } | null;
type Show = {
  id: number;
  name: string;
  runtime?: number | null;
  averageRuntime?: number | null;
  network?: Channel;
  webChannel?: Channel;
};
type ScheduleEpisode = {
  id: number;
  airstamp: string | null;
  runtime?: number | null;
  show: Show;
};
type CastEntry = {
  person: { name: string };
  character?: { name?: string | null } | null;
};

// --- 6 concurrent requests max ---

let active = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  // A finished request hands its slot straight to the next waiter.
  if (active >= MAX_CONCURRENT) await new Promise<void>((r) => waiting.push(r));
  else active++;
  try {
    return await fn();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Sliding window: at most RATE_CALLS request starts per RATE_WINDOW_MS.
const starts: number[] = [];

async function rateLimit(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (starts.length && now - starts[0] >= RATE_WINDOW_MS) starts.shift();
    if (starts.length < RATE_CALLS) {
      starts.push(now);
      return;
    }
    await sleep(starts[0] + RATE_WINDOW_MS - now + 50);
  }
}

async function getJson<T>(path: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await withSlot(async () => {
        await rateLimit();
        return fetch(API + path, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      });
      if (res.status === 404) return [] as T; // show or episode without a cast list
      if (res.status === 429 || res.status >= 500) throw new Error(`TVmaze ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`TVmaze ${res.status} ${path}`), { fatal: true });
      return (await res.json()) as T;
    } catch (err) {
      if ((err as { fatal?: boolean }).fatal || attempt >= MAX_RETRIES) throw err;
      // Reset, timeout, 429 or 5xx: wait out a rate window outside the slot.
      await sleep(RATE_WINDOW_MS / 2 + attempt * 2_000);
    }
  }
}

// --- 6 hour in-memory cache (promises, so parallel callers share one request) ---

const cache = new Map<string, { at: number; value: Promise<unknown> }>();

function cached<T>(path: string): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as Promise<T>;
  const value = getJson<T>(path);
  cache.set(path, { at: Date.now(), value });
  value.catch(() => cache.delete(path)); // never cache failures
  return value;
}

// --- helpers ---

function scheduleDates(nowISO: string): string[] {
  const now = new Date(nowISO);
  if (Number.isNaN(now.getTime())) throw new Error(`bad nowISO ${nowISO}`);
  // en-CA formats as YYYY-MM-DD.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: SCHEDULE_TZ }).format(now);
  const base = Date.parse(`${today}T12:00:00Z`);
  return Array.from({ length: DAYS }, (_, i) =>
    new Date(base + i * 86_400_000).toISOString().slice(0, 10),
  );
}

const networkOf = (show: Show) => show.network?.name ?? show.webChannel?.name ?? "";

const roleOf = (c: CastEntry) => c.character?.name?.trim() || "Self";

function endMs(ep: ScheduleEpisode, startMs: number): number {
  const minutes = ep.runtime ?? ep.show.runtime ?? ep.show.averageRuntime ?? 30;
  return startMs + minutes * 60_000;
}

/**
 * Upcoming US TV appearances of a person, from TVmaze.
 * Matches the person's name case-insensitively as a substring.
 * Sorted by start time, upcoming (not yet ended) first, then ones that already
 * aired. Never throws: returns [] on any error.
 */
export async function searchPerson(
  query: string,
  nowISO: string,
): Promise<TvmazeAppearance[]> {
  try {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const nowMs = new Date(nowISO).getTime();

    const days = await Promise.all(
      scheduleDates(nowISO).map((d) =>
        cached<ScheduleEpisode[]>(`/schedule?country=US&date=${d}`),
      ),
    );
    const episodes = days.flat().filter((ep) => ep.airstamp && ep.show);
    const showIds = [...new Set(episodes.map((ep) => ep.show.id))];

    const [showCasts, guestCasts] = await Promise.all([
      Promise.all(showIds.map((id) => cached<CastEntry[]>(`/shows/${id}/cast`))),
      Promise.all(
        episodes.map((ep) => cached<CastEntry[]>(`/episodes/${ep.id}/guestcast`)),
      ),
    ]);

    const castByShow = new Map<number, CastEntry[]>();
    showIds.forEach((id, i) => castByShow.set(id, showCasts[i]));
    const matches = (c: CastEntry) => c.person?.name?.toLowerCase().includes(needle);

    const out: (TvmazeAppearance & { endMs: number })[] = [];
    const seen = new Set<string>();
    episodes.forEach((ep, i) => {
      const startMs = Date.parse(ep.airstamp as string);
      const startISO = new Date(startMs).toISOString();
      const add = (c: CastEntry, guest: boolean) => {
        const key = `${ep.id}|${c.person.name}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
          show: ep.show.name,
          network: networkOf(ep.show),
          startISO,
          role: roleOf(c),
          guest,
          endMs: endMs(ep, startMs),
        });
      };
      // Regular cast first so a series regular is not also listed as a guest.
      for (const c of castByShow.get(ep.show.id) ?? []) if (matches(c)) add(c, false);
      for (const c of guestCasts[i] ?? []) if (matches(c)) add(c, true);
    });

    const upcoming = out.filter((a) => a.endMs > nowMs);
    const aired = out.filter((a) => a.endMs <= nowMs);
    const byStart = (a: { startISO: string }, b: { startISO: string }) =>
      a.startISO.localeCompare(b.startISO);
    return [...upcoming.sort(byStart), ...aired.sort(byStart)].map((a) => ({
      show: a.show,
      network: a.network,
      startISO: a.startISO,
      role: a.role,
      guest: a.guest,
    }));
  } catch {
    return [];
  }
}

/**
 * Fills the 6 hour cache (all 7 schedule days and every cast list) so the first
 * real searchPerson call is instant. A cold fill is about 800 calls, which takes
 * about 7 minutes under TVmaze's 20 calls per 10 s limit. Call it at server start.
 */
export async function warmTvmaze(nowISO: string): Promise<void> {
  await searchPerson("\u0000warm", nowISO);
}
