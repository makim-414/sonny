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

export function parsePlan(json: unknown): HealthPlan {
  const j = (json ?? {}) as { bp?: Partial<HealthPlan["bp"]>; memory?: Partial<HealthPlan["memory"]> };
  return {
    bp: {
      enabled: Boolean(j.bp?.enabled),
      time: isTime(j.bp?.time) ? j.bp!.time! : DEFAULT_PLAN.bp.time,
    },
    memory: {
      enabled: Boolean(j.memory?.enabled),
      day: WEEKDAYS.find((d) => d === j.memory?.day) ?? DEFAULT_PLAN.memory.day,
      time: isTime(j.memory?.time) ? j.memory!.time! : DEFAULT_PLAN.memory.time,
    },
  };
}

function parseMemory(v: unknown): MemoryResult | null {
  const m = v as Partial<MemoryResult> | null | undefined;
  const score = num(m?.score);
  const max = num(m?.max);
  if (!m || score === null || max === null || max <= 0 || typeof m.at !== "string") return null;
  return { at: m.at, score, max };
}

export function parseReport(json: unknown): HealthReport {
  const j = (json ?? {}) as { bp?: unknown; memory?: unknown; memoryLastWeek?: unknown };
  const bp: BpReading[] = Array.isArray(j.bp)
    ? j.bp
        .map((r): BpReading | null => {
          const x = r as Partial<BpReading>;
          const s = num(x.systolic);
          const d = num(x.diastolic);
          if (s === null || d === null || typeof x.at !== "string") return null;
          const flag = x.flag === "high" || x.flag === "low" ? x.flag : bpFlag(s, d);
          const pulse = num(x.pulse);
          return pulse === null ? { at: x.at, systolic: s, diastolic: d, flag } : { at: x.at, systolic: s, diastolic: d, pulse, flag };
        })
        .filter((r): r is BpReading => r !== null)
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 3)
    : [];
  return { bp, memory: parseMemory(j.memory), memoryLastWeek: parseMemory(j.memoryLastWeek) };
}

export const WEEKDAY_LIST = WEEKDAYS;
