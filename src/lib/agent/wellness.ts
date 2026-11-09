import { APP_LANG } from "@/lib/brand";
import { kstClock, kstParts } from "@/lib/scheduler";
import { logEvent, store } from "@/lib/store";
import type { BpReading, GuardianCall, HealthPlan, MindCheck, TvAction } from "@/lib/types";

// Wellness checks Sonny runs by talking: a blood pressure reading and a short weekly
// memory chat. Rules only, no model, so it is fast and the same every time.
// Not a medical test: the memory chat uses our own three words and a few everyday
// questions, and every report says it is a wellness check, not a diagnosis.

const EN = APP_LANG === "en";
export const DISCLAIMER = "Wellness check, not a diagnosis. Share with her doctor.";
const WORDS = ["apple", "garden", "blue"];
const WORD_ALIASES: Record<string, RegExp> = {
  apple: /\bapples?\b|사과/i,
  garden: /\bgardens?\b|정원|마당/i,
  blue: /\bblue\b|파랑|파란/i,
};
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAYS_KO = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
const STOP = /\b(stop|not now|later|cancel|enough|no thanks)\b|그만|나중에|됐어/i;

type Flow =
  | { kind: "bp"; tries: number }
  | { kind: "mind"; stage: "day" | "season" | "chat" | "recall"; orientation: number };

/** A check-in Sonny started and is waiting on (cleared the moment grandma speaks). */
type Pending = { kind: "bp" | "mind"; firstAt: number; lastAt: number; attempt: number; done?: boolean };
/** A weekly signal: counted by simple rules, never what she said. */
export type Slip = { at: string; kind: "forgot_name" | "repeat" | "missed_checkin"; what?: string; demo?: boolean };
type State = { plan: HealthPlan; flow?: Flow; bp: BpReading[]; mind: MindCheck[]; pending?: Pending; slips?: Slip[]; headsUpAt?: number };
const g = globalThis as unknown as { __sonnyWellness?: State };

function seedState(): State {
  const week = 7 * 86_400_000;
  const now = Date.now();
  // A little history so the first demo report can say "in her usual range" and
  // "same as last week". Marked demo.
  return {
    plan: { bp: { on: true, time: "09:00" }, mind: { on: true, day: "Mon", time: "10:00" }, noAnswerMin: 2 },
    bp: [3, 2, 1].map((d, i) => ({
      at: new Date(now - d * 86_400_000).toISOString(),
      systolic: [126, 130, 124][i],
      diastolic: [80, 83, 79][i],
      pulse: [71, 74, 70][i],
      inRange: true,
      demo: true,
    })),
    mind: [{ at: new Date(now - week).toISOString(), recall: 3, orientation: 2, demo: true }],
    slips: seedSlips(now),
  };
}

/** Demo week: forgot the clinic's name twice (none last week), one missed check-in. */
function seedSlips(now: number): Slip[] {
  const day = 86_400_000;
  return [
    { at: new Date(now - 4 * day).toISOString(), kind: "forgot_name", what: EN ? "the clinic's name" : "병원 이름", demo: true },
    { at: new Date(now - 2 * day).toISOString(), kind: "forgot_name", what: EN ? "the clinic's name" : "병원 이름", demo: true },
    { at: new Date(now - 3 * day).toISOString(), kind: "missed_checkin", demo: true },
  ];
}

export const wellness: State = g.__sonnyWellness ?? (g.__sonnyWellness = seedState());

export function resetWellness() {
  const fresh = seedState();
  wellness.flow = undefined;
  wellness.bp = fresh.bp;
  wellness.mind = fresh.mind;
  wellness.plan = fresh.plan;
  wellness.slips = fresh.slips;
  wellness.pending = undefined;
  wellness.headsUpAt = undefined;
}

export function setPlan(p: Partial<HealthPlan>) {
  if (p.bp) wellness.plan.bp = { ...wellness.plan.bp, ...p.bp };
  if (p.mind) wellness.plan.mind = { ...wellness.plan.mind, ...p.mind };
  if (typeof p.noAnswerMin === "number" && p.noAnswerMin > 0 && p.noAnswerMin <= 120) wellness.plan.noAnswerMin = p.noAnswerMin;
  return wellness.plan;
}

export type WellnessReply = { say: string; actions: TvAction[]; note: string };

function greeting(now: Date) {
  const h = kstParts(now).hour;
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return EN ? `Good ${part}, June` : "할머니";
}

