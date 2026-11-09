import type { ActivityEvent } from "@/lib/types";

export type Tone = "grandma" | "tv" | "family" | "memory" | "info" | "warn" | "urgent" | "task";

export type RequestKind = "taxi" | "order";

export type FeedItem = {
  event: ActivityEvent;
  label: string;
  text: string;
  tone: Tone;
  request: RequestKind | null;
};

const FAMILY_NAMES = /^(엄마|아빠|딸|아들|손녀|손자|가족|이모|삼촌)$/;
// "[urgent] ...", "(warn) ...", or the agent's own "가족 알림(urgent): ..."
const LEVEL_PREFIX = /^(?:가족\s?알림\s*)?[[(](info|warn|urgent)[\])]\s*:?\s*/i;
const URGENT_WORDS = /긴급|응급|119|쓰러|아프|아파|숨이|가슴/;
const TAXI_WORDS = /택시|카카오\s?T|차량|배차|ride/i;
const ORDER_WORDS = /주문|장보기|장 보기|배달|구매|결제|쿠팡|마트/;
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
const REQUEST_PREFIX = /^(택시|주문|장보기)\s?(요청|부탁)\s*[:·]\s*/;

export function toFeedItem(e: ActivityEvent): FeedItem {
  const request = requestKind(e);
  const requestLabel = request === "taxi" ? "택시 요청" : request === "order" ? "주문 요청" : null;
  switch (e.kind) {
    case "heard":
      return { event: e, label: "할머니", text: e.text, tone: "grandma", request };
    case "said":
      return { event: e, label: "TV", text: e.text, tone: "tv", request };
    case "tuned":
      return { event: e, label: "채널", text: e.text, tone: "tv", request };
    case "scheduled":
      return { event: e, label: "예약", text: e.text, tone: "tv", request };
    case "memory":
      return { event: e, label: "기록", text: e.text.replace(/^(새로 배운 것|건강 기록):\s*/, ""), tone: "memory", request };
    case "task":
      return {
        event: e,
        label: requestLabel ?? "할 일",
        text: e.text.replace(REQUEST_PREFIX, ""),
        tone: request ? "warn" : "task",
        request,
      };
    case "family": {
      // Our own route logs "엄마: ...". Anything else is the agent reporting back to the family.
      const mine = e.text.match(/^(\S+):\s*([\s\S]*)$/);
      if (mine && FAMILY_NAMES.test(mine[1])) return { event: e, label: mine[1], text: mine[2], tone: "family", request };
      return { event: e, label: "할머니 소식", text: level(e.text).rest.replace(/^할머니 답 요약:\s*/, ""), tone: "info", request };
    }
    case "alert": {
      const { tone, rest } = level(e.text);
      const t = tone ?? (URGENT_WORDS.test(rest) ? "urgent" : "warn");
      const label = requestLabel ?? (t === "urgent" ? "긴급 알림" : "알림");
      return { event: e, label, text: rest.replace(REQUEST_PREFIX, ""), tone: request ? "warn" : t, request };
    }
  }
}

const TZ = "Asia/Seoul";
const timeFmt = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit", timeZone: TZ });

export function clock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : timeFmt.format(d);
}

function tunedLabel(text: string): string {
  const m = text.match(/(\d{1,3})\s?번/);
  return m ? `${m[1]}번 채널` : text;
}

export type Summary = {
  lastTalk: string; // e.g. "오전 9:12"
  medicine: "taken" | "asked" | "unknown";
  tv: string;
  sentence: string;
  reassure: { tone: "ok" | "urgent"; text: string } | null;
};

const MED_TAKEN = /약.{0,12}(먹었|먹음|드셨|복용|챙겨\s?드셨)|(먹었|드셨).{0,6}약/;
const MED_NOT = /안\s?(먹|드)|아직/;

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
    } else if (medicine === "unknown" && e.kind === "said" && /약/.test(e.text)) {
      medicine = "asked";
    }
  }

  const lastTalk = lastHeard ? clock(lastHeard.at) : "";
  const tv =
    currentChannel != null ? `${currentChannel}번 채널` : lastTuned ? tunedLabel(lastTuned.text) : events.length ? "켜져 있어요" : "연결 기다리는 중";

  const parts = [
    lastTalk ? `${lastTalk}에 마지막으로 말씀하셨어요` : "오늘은 아직 말씀이 없으셨어요",
    medicine === "taken" ? "약은 드셨어요" : medicine === "asked" ? "약은 여쭤봤고 답을 기다려요" : "약 기록은 아직 없어요",
  ];

  const reassure: Summary["reassure"] = urgent
    ? { tone: "urgent", text: "확인이 필요한 알림이 있어요. 지금 전화해 보세요." }
    : lastTalk && medicine === "taken"
      ? { tone: "ok", text: "오늘은 전화 안 하셔도 괜찮아요." }
      : null;

  return { lastTalk, medicine, tv, sentence: `${parts.join(", ")}.`, reassure };
}
