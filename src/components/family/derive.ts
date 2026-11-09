import type { ActivityEvent } from "@/lib/types";
import { T } from "./strings";

export type Tone = "grandma" | "tv" | "family" | "memory" | "info" | "warn" | "urgent" | "task";

export type RequestKind = "taxi" | "order";

export type FeedItem = {
  event: ActivityEvent;
  label: string;
  text: string;
  tone: Tone;
  request: RequestKind | null;
};

const FAMILY_NAMES = /^(엄마|아빠|딸|아들|손녀|손자|가족|이모|삼촌|mom|dad|daughter|son|family)$/i;
// "[urgent] ...", "(warn) ...", or the agent's own "가족 알림(urgent): ..."
const LEVEL_PREFIX = /^(?:가족\s?알림\s*)?[[(](info|warn|urgent)[\])]\s*:?\s*/i;
const URGENT_WORDS = /긴급|응급|119|쓰러|아프|아파|숨이|가슴|emergenc|911|chest|fell|fall(en)?\b|pain|hurt|can't breathe/i;
const TAXI_WORDS = /택시|카카오\s?T|차량|배차|\btaxi|\bcab\b|\bride\b|uber|lyft/i;
const ORDER_WORDS = /주문|장보기|장 보기|배달|구매|결제|쿠팡|마트|\border|grocer|deliver|purchase|shopping/i;
const PROACTIVE = /^먼저 말 걸기/;

function level(text: string): { tone: "info" | "warn" | "urgent" | null; rest: string } {
  const m = text.match(LEVEL_PREFIX);
  const rest = text.replace(LEVEL_PREFIX, "");
  return { tone: m ? (m[1].toLowerCase() as "info" | "warn" | "urgent") : null, rest };
}

export function requestKind(e: ActivityEvent): RequestKind | null {
  if (e.kind !== "alert" && e.kind !== "task") return null;
  if (TAXI_WORDS.test(e.text)) return "taxi";
  if (ORDER_WORDS.test(e.text)) return "order";
  return null;
}

function isUrgent(e: ActivityEvent): boolean {
  if (e.kind !== "alert") return false;
  const { tone, rest } = level(e.text);
  return tone ? tone === "urgent" : URGENT_WORDS.test(rest);
}

// Drop a leading "택시 요청:" style prefix when the label already says it.
const REQUEST_PREFIX = /^((택시|주문|장보기)\s?(요청|부탁)|(taxi|ride|order|grocery) request)\s*[:·]\s*/i;
const REPLY_PREFIX = /^(할머니 답 요약|grandma'?s (reply|answer)( summary)?)\s*:\s*/i;
const MEMORY_PREFIX = /^(새로 배운 것|건강 기록|learned|health( record)?)\s*:\s*/i;

export function toFeedItem(e: ActivityEvent): FeedItem {
  const request = requestKind(e);
  const requestLabel = request === "taxi" ? T.lTaxi : request === "order" ? T.lOrder : null;
  switch (e.kind) {
    case "heard":
      return { event: e, label: T.lGrandma, text: e.text, tone: "grandma", request };
    case "said":
      return { event: e, label: T.lAgent, text: e.text, tone: "tv", request };
    case "tuned":
      return { event: e, label: T.lChannel, text: e.text, tone: "tv", request };
    case "scheduled":
      return { event: e, label: T.lScheduled, text: e.text, tone: "tv", request };
    case "memory":
      return { event: e, label: T.lRecord, text: e.text.replace(MEMORY_PREFIX, ""), tone: "memory", request };
    case "task":
      return {
        event: e,
        label: requestLabel ?? T.lTask,
        text: e.text.replace(REQUEST_PREFIX, ""),
        tone: request ? "warn" : "task",
        request,
      };
    case "family": {
      // Our own route logs "엄마: ...". Anything else is the agent reporting back to the family.
      const mine = e.text.match(/^(\S+):\s*([\s\S]*)$/);
      if (mine && FAMILY_NAMES.test(mine[1])) return { event: e, label: mine[1], text: mine[2], tone: "family", request };
      return { event: e, label: T.lNews, text: level(e.text).rest.replace(REPLY_PREFIX, ""), tone: "info", request };
    }
    case "alert": {
      const { tone, rest } = level(e.text);
      const t = tone ?? (URGENT_WORDS.test(rest) ? "urgent" : "warn");
      const label = requestLabel ?? (t === "urgent" ? T.lUrgent : T.lAlert);
      return { event: e, label, text: rest.replace(REQUEST_PREFIX, ""), tone: request ? "warn" : t, request };
    }
  }
}

const TZ = "Asia/Seoul";
const timeFmt = new Intl.DateTimeFormat(T.locale, { hour: "numeric", minute: "2-digit", timeZone: TZ });

export function clock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : timeFmt.format(d);
}

function tunedLabel(text: string): string {
  const m = text.match(/(\d{1,3})\s?번/) ?? text.match(/channel\s?(\d{1,3})/i);
  return m ? T.channel(m[1]) : text;
}

export type Summary = {
  lastTalk: string; // e.g. "오전 9:12"
  medicine: "taken" | "asked" | "unknown";
  tv: string;
  sentence: string;
  reassure: { tone: "ok" | "urgent"; text: string } | null;
};

const MED_TAKEN = /약.{0,12}(먹었|먹음|드셨|복용|챙겨\s?드셨)|(먹었|드셨).{0,6}약|\b(took|taken|had)\b.{0,24}\b(pills?|medicine|meds|medication)|\b(pills?|medicine|meds|medication)\b.{0,16}\b(taken|took|done)\b/i;
const MED_NOT = /안\s?(먹|드)|아직|\bnot\b|n't|\byet\b/i;
const MED_ASK = /약|pills?|medicine|meds|medication/i;

// Runs on the server over the raw log, so mom gets the facts without grandma's words.
export function summarize(events: ActivityEvent[], currentChannel: number | null): Summary {
  let lastHeard: ActivityEvent | undefined;
  let lastTuned: ActivityEvent | undefined;
  let medicine: Summary["medicine"] = "unknown";
  let urgent = false;

  for (const e of events) {
    if (e.kind === "heard" && !PROACTIVE.test(e.text)) lastHeard = e;
    if (e.kind === "tuned") lastTuned = e;
    if (isUrgent(e)) urgent = true;
    const text = e.familyText ? `${e.text} ${e.familyText}` : e.text;
    const question = /\?\s*$/.test(e.text);
    if (medicine !== "taken" && e.kind !== "said" && !question && MED_TAKEN.test(text) && !MED_NOT.test(text)) {
      medicine = "taken";
    } else if (medicine === "unknown" && e.kind === "said" && MED_ASK.test(e.text)) {
      medicine = "asked";
    }
  }

  const lastTalk = lastHeard ? clock(lastHeard.at) : "";
  const tv =
    currentChannel != null ? T.channel(currentChannel) : lastTuned ? tunedLabel(lastTuned.text) : events.length ? T.nowOn : T.nowWaiting;

  const parts = [
    lastTalk ? T.lastTalk(lastTalk) : T.noTalk,
    medicine === "taken" ? T.medsTakenLine : medicine === "asked" ? T.medsAskedLine : T.medsUnknownLine,
  ];

  const reassure: Summary["reassure"] = urgent
    ? { tone: "urgent", text: T.reassureUrgent }
    : lastTalk && medicine === "taken"
      ? { tone: "ok", text: T.reassureOk }
      : null;

  return { lastTalk, medicine, tv, sentence: T.join(parts), reassure };
}