function report(text: string, at: string, familyText?: string) {
  logEvent("memory", `${text} ${DISCLAIMER}`, at, { visibility: "family", familyText: familyText ? `${familyText} ${DISCLAIMER}` : undefined });
}

function ringHealth(script: string, at: string) {
  const call: GuardianCall = { id: crypto.randomUUID(), at, script, amount: 0, reason: "health", status: "ringing" };
  store.calls.push(call);
  logEvent("call", `Sonny called Sarah about a health reading (call ${call.id})`, at, { visibility: "family", familyText: "Sonny called Sarah about a health reading" });
  return call;
}

/** Start a check (demo button, schedule, or proactive "health-check:bp"). */
export function startCheck(kind: "bp" | "mind", now: Date, retry = false): WellnessReply {
  const on = kind === "bp" ? wellness.plan.bp.on : wellness.plan.mind.on;
  if (on && !retry) wellness.pending = { kind, firstAt: now.getTime(), lastAt: now.getTime(), attempt: 1 };
  if (kind === "bp") {
    if (!wellness.plan.bp.on) return { say: "", actions: [], note: "bp check is off" };
    wellness.flow = { kind: "bp", tries: 0 };
    const say = EN
      ? `${greeting(now)}. Time for your blood pressure. Put the cuff on, and read me the numbers when it beeps.`
      : "할머니, 혈압 잴 시간이에요. 커프를 차시고, 삐 소리 나면 숫자를 읽어 주세요.";
    return { say, actions: [{ type: "showCard", title: EN ? "Blood pressure check" : "혈압 체크", body: EN ? "Read me the two numbers when it beeps" : "삐 소리 나면 두 숫자를 읽어 주세요" }], note: "bp check started" };
  }
  if (!wellness.plan.mind.on) return { say: "", actions: [], note: "memory check is off" };
  wellness.flow = { kind: "mind", stage: "day", orientation: 0 };
  const say = EN
    ? `${greeting(now)}. Let's have our little chat. Please keep three words for me: apple, garden, blue. Now, what day is it today?`
    : "할머니, 우리 잠깐 얘기 나눠요. 세 단어만 기억해 주세요: 사과, 정원, 파랑. 오늘이 무슨 요일이에요?";
  return { say, actions: [], note: "memory check started" };
}

const wordNum: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};
/** "one twenty eight over eighty two" -> "128 over 82" (rough, for speech-to-text output). */
function wordsToDigits(text: string): string {
  return text.replace(/\b((?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)(?:[\s-]+(?:and[\s-]+)?(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred))*)\b/gi, (m) => {
    const parts = m.toLowerCase().split(/[\s-]+/).filter((w) => w !== "and");
    // "one twenty eight" -> 1 then 28 -> 128; "eighty two" -> 82; "one hundred twenty" -> 120
    let total = 0;
    let chunk = 0;
    let lead = "";
    for (const w of parts) {
      const n = wordNum[w];
      if (w === "hundred") {
        chunk = (lead ? Number(lead) : chunk || 1) * 100;
        lead = "";
      } else if (n >= 20 && chunk % 10 === 0 && chunk % 100 !== 0) {
        chunk += n;
      } else if (n < 10 && chunk >= 20 && chunk % 10 === 0) {
        chunk += n;
      } else if (n < 10 && chunk === 0 && parts.length > 1 && lead === "") {
        lead = String(n); // "one twenty eight": leading digit
      } else {
        chunk += n;
      }
    }
    total = Number(lead + (chunk ? String(chunk) : ""));
    return Number.isFinite(total) && total > 0 ? String(total) : m;
  });
}

export function parseBp(text: string): { systolic: number; diastolic: number; pulse?: number } | null {
  const t = wordsToDigits(text);
  const m = t.match(/(\d{2,3})\s*(?:over|\/|on|by|and|에|대)\s*(\d{2,3})/i);
  if (!m) return null;
  const systolic = Number(m[1]);
  const diastolic = Number(m[2]);
  if (systolic < 60 || systolic > 260 || diastolic < 30 || diastolic > 160 || diastolic >= systolic) return null;
  const p = t.slice((m.index ?? 0) + m[0].length).match(/(?:pulse|heart|맥박)?\D{0,12}(\d{2,3})/i);
  const pulse = p ? Number(p[1]) : undefined;
  return { systolic, diastolic, pulse: pulse && pulse >= 30 && pulse <= 200 ? pulse : undefined };
}

