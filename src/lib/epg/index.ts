import { APP_LANG } from "@/lib/brand";
import type { Channel, Program } from "@/lib/types";
import channelsJson from "./channels.json";
import lineupJson from "./lineup.json";

// About 220 channels and today's lineup. Times are built around the request's
// `now` so the demo always has a 임영웅 show airing now and one in 30 minutes.

// English demo: a few US networks (numbers are demo only) and a Dustin Hoffman fan.
const CHANNELS_EN: Channel[] = [
  { number: 2, name: "CBS" }, { number: 4, name: "NBC" }, { number: 5, name: "FOX" }, { number: 7, name: "ABC" },
  { number: 13, name: "PBS" }, { number: 20, name: "CNN" }, { number: 25, name: "ESPN" }, { number: 30, name: "TCM" },
  { number: 31, name: "Hallmark" }, { number: 32, name: "HGTV" }, { number: 33, name: "Food Network" }, { number: 40, name: "Weather" },
];
const LINEUP_EN: Record<string, [string, string[]][]> = {
  "2": [["CBS Mornings", []], ["The Price Is Right", []], ["CBS Evening News", []]],
  "4": [["Today", []], ["NBC Nightly News", []], ["Wheel of Fortune", []]],
  "7": [["Good Morning America", []], ["General Hospital", []], ["Jeopardy!", []]],
  "13": [["PBS NewsHour", []], ["Antiques Roadshow", []], ["Masterpiece", []]],
  "20": [["CNN Newsroom", []]],
  "30": [["Classic movie matinee", []]],
  "31": [["Hallmark movie", []]],
  "33": [["Barefoot Contessa", []], ["The Pioneer Woman", []]],
  "40": [["Weather Center Live", []]],
};

export const CHANNELS: Channel[] = APP_LANG === "en" ? CHANNELS_EN : (channelsJson as Channel[]);
const LINEUP = APP_LANG === "en" ? LINEUP_EN : (lineupJson as unknown as Record<string, [string, string[]][]>);

const SLOT_MIN = 60;
const HERO = APP_LANG === "en" ? "Dustin Hoffman" : "임영웅";
const HERO_NOW_CHANNEL = APP_LANG === "en" ? 30 : 18; // TCM / TV조선
const HERO_LATER_CHANNEL = APP_LANG === "en" ? 4 : 7; // NBC / KBS1
const HERO_NOW_TITLE = APP_LANG === "en" ? "The Graduate (1967), starring Dustin Hoffman" : "임영웅 콘서트 [IM HERO] 특별 방송";
const HERO_LATER_TITLE = APP_LANG === "en" ? "Today: guest Dustin Hoffman" : "가요무대 임영웅 특집";

export function channelName(n: number): string | undefined {
  return CHANNELS.find((c) => c.number === n)?.name;
}

function startOfDay(now: Date) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function todaysPrograms(now: Date = new Date()): Program[] {
  const day0 = startOfDay(now).getTime();
  const out: Program[] = [];

  // Regular hourly lineup for the channels that have one.
  for (const [ch, shows] of Object.entries(LINEUP)) {
    const channel = Number(ch);
    for (let slot = 0; slot < 24; slot++) {
      const [title, people] = shows[(slot + channel) % shows.length];
      out.push({
        channel,
        title,
        people,
        start: new Date(day0 + slot * SLOT_MIN * 60_000).toISOString(),
        end: new Date(day0 + (slot + 1) * SLOT_MIN * 60_000).toISOString(),
      });
    }
  }

  // Guaranteed 임영웅 shows: one on now, one starting at the next half hour.
  // Anchored to the half-hour so repeated calls inside one window agree.
  const HALF = 30 * 60_000;
  const anchor = Math.floor(now.getTime() / HALF) * HALF;
  const nowStart = anchor - 15 * 60_000;
  const laterStart = anchor + HALF;
  const heroes: Program[] = [
    {
      channel: HERO_NOW_CHANNEL,
      title: HERO_NOW_TITLE,
      people: [HERO],
      start: new Date(nowStart).toISOString(),
      end: new Date(nowStart + 80 * 60_000).toISOString(),
    },
    {
      channel: HERO_LATER_CHANNEL,
      title: HERO_LATER_TITLE,
      people: [HERO],
      start: new Date(laterStart).toISOString(),
      end: new Date(laterStart + 60 * 60_000).toISOString(),
    },
  ];
  // Drop the regular show that would overlap a hero slot on the same channel.
  const overlaps = (a: Program, b: Program) =>
    a.channel === b.channel && Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end);
  return [...out.filter((p) => !heroes.some((h) => overlaps(p, h))), ...heroes].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start) || a.channel - b.channel,
  );
}

export type EpgHit = Program & { channelName: string; status: "now" | "later" | "ended"; startsInMin: number };

export function searchEpg(query: string, now: Date = new Date(), limit = 5): EpgHit[] {
  const q = query.replace(/\s+/g, "").toLowerCase();
  const t = now.getTime();
  return todaysPrograms(now)
    .filter((p) => {
      const hay = (p.title + p.people.join("") + (channelName(p.channel) ?? "")).replace(/\s+/g, "").toLowerCase();
      return q.length > 0 && (hay.includes(q) || p.people.some((x) => q.includes(x)));
    })
    .map((p) => {
      const s = Date.parse(p.start);
      const e = Date.parse(p.end);
      const status: EpgHit["status"] = t >= e ? "ended" : t >= s ? "now" : "later";
      return { ...p, channelName: channelName(p.channel) ?? `${p.channel}번`, status, startsInMin: Math.round((s - t) / 60_000) };
    })
    .filter((p) => p.status !== "ended")
    .sort((a, b) => a.startsInMin - b.startsInMin)
    .slice(0, limit);
}

export function nowOn(channel: number, now: Date = new Date()): Program | undefined {
  const t = now.getTime();
  return todaysPrograms(now).find((p) => p.channel === channel && Date.parse(p.start) <= t && t < Date.parse(p.end));
}
