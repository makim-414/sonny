import { APP_LANG } from "@/lib/brand";
import { kstClock, kstParts } from "@/lib/scheduler";
import { logEvent, store } from "@/lib/store";
import type { GuardianCall, TvAction } from "@/lib/types";

// Sonny keeps an eye out between turns: a task grandma gets stuck on, long silences,
// and days when mom should check in. All decisions here are rules, not model calls,
// so they are fast and predictable on stage.

const EN = APP_LANG === "en";
export const STRUGGLE_MS = 10 * 60_000; // demo default; the demo clock can fast-forward
const STALE_MS = 2 * 60 * 60_000;
const CONFUSED = /\b(i )?(don'?t|do not) (know|remember)\b|\bwhat\??\s*$|\bhuh\b|\bi forgot\b|\bnot sure\b|\b(uh+|um+|hmm+)\b|\bconfus|모르겠|기억이 안|뭐라고|어\?$/i;
const RIDE_INTENT = /\b(taxi|cab|ride)\b|택시/i;

type OpenTask = { kind: "ride"; startedAt: number; confused: number; called: boolean; destHint: string };
type Watch = { task?: OpenTask; lastVoiceAt?: number; idleSince?: number; idleAlerted?: boolean };
const g = globalThis as unknown as { __sonnyWatch?: Watch };
export const watch: Watch = g.__sonnyWatch ?? (g.__sonnyWatch = {});

export function resetWatch() {
  watch.task = undefined;
  watch.lastVoiceAt = undefined;
  watch.idleSince = undefined;
  watch.idleAlerted = undefined;
}

export type Quick = { say: string; actions: TvAction[]; note: string };

function ring(reason: GuardianCall["reason"], script: string, at: string, logText: string): GuardianCall {
  const call: GuardianCall = { id: crypto.randomUUID(), at, script, amount: 0, reason, status: "ringing" };
  store.calls.push(call);
  logEvent("call", `${logText} (call ${call.id})`, at, { visibility: "family", familyText: logText });
  return call;
}

/** Called on every voice turn before the model. Returns a reply when Sonny should step in. */
export function onVoice(text: string, now: Date): Quick | null {
  const t = now.getTime();
  watch.lastVoiceAt = t;
  watch.idleSince = undefined;
  watch.idleAlerted = undefined;
  if (!watch.task && RIDE_INTENT.test(text)) {
    watch.task = { kind: "ride", startedAt: t, confused: 0, called: false, destHint: "" };
    return null;
  }
  if (!watch.task || watch.task.called) return null;
  if (CONFUSED.test(text)) watch.task.confused += 1;
  return struggleCheck(now);
}

/** Checked on every request (the demo clock may have jumped ahead). */
export function struggleCheck(now: Date): Quick | null {
  const task = watch.task;
  if (!task || task.called) return null;
  // An old unfinished task (yesterday's taxi) is dropped, not reported.
  if (now.getTime() - task.startedAt > STALE_MS) {
    watch.task = undefined;
    return null;
  }
  const minutes = Math.round((now.getTime() - task.startedAt) / 60_000);
  if (task.confused < 2 && now.getTime() - task.startedAt < STRUGGLE_MS) return null;
  task.called = true;
  const at = now.toISOString();
  const why = task.confused >= 2 ? "seems stuck on where to go" : "can't seem to finish it";
  const script = `Hi Sarah, it's Sonny. June has been trying to book a taxi${minutes >= 1 ? ` for ${minutes} minutes` : ""} and ${why}. Want me to book it to Riverside Family Clinic, or will you call her?`;
  const call = ring("struggle", script, at, EN ? "Sonny called Sarah: June seems stuck booking a taxi" : "Sonny 가 따님께 전화: 할머니가 택시 부르기에서 막히심");
  const say = EN ? "No rush, June. I'll ask Sarah to help." : "천천히 하셔도 돼요, 할머니. 따님께 도와 달라고 할게요.";
  return { say, actions: [{ type: "showCard", title: EN ? "Asking Sarah to help" : "따님께 도움 요청 중", body: EN ? "Booking a taxi" : "택시 부르기" }], note: `struggle call ${call.id}` };
}

/** A ride or order went through: the open task is finished. */
export function taskDone() {
  watch.task = undefined;
}

/** "idle-checkin": first one gets a gentle hello from the model; a second one with no reply alerts the family silently. */
export function onIdle(now: Date, attempt = 1): Quick | "ask-model" {
  const t = now.getTime();
  // "idle-checkin:2" from the screen is the second try even if the first one was missed.
  if (attempt >= 2) watch.idleSince ??= t;
  else if (watch.idleSince === undefined) {
    watch.idleSince = t;
    return "ask-model";
  }
  if (watch.idleAlerted) return { say: "", actions: [], note: "idle, already alerted" };
  watch.idleAlerted = true;
  const since = kstClock(new Date(watch.lastVoiceAt ?? watch.idleSince));
  const msg = EN ? `No answer from grandma since ${since}` : `${since} 이후로 할머니 대답이 없어요`;
  logEvent("alert", `[warn] ${msg}`, now.toISOString(), { visibility: "family" });
  return { say: "", actions: [{ type: "notifyFamily", message: msg, level: "warn" }], note: "idle alert" };
}

/** "family-nudge": pick one reason from today's log and ring mom, or do nothing. */
export function onNudge(now: Date, privateTurn: (eventText: string) => boolean): Quick {
  const at = now.toISOString();
  const today = kstParts(now);
  const isToday = (iso: string) => {
    const p = kstParts(new Date(iso));
    return p.year === today.year && p.month === today.month && p.day === today.day;
  };
  const todays = store.events.filter((e) => isToday(e.at));
  const heard = todays.filter((e) => e.kind === "heard" && !/^먼저 말 걸기/.test(e.text));
  const mentions = heard.filter((e) => /\bsarah\b|\bdaughter\b|수진|딸/i.test(e.text) && !privateTurn(e.text)).length;
  const lesson = [...todays].reverse().find((e) => e.kind === "memory" && e.visibility === "family" && /^New lesson:|새로 배운 것\(lesson\)/.test(e.text));
  const lessonText = lesson?.familyText?.replace(/^Grandma taught Sonny:\s*/, "").replace(/\s*\(\d+ this month\)$/, "");
  const twoDays = now.getTime() - 2 * 86_400_000;
  const momWrote = store.events.some((e) => e.kind === "family" && /^(Mom|엄마|Sarah)\b/i.test(e.text) && Date.parse(e.at) >= twoDays);

  const parts: string[] = [];
  if (heard.length <= 1) parts.push("June had a quiet day");
  if (mentions >= 2) parts.push(`${parts.length ? "she" : "June"} mentioned you ${mentions === 2 ? "twice" : `${mentions} times`}`);
  if (!momWrote && parts.length < 2) parts.push(parts.length ? "it's been a couple of days since your last message" : "It's been a couple of days since your last message to June");
  if (lessonText) parts.push(`She taught me her ${lessonText.toLowerCase()} trick today, ask her about it`);
  if (parts.length === 0) return { say: "", actions: [], note: "no reason to nudge" };

  const first = parts.filter((p) => !p.startsWith("She taught"));
  const brag = parts.find((p) => p.startsWith("She taught"));
  const lead = first.length ? `${first.join(", and ")}.` : "";
  const script = `Hi Sarah, it's Sonny. ${lead} She'd love a quick call tonight.${brag ? ` ${brag}.` : ""}`.replace(/\s+/g, " ");
  const call = ring("nudge", script, at, EN ? "Sonny suggested a call to grandma tonight" : "Sonny 가 오늘 밤 할머니께 안부 전화를 권함");
  return { say: "", actions: [], note: `nudge call ${call.id}` };
}
