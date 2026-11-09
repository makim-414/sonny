// Health check-ins: the shapes the family screens read from the agent API.
// The agent brain session owns /api/agent/health-*; until those routes exist,
// every reader here falls back to an empty state instead of throwing.

export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type HealthPlan = {
  bp: { enabled: boolean; time: string }; // daily blood-pressure call, "08:00"
  memory: { enabled: boolean; day: Weekday; time: string }; // weekly two-minute memory check
};

export const DEFAULT_PLAN: HealthPlan = {
  bp: { enabled: false, time: "08:00" },
  memory: { enabled: false, day: "sun", time: "10:00" },
};

export type BpReading = { at: string; systolic: number; diastolic: number; pulse?: number; flag: "high" | "low" | null };
export type MemoryResult = { at: string; score: number; max: number };
export type HealthReport = { bp: BpReading[]; memory: MemoryResult | null; memoryLastWeek: MemoryResult | null };

export const EMPTY_REPORT: HealthReport = { bp: [], memory: null, memoryLastWeek: null };

const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const isTime = (v: unknown): v is string => typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Home blood-pressure ranges used only to colour a reading; not a diagnosis.
// High: 140/90 or above. Low: below 90/60.
export function bpFlag(systolic: number, diastolic: number): "high" | "low" | null {
  if (systolic >= 140 || diastolic >= 90) return "high";
  if (systolic < 90 || diastolic < 60) return "low";
  return null;
}

// The agent's plan shape: { plan: { bp: { on, time }, mind: { on, day: "Mon", time } } }.
// Older shape { bp: { enabled }, memory: { enabled, day: "mon" } } is accepted too.
export function parsePlan(json: unknown): HealthPlan {
  const root = (json ?? {}) as { plan?: unknown };
  const j = (root.plan ?? json ?? {}) as {
    bp?: { on?: boolean; enabled?: boolean; time?: string };
    mind?: { on?: boolean; day?: string; time?: string };
    memory?: { enabled?: boolean; day?: string; time?: string };
  };
  const m = j.mind ?? j.memory;
  const day = String((m as { day?: string } | undefined)?.day ?? "").slice(0, 3).toLowerCase();
  return {
    bp: {
      enabled: Boolean(j.bp?.on ?? j.bp?.enabled),
      time: isTime(j.bp?.time) ? j.bp!.time! : DEFAULT_PLAN.bp.time,
    },
    memory: {
      enabled: Boolean((m as { on?: boolean } | undefined)?.on ?? (m as { enabled?: boolean } | undefined)?.enabled),
      day: WEEKDAYS.find((d) => d === day) ?? DEFAULT_PLAN.memory.day,
      time: isTime(m?.time) ? m!.time! : DEFAULT_PLAN.memory.time,
    },
  };
}

// What POST /api/agent/health-plan expects.
export function toAgentPlan(p: HealthPlan) {
  const day = p.memory.day.charAt(0).toUpperCase() + p.memory.day.slice(1);
  return { bp: { on: p.bp.enabled, time: p.bp.time }, mind: { on: p.memory.enabled, day, time: p.memory.time } };
}

function parseMemory(v: unknown): MemoryResult | null {
  const m = v as Partial<MemoryResult> | null | undefined;
  const score = num(m?.score);
  const max = num(m?.max);
  if (!m || score === null || max === null || max <= 0 || typeof m.at !== "string") return null;
  return { at: m.at, score, max };
}

type AgentReport = {
  bloodPressure?: { readings?: { at: string; systolic: number; diastolic: number; pulse?: number; inRange?: boolean }[] };
  memory?: { checks?: { at: string; recall: number; orientation?: number }[] };
};

export function parseReport(json: unknown): HealthReport {
  const j = (json ?? {}) as { bp?: unknown; memory?: unknown; memoryLastWeek?: unknown } & AgentReport;
  // The agent's weeklyReport() shape: bloodPressure.readings and memory.checks.
  const agentBp = j.bloodPressure?.readings;
  const rawBp: unknown = Array.isArray(agentBp)
    ? agentBp.map((r) => ({ ...r, flag: r.inRange === false ? undefined : null }))
    : j.bp;
  const checks = (j.memory as AgentReport["memory"])?.checks;
  let memory: MemoryResult | null;
  let memoryLastWeek: MemoryResult | null;
  if (Array.isArray(checks)) {
    const sorted = [...checks].sort((a, b) => a.at.localeCompare(b.at));
    const toResult = (c?: { at: string; recall: number }) => (c ? { at: c.at, score: c.recall, max: 3 } : null);
    memory = toResult(sorted[sorted.length - 1]);
    memoryLastWeek = toResult(sorted[sorted.length - 2]);
  } else {
    memory = parseMemory(j.memory);
    memoryLastWeek = parseMemory(j.memoryLastWeek);
  }
  const bp: BpReading[] = Array.isArray(rawBp)
    ? rawBp
        .map((r): BpReading | null => {
          const x = r as Partial<BpReading>;
          const s = num(x.systolic);
          const d = num(x.diastolic);
          if (s === null || d === null || typeof x.at !== "string") return null;
          const flag = x.flag === "high" || x.flag === "low" ? x.flag : x.flag === null ? null : bpFlag(s, d);
          const pulse = num(x.pulse);
          return pulse === null ? { at: x.at, systolic: s, diastolic: d, flag } : { at: x.at, systolic: s, diastolic: d, pulse, flag };
        })
        .filter((r): r is BpReading => r !== null)
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 3)
    : [];
  return { bp, memory, memoryLastWeek };
}

export const WEEKDAY_LIST = WEEKDAYS;
