"use client";

import { useEffect, useState } from "react";
import { T } from "./strings";

// "This week" for mom: four KPI cards and two small charts from /api/family/insights.
// Numbers only, never what grandma said. Demo blocks carry a "demo data" tag.

type Day = { day: string; label: string; systolic: number | null; diastolic: number | null; talks: number; outing: boolean };
type Insights = {
  days: Day[];
  bloodPressure: { latest: string | null; average: string | null; inRangeDays: number; daysMeasured: number; demo: boolean };
  memory: { recall: number; of: number; lastWeek: number; demo: boolean };
  gettingOut: { thisWeek: number; lastWeek: number; demo: boolean };
  talks: { perDay: number; busiest: { from: number; to: number }; demo: boolean };
  signals?: unknown;
};

// "Signals this week": small slips Sonny notices in everyday calls. The agent adds
// `signals` to /api/family/insights; until then the card shows marked demo values.
type Count = { thisWeek: number; lastWeek?: number };
type Signals = { forgot: Count; missed: Count; repeated: Count; demo: boolean };
const DEMO_SIGNALS: Signals = { forgot: { thisWeek: 2, lastWeek: 0 }, missed: { thisWeek: 1 }, repeated: { thisWeek: 0 }, demo: true };

// Accepts { forgot | forgotNameOrPlace, missed | missedCheckins, repeated | repeatedQuestions },
// each a number or { thisWeek, lastWeek }.
function readSignals(raw: unknown): Signals {
  if (!raw || typeof raw !== "object") return DEMO_SIGNALS;
  const r = raw as Record<string, unknown>;
  const count = (...keys: string[]): Count | null => {
    for (const k of keys) {
      const v = r[k];
      if (typeof v === "number") return { thisWeek: v };
      if (v && typeof v === "object" && typeof (v as Count).thisWeek === "number") {
        const c = v as Count;
        return { thisWeek: c.thisWeek, lastWeek: typeof c.lastWeek === "number" ? c.lastWeek : undefined };
      }
    }
    return null;
  };
  const forgot = count("forgot", "forgotNameOrPlace", "forgotName");
  const missed = count("missed", "missedCheckins", "missedCheckIns");
  const repeated = count("repeated", "repeatedQuestions");
  if (!forgot && !missed && !repeated) return DEMO_SIGNALS;
  return {
    forgot: forgot ?? { thisWeek: 0 },
    missed: missed ?? { thisWeek: 0 },
    repeated: repeated ?? { thisWeek: 0 },
    demo: r.demo === true,
  };
}

function SignalRow({ label, c }: { label: string; c: Count }) {
  const up = c.lastWeek !== undefined && c.thisWeek > c.lastWeek;
  return (
    <li className={up ? "wd-sig is-up" : "wd-sig"}>
      <span className="wd-sig-label">{label}</span>
      <span className="wd-sig-value">
        {c.thisWeek}
        {c.lastWeek !== undefined && <span className="wd-sig-last"> ({T.sigLastWeek(c.lastWeek)})</span>}
      </span>
    </li>
  );
}

function SignalsCard({ raw }: { raw: unknown }) {
  const s = readSignals(raw);
  return (
    <section className="wd-signals" aria-label={T.signalsTitle}>
      <p className="wd-kpi-label">
        {T.signalsTitle}
        {s.demo && <span className="wd-demo">{T.demoTag}</span>}
      </p>
      <ul className="wd-sig-list">
        <SignalRow label={T.sigForgot} c={s.forgot} />
        <SignalRow label={T.sigMissed} c={s.missed} />
        <SignalRow label={T.sigRepeated} c={s.repeated} />
      </ul>
      <p className="wd-note">{T.signalsNote}</p>
    </section>
  );
}

const POLL_MS = 15000;
const hour = (h: number) => new Date(2000, 0, 1, h % 24).toLocaleTimeString(T.locale, { hour: "numeric" });

function Kpi({ label, value, sub, demo }: { label: string; value: string; sub: string; demo: boolean }) {
  return (
    <div className="wd-kpi">
      <p className="wd-kpi-label">
        {label}
        {demo && <span className="wd-demo">{T.demoTag}</span>}
      </p>
      <p className="wd-kpi-value">{value}</p>
      <p className="wd-kpi-sub">{sub}</p>
    </div>
  );
}