function seasonOf(d: Date) {
  const m = kstParts(d).month;
  return m >= 3 && m <= 5 ? "spring" : m >= 6 && m <= 8 ? "summer" : m >= 9 && m <= 11 ? "fall" : "winter";
}

/** A voice turn while a check is running. Returns null when no check is running. */
export function onVoiceWellness(text: string, now: Date): WellnessReply | null {
  const flow = wellness.flow;
  if (!flow) return null;
  const at = now.toISOString();
  if (STOP.test(text)) {
    wellness.flow = undefined;
    return { say: EN ? "That's fine, June. We can do it later." : "괜찮아요, 할머니. 나중에 해요.", actions: [], note: "check stopped" };
  }

  if (flow.kind === "bp") {
    const r = parseBp(text);
    if (!r) {
      if (flow.tries >= 1) {
        wellness.flow = undefined;
        report("Blood pressure check: no reading today.", at, "Blood pressure check: no reading today.");
        return { say: EN ? "That's okay, June. We'll try again later." : "괜찮아요, 할머니. 이따 다시 해요.", actions: [], note: "bp no reading" };
      }
      flow.tries += 1;
      return { say: EN ? "Sorry, June, I missed that. Just the two big numbers, like one twenty over eighty." : "할머니, 잘 못 들었어요. 큰 숫자 두 개만 읽어 주세요.", actions: [], note: "bp asked again" };
    }
    wellness.flow = undefined;
    const inRange = r.systolic < 160 && r.systolic >= 90 && r.diastolic < 100;
    const prior = wellness.bp.slice(-5);
    const avgS = prior.length ? prior.reduce((s, x) => s + x.systolic, 0) / prior.length : r.systolic;
    const usual = inRange && Math.abs(r.systolic - avgS) <= 15;
    wellness.bp.push({ at, systolic: r.systolic, diastolic: r.diastolic, pulse: r.pulse, inRange });
    const reading = `${r.systolic}/${r.diastolic}${r.pulse ? `, pulse ${r.pulse}` : ""}`;
    const card: TvAction = { type: "showCard", title: `Blood pressure ${r.systolic}/${r.diastolic}`, body: `${r.pulse ? `Pulse ${r.pulse}\n` : ""}${kstClock(now)}\n${DISCLAIMER}` };
    if (!inRange) {
      ringHealth(
        `Hi Sarah, it's Sonny. June's blood pressure just now was ${r.systolic} over ${r.diastolic}${r.pulse ? `, pulse ${r.pulse}` : ""}, which is outside her usual range. Do you want to call her, or her doctor?`,
        at,
      );
      report(`Blood pressure ${reading}, outside her usual range. Sonny called Sarah.`, at, `Blood pressure ${reading}, outside her usual range. Sonny called Sarah.`);
      logEvent("alert", `[warn] Blood pressure ${reading} is outside her usual range`, at, { visibility: "family" });
      return {
        say: EN ? `Thank you, June. That's a little high, so I'm letting Sarah know. Please sit and rest.` : "고마워요, 할머니. 조금 높아서 따님께 알릴게요. 앉아서 쉬세요.",
        actions: [card, { type: "notifyFamily", message: `Blood pressure ${reading}, outside her usual range`, level: "warn" }],
        note: "bp out of range",
      };
    }
    report(`Blood pressure ${reading}, ${usual ? "in her usual range" : "in a normal range"}.`, at, `Blood pressure ${reading}, ${usual ? "in her usual range" : "in a normal range"}.`);
    return {
      say: EN ? `Thank you, June. ${r.systolic} over ${r.diastolic}, all written down.` : `고마워요, 할머니. ${r.systolic}에 ${r.diastolic}, 적어 뒀어요.`,
      actions: [card],
      note: "bp recorded",
    };
  }

  // Memory chat
  if (flow.stage === "day") {
    const wd = kstParts(now).weekday;
    if (new RegExp(`\\b${DAYS[wd]}\\b|${DAYS_KO[wd]}`, "i").test(text)) flow.orientation += 1;
    flow.stage = "season";
    return { say: EN ? "Thank you. And what season are we in now?" : "고마워요. 지금은 무슨 계절이에요?", actions: [], note: "memory: day" };
  }
  if (flow.stage === "season") {
    const s = seasonOf(now);
    const ok = s === "fall" ? /\b(fall|autumn)\b|가을/i : s === "spring" ? /\bspring\b|봄/i : s === "summer" ? /\bsummer\b|여름/i : /\bwinter\b|겨울/i;
    if (ok.test(text)) flow.orientation += 1;
    flow.stage = "chat";
    return { say: EN ? "Lovely. What did you have for breakfast today?" : "좋아요. 오늘 아침은 뭐 드셨어요?", actions: [], note: "memory: season" };
  }
  if (flow.stage === "chat") {
    flow.stage = "recall";
    return { say: EN ? "That sounds nice. Now, what were the three words I asked you to keep?" : "맛있었겠어요. 아까 기억해 달라고 한 세 단어가 뭐였죠?", actions: [], note: "memory: chat" };
  }
  // recall
  const recall = WORDS.filter((w) => WORD_ALIASES[w].test(text)).length;
  wellness.flow = undefined;
  const last = [...wellness.mind].reverse()[0];
  wellness.mind.push({ at, recall, orientation: flow.orientation });
  const change = !last ? "first check" : recall === last.recall ? "same as last week" : recall > last.recall ? `up from ${last.recall} last week` : `down from ${last.recall} last week`;
  const oriented = flow.orientation === 2 ? "knew the day and the season" : flow.orientation === 1 ? "knew the day or the season" : "was not sure of the day or the season";
  const line = `Weekly memory check: recalled ${recall} of 3, ${oriented}, ${change}.`;
  report(line, at, line);
  if (last && recall <= last.recall - 2) logEvent("alert", `[warn] Weekly memory check: recall ${recall} of 3, ${change}`, at, { visibility: "family" });
  // No score for grandma, just a warm close.
  return { say: EN ? "Thank you, June. I always enjoy our chats." : "고마워요, 할머니. 할머니랑 얘기하는 게 참 좋아요.", actions: [], note: "memory check done" };
}

