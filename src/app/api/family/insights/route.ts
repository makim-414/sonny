import { connection } from "next/server";
import { wellness } from "@/lib/agent/wellness";
import { currentGuardian } from "@/lib/auth/server";
import { store } from "@/lib/store";

// GET /api/family/insights -> "This week" numbers for mom's dashboard.
// Only counts and readings, never what grandma said. Each block falls back to a
// clearly marked demo series when the last 7 days have no real data yet.

const DAY = 86_400_000;
const TZ = "Asia/Seoul";
const dayKey = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
const hourOf = (t: number) => Number(new Date(t).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: TZ })) % 24;
const OUTING = /taxi|ride|cab|doctor|clinic|hospital|grocer|market|order|택시|병원|장보기|주문/i;

type Day = { day: string; label: string; systolic: number | null; diastolic: number | null; talks: number; outing: boolean };

export async function GET() {
  await connection();
  if (!(await currentGuardian())) return Response.json({ error: "sign in as family" }, { status: 401 });

  const now = Date.now();
  const days: Day[] = Array.from({ length: 7 }, (_, i) => {
    const t = now - (6 - i) * DAY;
    return {
      day: dayKey(t),
      label: new Date(t).toLocaleDateString("en-US", { weekday: "short", timeZone: TZ }),
      systolic: null,
      diastolic: null,
      talks: 0,
      outing: false,
    };
  });
  const byDay = new Map(days.map((d) => [d.day, d]));

  // Blood pressure: the latest reading of each day.
  const bp7 = wellness.bp.filter((r) => now - Date.parse(r.at) < 7 * DAY).sort((a, b) => a.at.localeCompare(b.at));
  for (const r of bp7) {
    const d = byDay.get(dayKey(Date.parse(r.at)));
    if (d) {
      d.systolic = r.systolic;
      d.diastolic = r.diastolic;
    }
  }
  // Talks: how many times grandma spoke to Sonny each day (counts only).
  const heard = store.events.filter((e) => e.kind === "heard" && !e.text.startsWith("먼저 말 걸기") && now - Date.parse(e.at) < 7 * DAY);
  const hours = new Array(24).fill(0) as number[];
  for (const e of heard) {
    const t = Date.parse(e.at);
    const d = byDay.get(dayKey(t));
    if (d) d.talks++;
    hours[hourOf(t)]++;
  }
  // Getting out: rides, clinic visits and grocery runs from the allowance ledger.
  const outings = (from: number, to: number) =>
    store.wallet.ledger.filter((e) => e.amount < 0 && e.status === "done" && OUTING.test(e.label) && Date.parse(e.at) >= from && Date.parse(e.at) < to);
  const outThis = outings(now - 7 * DAY, now + DAY);
  const outLast = outings(now - 14 * DAY, now - 7 * DAY);
  for (const e of outThis) {
    const d = byDay.get(dayKey(Date.parse(e.at)));
    if (d) d.outing = true;
  }

  // Demo fallbacks, marked, so the dashboard is never blank in a fresh demo.
  const demoBp = bp7.filter((r) => !r.demo).length < 3; // the agent seeds a few demo readings too
  if (demoBp) {
    const sys = [126, 131, 124, 129, 133, 127, 128];
    const dia = [80, 84, 79, 82, 86, 81, 82];
    days.forEach((d, i) => {
      d.systolic ??= sys[i];
      d.diastolic ??= dia[i];
    });
  }
  const demoTalks = heard.length < 7;
  if (demoTalks) {
    const t = [5, 7, 6, 4, 8, 6, 6];
    days.forEach((d, i) => (d.talks = Math.max(d.talks, t[i])));
    [9, 9, 10, 10, 10, 15, 19].forEach((h) => (hours[h] += 3));
  }
  const demoOut = outThis.length === 0;
  if (demoOut) [1, 3, 4, 6].forEach((i) => (days[i].outing = true));

  const withBp = days.filter((d) => d.systolic !== null && d.diastolic !== null);
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length));
  const latest = withBp[withBp.length - 1];
  const inRangeDays = withBp.filter((d) => d.systolic! < 140 && d.diastolic! < 90 && d.systolic! >= 90 && d.diastolic! >= 60).length;

  // Memory: recall of 3 words, this check against the one before.
  const mind = [...wellness.mind].sort((a, b) => a.at.localeCompare(b.at));
  const lastMind = mind[mind.length - 1];
  const prevMind = mind[mind.length - 2];
  const demoMind = !lastMind || lastMind.demo === true;

  // Busiest two-hour window for talks.
  let best = 9;
  for (let h = 0; h < 23; h++) if (hours[h] + hours[h + 1] > hours[best] + hours[best + 1]) best = h;

  const totalTalks = days.reduce((a, d) => a + d.talks, 0);
  return Response.json({
    days,
    bloodPressure: {
      latest: latest ? `${latest.systolic}/${latest.diastolic}` : null,
      average: withBp.length ? `${avg(withBp.map((d) => d.systolic!))}/${avg(withBp.map((d) => d.diastolic!))}` : null,
      inRangeDays,
      daysMeasured: withBp.length,
      demo: demoBp,
    },
    memory: {
      recall: lastMind ? lastMind.recall : 3,
      of: 3,
      lastWeek: prevMind ? prevMind.recall : lastMind ? lastMind.recall : 3,
      demo: demoMind,
    },
    gettingOut: { thisWeek: demoOut ? 4 : outThis.length, lastWeek: demoOut ? 2 : outLast.length, demo: demoOut },
    talks: { perDay: Math.round(totalTalks / 7), busiest: { from: best, to: best + 2 }, demo: demoTalks },
  });
}