// 7-day blood pressure: systolic and diastolic lines, 140 and 90 reference lines.
function BpChart({ days }: { days: Day[] }) {
  const W = 300;
  const H = 120;
  const pad = { l: 28, r: 16, t: 8, b: 18 };
  const lo = 60;
  const hi = 160;
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, days.length - 1);
  const y = (v: number) => pad.t + ((hi - v) * (H - pad.t - pad.b)) / (hi - lo);
  const line = (key: "systolic" | "diastolic") =>
    days
      .map((d, i) => (d[key] === null ? null : `${x(i)},${y(d[key]!)}`))
      .filter(Boolean)
      .join(" ");
  return (
    <svg className="wd-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={T.chartBp}>
      {[140, 90].map((v) => (
        <g key={v}>
          <line className="wd-ref" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
          <text className="wd-axis" x={pad.l - 4} y={y(v) + 3} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      <polyline className="wd-line-sys" points={line("systolic")} />
      <polyline className="wd-line-dia" points={line("diastolic")} />
      {days.map((d, i) => (
        <g key={d.day}>
          {d.systolic !== null && <circle className={d.systolic >= 140 ? "wd-pt is-out" : "wd-pt"} cx={x(i)} cy={y(d.systolic)} r={2.5} />}
          {d.diastolic !== null && <circle className={d.diastolic >= 90 ? "wd-pt is-out" : "wd-pt-dia"} cx={x(i)} cy={y(d.diastolic)} r={2.5} />}
          <text className="wd-axis" x={x(i)} y={H - 4} textAnchor="middle">
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// 7-day talks as bars; a dot above the bar on days she went out.
function TalkChart({ days }: { days: Day[] }) {
  const W = 300;
  const H = 120;
  const pad = { l: 8, r: 8, t: 14, b: 18 };
  const max = Math.max(1, ...days.map((d) => d.talks));
  const slot = (W - pad.l - pad.r) / days.length;
  const bw = slot * 0.5;
  const bh = (v: number) => (v * (H - pad.t - pad.b)) / max;
  return (
    <svg className="wd-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={T.chartTalk}>
      {days.map((d, i) => {
        const cx = pad.l + slot * i + slot / 2;
        const top = H - pad.b - bh(d.talks);
        return (
          <g key={d.day}>
            <rect className="wd-bar" x={cx - bw / 2} y={top} width={bw} height={bh(d.talks)} rx={2} />
            {d.outing && <circle className="wd-out" cx={cx} cy={top - 6} r={3} />}
            <text className="wd-axis" x={cx} y={H - 4} textAnchor="middle">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function WeekDashboard({ wide = false }: { wide?: boolean }) {
  const [data, setData] = useState<Insights | null>(null);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch("/api/family/insights", { cache: "no-store" });
        if (res.ok && !stopped) setData((await res.json()) as Insights);
      } catch {
        // keep the last numbers
      }
    };
    const first = setTimeout(load, 0);
    const id = setInterval(load, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  if (!data) return null;
  const { bloodPressure: bp, memory, gettingOut: out, talks } = data;
  return (
    <section className={wide ? "wd wd-wide" : "wd"} aria-label={T.weekTitle}>
      <h2 className="fa-section-title">{T.weekTitle}</h2>
      <SignalsCard raw={data.signals} />
      <div className="wd-kpis">
        <Kpi label={T.kBp} value={bp.latest ?? "·"} sub={bp.average ? T.kBpSub(bp.average, bp.inRangeDays, bp.daysMeasured) : ""} demo={bp.demo} />
        <Kpi label={T.kMind} value={T.kMindVal(memory.recall, memory.of)} sub={T.kMindSub(memory.recall - memory.lastWeek)} demo={memory.demo} />
        <Kpi label={T.kOut} value={T.kOutVal(out.thisWeek)} sub={T.kOutSub(out.lastWeek)} demo={out.demo} />
        <Kpi label={T.kTalk} value={T.kTalkVal(talks.perDay)} sub={T.kTalkSub(hour(talks.busiest.from), hour(talks.busiest.to))} demo={talks.demo} />
      </div>
      <div className="wd-charts">
        <figure className="wd-panel">
          <figcaption className="wd-panel-title">{T.chartBp}</figcaption>
          <BpChart days={data.days} />
        </figure>
        <figure className="wd-panel">
          <figcaption className="wd-panel-title">{T.chartTalk}</figcaption>
          <TalkChart days={data.days} />
        </figure>
      </div>
      <p className="wd-note">{T.trendNote}</p>
    </section>
  );
}