export function weeklyReport(now = new Date()) {
  const since = now.getTime() - 7 * 86_400_000;
  const bp = wellness.bp.filter((r) => Date.parse(r.at) >= since);
  const mind = wellness.mind.filter((r) => Date.parse(r.at) >= since - 86_400_000);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const lastMind = mind[mind.length - 1];
  return {
    plan: wellness.plan,
    bloodPressure: {
      readings: bp,
      average: bp.length ? `${avg(bp.map((r) => r.systolic))}/${avg(bp.map((r) => r.diastolic))}` : null,
      outOfRange: bp.filter((r) => !r.inRange).length,
    },
    memory: { checks: mind, latest: lastMind ? `recalled ${lastMind.recall} of 3, orientation ${lastMind.orientation} of 2` : null },
    disclaimer: DISCLAIMER,
  };
}

// ---------- no answer: try once more, then call mom ----------

export const SIGNALS_NOTE = "Wellness signals, not a diagnosis.";

/** Grandma said something: whatever check-in was waiting has its answer. */
export function heardFromHer() {
  if (wellness.pending) wellness.pending = undefined;
}

/** "9 AM" / "9:15 AM"; short drops AM/PM ("9:15") when the minutes make it clear. */
function clockShort(d: Date, short = false) {
  const c = kstClock(d);
  if (!EN) return c;
  const whole = c.replace(/:00 /, " ");
  return short && !/:00 /.test(c) ? whole.replace(/ (AM|PM)$/, "") : whole;
}

/** Checked on every request (and mom's phone poll). Returns the retry line when Sonny tries again. */
export function noAnswerCheck(now: Date): WellnessReply | null {
  const p = wellness.pending;
  if (!p || p.done) return null;
  const t = now.getTime();
  const wait = (wellness.plan.noAnswerMin ?? 2) * 60_000;
  if (t - p.lastAt < wait) return null;
  if (t - p.firstAt > 6 * 60 * 60_000) {
    wellness.pending = undefined; // yesterday's check-in: drop it, don't report it
    return null;
  }
  if (p.attempt < 2) {
    p.attempt = 2;
    p.lastAt = t;
    const r = startCheck(p.kind, now, true);
    const say = EN ? `June, it's Sonny again. ${r.say.replace(/^Good \w+, June\. /, "")}` : `할머니, Sonny 예요. ${r.say.replace(/^할머니, /, "")}`;
    return { ...r, say, note: `${p.kind} check-in, second try` };
  }
  p.done = true;
  wellness.flow = undefined;
  ringNoAnswer(new Date(p.firstAt), new Date(p.lastAt), now);
  return { say: "", actions: [], note: "no answer twice, called Sarah" };
}

