import type { ActivityEvent } from "@/lib/types";

export type Tone = "grandma" | "tv" | "family" | "memory" | "info" | "warn" | "urgent";

export type FeedItem = {
  event: ActivityEvent;
  label: string;
  text: string;
  tone: Tone;
  request: RequestKind | null;
};

export type RequestKind = "taxi" | "order";

const FAMILY_NAMES = /^(엄마|아빠|딸|아들|손녀|손자|가족|이모|삼촌)$/;
const LEVEL_PREFIX = /^\[(info|warn|urgent)\]\s*/i;
const URGENT_WORDS = /긴급|응급|119|쓰러|아프|아파|숨이|가슴/;
const TAXI_WORDS = /택시|카카오\s?T|차량|배차|ride/i;
const ORDER_WORDS = /주문|장보기|장 보기|배달|구매|결제|쿠팡|마트/;

// Alerts may carry a level prefix: "[info] ...", "[warn] ...", "[urgent] ...". No prefix means warn.
function alertLevel(text: string): { tone: Tone; rest: string } {
  const m = text.match(LEVEL_PREFIX);
  const rest = text.replace(LEVEL_PREFIX, "");
  if (m) return { tone: m[1].toLowerCase() as Tone, rest };
  return { tone: URGENT_WORDS.test(rest) ? "urgent" : "warn", rest };
}

export function requestKind(e: ActivityEvent): RequestKind | null {
  if (e.kind !== "alert") return null;
  if (TAXI_WORDS.test(e.text)) return "taxi";
  if (ORDER_WORDS.test(e.text)) return "order";
  return null;
}

export function toFeedItem(e: ActivityEvent): FeedItem {
  const request = requestKind(e);
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
      return { event: e, label: "배운 것", text: e.text, tone: "memory", request };
    case "family": {
      // Our own route logs "엄마: ...". Anything else is the agent reporting back to the family.
      const mine = e.text.match(/^(\S+):\s*([\s\S]*)$/);
      if (mine && FAMILY_NAMES.test(mine[1])) return { event: e, label: mine[1], text: mine[2], tone: "family", request };
      return { event: e, label: "할머니 소식", text: e.text, tone: "info", request };
    }
    case "alert": {
      const { tone, rest } = alertLevel(e.text);
      const label = request === "taxi" ? "택시 요청" : request === "order" ? "주문 요청" : tone === "urgent" ? "긴급 알림" : "알림";
      // Drop a leading "택시 요청:" style prefix when the label already says it.
      const text = rest.replace(/^(택시|주문|장보기)\s?(요청|부탁)\s*[:·]\s*/, "");
      return { event: e, label, text, tone: request ? "warn" : tone, request };
    }
  }
}

function tunedLabel(text: string): string {
  const m = text.match(/(\d{1,3})\s?번/);
  return m ? `${m[1]}번 채널` : text;
}

const TZ = "Asia/Seoul";
const timeFmt = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit", timeZone: TZ });

export function clock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : timeFmt.format(d);
}

export type Summary = {
  lastTalk: string; // e.g. "오전 9:12"
  medicine: "taken" | "asked" | "unknown";
  tv: string;
  sentence: string;
};

const MED_TAKEN = /약.{0,12}(먹었|먹음|드셨|복용|챙겨\s?드셨)|(먹었|드셨).{0,6}약/;
const MED_ASK = /약/;

export function summarize(events: ActivityEvent[], currentChannel: number | null): Summary {
  let lastHeard: ActivityEvent | undefined;
  let lastTuned: ActivityEvent | undefined;
  let medicine: Summary["medicine"] = "unknown";

  for (const e of events) {
    if (e.kind === "heard") lastHeard = e;
    if (e.kind === "tuned") lastTuned = e;
    const question = /\?\s*$/.test(e.text);
    if (medicine !== "taken" && (e.kind === "heard" || e.kind === "memory" || e.kind === "alert" || e.kind === "family") && !question && MED_TAKEN.test(e.text) && !/안\s?(먹|드)/.test(e.text)) {
      medicine = "taken";
    } else if (medicine === "unknown" && e.kind === "said" && MED_ASK.test(e.text)) {
      medicine = "asked";
    }
  }

  const lastTalk = lastHeard ? clock(lastHeard.at) : "";
  const tv = currentChannel != null ? `${currentChannel}번 채널` : lastTuned ? tunedLabel(lastTuned.text) : events.length ? "켜져 있어요" : "연결 기다리는 중";

  const parts = [
    lastTalk ? `${lastTalk}에 마지막으로 말씀하셨어요` : "오늘은 아직 말씀이 없으셨어요",
    medicine === "taken" ? "약은 드셨어요" : medicine === "asked" ? "약은 여쭤봤고 답을 기다려요" : "약 기록은 아직 없어요",
  ];
  return { lastTalk, medicine, tv, sentence: `${parts.join(", ")}.` };
}
