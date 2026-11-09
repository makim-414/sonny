import type { Channel, Program } from "@/lib/types";
import channelsJson from "./channels.json";
import lineupJson from "./lineup.json";

// About 220 channels and today's lineup. Times are built around the request's
// `now` so the demo always has a 임영웅 show airing now and one in 30 minutes.

export const CHANNELS: Channel[] = channelsJson as Channel[];
const LINEUP = lineupJson as unknown as Record<string, [string, string[]][]>;

const SLOT_MIN = 60;
const HERO_NOW_CHANNEL = 18; // TV조선
const HERO_LATER_CHANNEL = 7; // KBS1

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

  // Guaranteed 임영웅 shows: one on now, one starting about 30 minutes later.
  const t = now.getTime();
  const nowStart = t - 20 * 60_000;
  const laterStart = Math.ceil((t + 25 * 60_000) / (5 * 60_000)) * 5 * 60_000;
  const heroes: Program[] = [
    {
      channel: HERO_NOW_CHANNEL,
      title: "임영웅 콘서트 [IM HERO] 특별 방송",
      people: ["임영웅"],
      start: new Date(nowStart).toISOString(),
      end: new Date(nowStart + 80 * 60_000).toISOString(),
    },
    {
      channel: HERO_LATER_CHANNEL,
      title: "가요무대 임영웅 특집",
      people: ["임영웅"],
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