/** Two check-ins with no answer: ring mom. second = first when only one try is known. */
export function ringNoAnswer(first: Date, second: Date, now: Date, script?: string): GuardianCall {
  const at = now.toISOString();
  recordSlip("missed_checkin", now);
  for (const c of store.calls) if (c.status === "ringing" && c.reason === "no_answer") c.status = "missed";
  const two = Math.abs(second.getTime() - first.getTime()) >= 60_000;
  const line =
    script ??
    (EN
      ? `Hi, it's Sonny. June hasn't answered her ${clockShort(first)} check-in${two ? `, or the one at ${clockShort(second, true)}` : ""}. Will you call her, or should I call her neighbor?`
      : `안녕하세요, Sonny 예요. 할머니가 ${kstClock(first)} 안부 확인${two ? `에도, ${kstClock(second)} 확인에도` : "에"} 대답이 없으세요. 직접 전화하실래요, 이웃분께 부탁할까요?`);
  const call: GuardianCall = { id: crypto.randomUUID(), at, script: line, amount: 0, reason: "no_answer", status: "ringing" };
  store.calls.push(call);
  const short = EN ? `Sonny called Sarah: no answer from June since ${clockShort(first)}` : `Sonny 가 따님께 전화: ${kstClock(first)} 이후로 할머니 대답이 없음`;
  logEvent("call", `${short} (call ${call.id})`, at, { visibility: "family", familyText: short });
  return call;
}

// ---------- this week's signals ----------

export function slips(): Slip[] {
  return (wellness.slips ??= seedSlips(Date.now()));
}

export function recordSlip(kind: Slip["kind"], now: Date, what?: string) {
  slips().push({ at: now.toISOString(), kind, what });
  if (kind === "forgot_name") ensureHeadsUp(now);
}

export function signals(now = new Date()) {
  const t = now.getTime();
  const week = 7 * 86_400_000;
  const all = slips();
  const count = (kind: Slip["kind"], from: number, to: number) => all.filter((s) => s.kind === kind && Date.parse(s.at) >= from && Date.parse(s.at) < to).length;
  const thisWeek = (k: Slip["kind"]) => count(k, t - week, t + 60_000);
  const lastWeek = (k: Slip["kind"]) => count(k, t - 2 * week, t - week);
  return {
    forgotNames: thisWeek("forgot_name"),
    repeatedQuestions: thisWeek("repeat"),
    missedCheckins: thisWeek("missed_checkin"),
    vsLastWeek: { forgotNames: lastWeek("forgot_name"), repeatedQuestions: lastWeek("repeat"), missedCheckins: lastWeek("missed_checkin") },
    demo: all.some((s) => s.demo && Date.parse(s.at) >= t - 2 * week),
    note: SIGNALS_NOTE,
  };
}

/** Once a week at most: tell mom when she forgot a name more often than last week. */
export function ensureHeadsUp(now = new Date()) {
  const t = now.getTime();
  if (wellness.headsUpAt && t - wellness.headsUpAt < 7 * 86_400_000) return;
  const s = signals(now);
  const n = s.forgotNames;
  const last = s.vsLastWeek.forgotNames;
  if (n < 2 || n <= last) return;
  const recent = slips().filter((x) => x.kind === "forgot_name" && x.what).pop();
  const what = recent?.what ?? (EN ? "a name" : "이름");
  wellness.headsUpAt = t;
  const times = n === 2 ? "twice" : `${n} times`;
  const text = EN
    ? `Heads-up: June forgot ${what} ${times} this week (${last} last week). Worth mentioning to her doctor. ${SIGNALS_NOTE}`
    : `알림: 할머니가 이번 주에 ${what}을 ${n}번 잊으셨어요(지난주 ${last}번). 진료 때 말씀드려 볼 만해요. 진단이 아닌 생활 신호예요.`;
  logEvent("memory", `${text}${s.demo ? " (demo data)" : ""}`, now.toISOString(), { visibility: "family" });
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣 ]/g, " ").replace(/\s+/g, " ").trim();
const QUESTION = /\?\s*$|^(what|when|where|who|is|are|did|do|does|can|will|how)\b|언제|어디|뭐|누구|몇/i;

/** The same question again within three hours counts once as a repeat. */
export function noteRepeat(text: string, now: Date, earlier: { text: string; at: string }[]) {
  const q = norm(text);
  if (q.split(" ").length < 3 || !QUESTION.test(text)) return;
  const since = now.getTime() - 3 * 60 * 60_000;
  const same = earlier.filter((e) => Date.parse(e.at) >= since && norm(e.text) === q).length;
  if (same === 1) recordSlip("repeat", now);
}
