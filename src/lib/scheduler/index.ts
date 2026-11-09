import { store } from "@/lib/store";
import type { TvAction } from "@/lib/types";

// Time helpers (the demo runs in Seoul) and grandma's standing routines.

const TZ = "Asia/Seoul";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function kstParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: wd,
  };
}

/** "11월 9일 월요일 오전 10시 15분" */
export function kstLabel(d: Date): string {
  const p = kstParts(d);
  const ampm = p.hour < 12 ? "오전" : "오후";
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${p.month}월 ${p.day}일 ${WEEKDAYS[p.weekday]}요일 ${ampm} ${h12}시${p.minute ? ` ${p.minute}분` : ""}`;
}

/** "오후 2시 30분" */
export function kstClock(d: Date): string {
  const p = kstParts(d);
  const ampm = p.hour < 12 ? "오전" : "오후";
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${ampm} ${h12}시${p.minute ? ` ${p.minute}분` : ""}`;
}

/** ISO string for today (KST) at hh:mm, with +09:00 offset. */
export function kstTodayAt(now: Date, hour: number, minute = 0, addDays = 0): string {
  const p = kstParts(now);
  const base = Date.UTC(p.year, p.month - 1, p.day + addDays, hour - 9, minute);
  return new Date(base).toISOString();
}

export type Routine = { label: string; weekdays: number[]; hour: number; minute: number; kind: "medicine" | "temple" | "hospital" | "family" };

// Standing routines mirrored from the seed memory.
export const ROUTINES: Routine[] = [
  { label: "혈압약 드시기", weekdays: [0, 1, 2, 3, 4, 5, 6], hour: 8, minute: 0, kind: "medicine" },
  { label: "보현사 절에 가시는 날", weekdays: [2, 5], hour: 9, minute: 30, kind: "temple" },
];

/** One-off appointments for the demo week. */
export const APPOINTMENTS = [
  { label: "서울바른내과의원 혈압 정기 검진", weekday: 1, hour: 11, minute: 0, kind: "hospital" as const },
];

export function todayAgenda(now: Date): string[] {
  const wd = kstParts(now).weekday;
  const items = [
    ...ROUTINES.filter((r) => r.weekdays.includes(wd)).map((r) => ({ ...r })),
    ...APPOINTMENTS.filter((a) => a.weekday === wd),
  ].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  const lines = items.map((i) => `${kstClock(new Date(kstTodayAt(now, i.hour, i.minute)))} ${i.label}`);
  const upcoming = store.pending
    .filter((p) => Date.parse(p.at) >= now.getTime())
    .map((p) => `${kstClock(new Date(p.at))} ${p.label} (예약된 알림)`);
  return [...lines, ...upcoming];
}

export function addSchedule(at: string, label: string, action: TvAction) {
  const item = { at, label, action };
  store.pending.push(item);
  return { type: "schedule" as const, ...item };
}
