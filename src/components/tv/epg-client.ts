import type { Channel, Program } from "@/lib/types";
import { CHANNELS as LOCAL_CHANNELS, type Scene } from "./channels";

// Reads the agent's guide (GET /api/agent/epg?now=) so the TV shows the same
// channel names and titles the agent talks about. Seed data, labeled "demo data" on screen.

export type Guide = { channels: Channel[]; programs: Program[] };

export async function fetchGuide(now: Date): Promise<Guide | null> {
  try {
    const res = await fetch(`/api/agent/epg?now=${encodeURIComponent(now.toISOString())}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as Partial<Guide>;
    if (!Array.isArray(json.channels) || !Array.isArray(json.programs)) return null;
    return { channels: json.channels, programs: json.programs };
  } catch {
    return null;
  }
}

// What is on now; in a gap between shows, the one that started most recently.
export function programAt(guide: Guide, channel: number, now: Date): Program | undefined {
  const t = now.getTime();
  const onChannel = guide.programs.filter((p) => p.channel === channel && Date.parse(p.start) <= t);
  return (
    onChannel.find((p) => t < Date.parse(p.end)) ??
    onChannel.sort((a, b) => Date.parse(b.start) - Date.parse(a.start))[0]
  );
}

// Channels worth flipping through with the remote: the ones that have a lineup.
export function surfChannels(guide: Guide | null): number[] {
  if (!guide) return LOCAL_CHANNELS.map((c) => c.number);
  const withShows = new Set(guide.programs.map((p) => p.channel));
  const list = [...withShows].sort((a, b) => a - b);
  return list.length > 0 ? list : LOCAL_CHANNELS.map((c) => c.number);
}

const SCENE_WORDS: [Scene, RegExp][] = [
  ["trot", /트로트|가요|노래|콘서트|음악|명곡|복면가왕|임영웅|영웅|concert|music|songs?|singer|welk|rieu|idol|voice/i],
  ["news", /뉴스|뉴스룸|YTN|이슈|news|newsroom|cnn|msnbc|fox|today|good morning|world|report/i],
  ["health", /health|doctor|dr\.|fitness|exercise/i],
  ["nature", /nature|planet|wild|travel|garden|outdoor|national geographic/i],
  ["temple", /법문|예불|사찰|불교|스님|BTN|BBS/],
  ["health", /건강|체조|명의|무릎|병원/],
  ["drama", /드라마|연속극|봄날|아침마당|생생정보|달인|퀴즈/],
  ["nature", /기행|테마|다큐|자연|건축|삼시세끼|내고향/],
];

export function sceneFor(title: string, channelName = ""): Scene {
  const hay = `${title} ${channelName}`;
  for (const [scene, re] of SCENE_WORDS) if (re.test(hay)) return scene;
  return "drama";
}
