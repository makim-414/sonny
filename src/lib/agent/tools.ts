import { tool } from "ai";
import { z } from "zod";
import { channelName, nowOn, searchEpg } from "@/lib/epg";
import { isLesson, type MemoryFact, type MemoryStore } from "@/lib/memory";
import { addSchedule, kstClock, kstParts } from "@/lib/scheduler";
import { logEvent, store } from "@/lib/store";
import type { ActivityEvent, TvAction } from "@/lib/types";
import { orderErrand, type ErrandOrder } from "./services/errand";
import { newsToday, weatherToday } from "./services/info";
import { requestRide, type RideBooking } from "./services/ride";

// One request's context. Tools push TV actions here; the route returns them.
export type AgentContext = {
  now: Date;
  memory: MemoryStore;
  actions: TvAction[];
  private: boolean; // this turn was kept from the family
};

export const DEMO = "demo data";

// Requests waiting for mom's approval in the family app.
export type PendingRequest =
  | { kind: "taxi"; at: string; ride: RideBooking }
  | { kind: "order"; at: string; order: ErrandOrder };

type HealthRecord = { at: string; medicineTaken?: boolean; feeling: string; severity: string; symptoms: string[] };
type Shared = { health: HealthRecord[]; requests: PendingRequest[] };
const g = globalThis as unknown as { __hyodoAgent?: Shared };
export const shared: Shared = g.__hyodoAgent ?? (g.__hyodoAgent = { health: [], requests: [] });

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

function log(ctx: AgentContext, kind: ActivityEvent["kind"], text: string, opts: Pick<ActivityEvent, "visibility" | "familyText"> = {}) {
  return logEvent(kind, text, ctx.now.toISOString(), opts);
}

/** Family alert in the family app's format: kind alert, "[level] text". */
function alertFamily(ctx: AgentContext, message: string, level: "info" | "warn" | "urgent") {
  ctx.actions.push({ type: "notifyFamily", message, level });
  log(ctx, "alert", `[${level}] ${message}`, { visibility: "family" });
}

export async function lessonsThisMonth(memory: MemoryStore, now: Date): Promise<MemoryFact[]> {
  const { year, month } = kstParts(now);
  return (await memory.all()).filter((f) => {
    if (!isLesson(f)) return false;
    const p = kstParts(new Date(f.at));
    return p.year === year && p.month === month;
  });
}

const innerAction = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("tune"), channel: z.number().int().describe("틀 채널 번호") }),
    z.object({ type: z.literal("showCard"), title: z.string(), body: z.string().optional() }),
  ])
  .describe("시간이 되면 TV가 할 일. 프로그램이면 tune, 그 밖엔 showCard");

export function createTools(ctx: AgentContext) {
  const clock = () => kstClock(ctx.now);
  return {
    memory_remember: tool({
      description:
        "할머니가 가르쳐 주신 것이나 새로 알게 된 사실을 GBrain 장기 기억에 출처와 함께 저장한다. kind: lesson 은 요리법·살림 지혜·동네 정보처럼 다른 분들께도 쓸모 있는 것, personal 은 할머니 개인 사실(가족, 습관, 몸, 약속).",
      inputSchema: z.object({
        fact: z.string().describe("한 문장 사실. 예: '손주 이름은 민수다', '김장 배추는 소금물에 8시간 절인다'"),
        kind: z.enum(["lesson", "personal"]),
        card: z.string().describe("TV 카드에 띄울 아주 짧은 요약. 예: '손주 이름은 민수', '김장 배추 절이기'"),
        topic: z.enum(["likes", "routine", "health", "family", "place", "other"]).optional().describe("personal 일 때 분류"),
      }),
      execute: async ({ fact, kind, card, topic }) => {
        const category = kind === "lesson" ? "lesson" : (topic ?? "taught");
        const provenance = `김순자 할머니가 TV 대화에서 가르침, ${ctx.now.toISOString()}`;
        const saved = await ctx.memory.remember({ text: fact, category, source: "grandma", provenance, at: ctx.now.toISOString() });
        if (kind === "lesson") {
          const n = (await lessonsThisMonth(ctx.memory, ctx.now)).length;
          ctx.actions.push({ type: "showCard", title: `배웠어요: ${card}`, body: `이번 달 할머니께 배운 것 ${n}개\n다른 분들께도 도움이 될 거예요` });
          log(ctx, "memory", `새로 배운 것(lesson): ${fact} · 이번 달 ${n}개`, { visibility: "family", familyText: `할머니께 새로 배운 것: ${card} (이번 달 ${n}개)` });
          return { saved: true, id: saved.id, kind, lessonsThisMonth: n, backend: ctx.memory.backend };
        }
        ctx.actions.push({ type: "showCard", title: `기억할게요: ${card}`, body: "할머니께 배운 소중한 기억이에요" });
        log(ctx, "memory", `새로 배운 것(personal): ${fact}`, { visibility: "private" });
        ctx.private = true;
        return { saved: true, id: saved.id, kind, backend: ctx.memory.backend };
      },
    }),

    memory_correct: tool({
      description:
        "할머니가 기억을 고쳐 주시면(예: '아니 화요일 말고 수요일이야') 예전 사실을 새 사실로 정정한다. GBrain 에 정정 기록이 남는다. id 는 기억 목록의 (gbrain-N) 값.",
      inputSchema: z.object({ id: z.string(), fact: z.string().describe("고친 사실 한 문장"), card: z.string().describe("짧은 요약") }),
      execute: async ({ id, fact, card }) => {
        const before = (await ctx.memory.all()).find((f) => f.id === id);
        const saved = await ctx.memory.correct(id, fact, `김순자 할머니가 정정함, ${ctx.now.toISOString()}`);
        if (!saved) return { ok: false, error: "그 id 의 기억이 없어요" };
        ctx.actions.push({ type: "showCard", title: `고쳤어요: ${card}`, body: before ? `전에는: ${before.text}` : undefined });
        const shared = before && isLesson(before);
        log(ctx, "memory", `기억 정정: "${before?.text ?? id}" → "${fact}"`, shared ? { visibility: "family" } : { visibility: "private" });
        if (!shared) ctx.private = true;
        return { ok: true, id: saved.id, replaced: id };
      },
    }),

    memory_recall: tool({
      description: "할머니에 대한 기억을 더 찾는다. 위 기억 목록에 없을 때만.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const facts = await ctx.memory.recall(query, 6);
        return { facts: facts.map((f) => ({ id: f.id, text: f.text, kind: isLesson(f) ? "lesson" : "personal" })) };
      },
    }),

    lessons_show: tool({
      description: "이번 달 할머니께 배운 것 개수와 최근 몇 개를 TV 카드로 보여 준다.",
      inputSchema: z.object({}),
      execute: async () => {
        const list = await lessonsThisMonth(ctx.memory, ctx.now);
        const recent = list.slice(-3).map((f) => `· ${f.text}`).join("\n");
        ctx.actions.push({ type: "showCard", title: `이번 달 할머니께 배운 것 ${list.length}개`, body: `${recent}\n다른 분들께도 도움이 돼요` });
        return { count: list.length };
      },
    }),

    keep_private: tool({
      description: "할머니가 '딸한테 말하지 마', '비밀이야' 하시면 부른다. 이번 대화를 가족에게 알리지 않는다.",
      inputSchema: z.object({ what: z.string().describe("무엇을 비밀로 하는지 짧게") }),
      execute: async ({ what }) => {
        ctx.private = true;
        log(ctx, "memory", `비밀로 하기: ${what}`, { visibility: "private" });
        return { ok: true };
      },
    }),

    schedule_at: tool({
      description: "정해진 시간에 TV가 알려 드리거나 채널을 틀게 예약한다. 약, 절, 병원, 프로그램 시작 알림.",
      inputSchema: z.object({
        at: z.string().describe("ISO 시각, +09:00 포함. 예: 2026-11-09T20:00:00+09:00"),
        label: z.string().describe("짧은 이름. 예: '혈압약 드실 시간'"),
        then: innerAction,
      }),
      execute: async ({ at, label, then }) => {
        const ms = Date.parse(at);
        if (!Number.isFinite(ms)) return { ok: false, error: "시간 형식이 틀렸어요. ISO로 다시." };
        const iso = new Date(ms).toISOString();
        const inner: TvAction =
          then.type === "tune" ? { type: "tune", channel: then.channel, reason: label } : { type: "showCard", title: then.title, body: then.body };
        ctx.actions.push(addSchedule(iso, label, inner));
        log(ctx, "scheduled", `${kstClock(new Date(ms))} ${label}`, { visibility: "family" });
        return { ok: true, at: iso, spoken: kstClock(new Date(ms)) };
      },
    }),

    ride_request: tool({
      description:
        "택시를 요청한다(가짜 서비스, 실제 호출·결제 없음). 목적지와 시간을 할머니께 확인한 뒤 부른다. 따님 승인 요청과 TV 카드는 자동. 승인되면 차가 배정된다.",
      inputSchema: z.object({
        to: z.string().describe("목적지. 예: '병원', '서울바른내과의원', '보현사'"),
        from: z.string().optional().describe("출발지, 없으면 집"),
        when: z.string().optional().describe("ISO 시각. 지금이면 비운다"),
      }),
      execute: async ({ to, from, when }) => {
        const ride = requestRide({ to, from, when, now: ctx.now });
        shared.requests.push({ kind: "taxi", at: ctx.now.toISOString(), ride });
        const pickup = kstClock(new Date(ride.pickupAt));
        ctx.actions.push({
          type: "showCard",
          title: "택시 요청했어요",
          body: `${ride.pickup.name} → ${ride.destination.name}\n${ride.status === "reserved" ? `${pickup} 출발` : "지금 출발"}\n따님 확인 중이에요\n${DEMO}`,
        });
        ctx.actions.push({ type: "notifyFamily", message: `택시 요청: ${ride.pickup.name} → ${ride.destination.name}`, level: "info" });
        log(ctx, "task", `택시 요청: ${ride.pickup.name} → ${ride.destination.name}, ${pickup} 출발, 예상 요금 ${won(ride.fareWon)} (${DEMO})`, { visibility: "family" });
        return { ok: true, status: "awaiting_family_approval", destination: ride.destination.name, pickupAt: pickup };
      },
    }),

    errand_order: tool({
      description: "장보기·생필품을 주문한다(가짜 서비스). 따님이 승인하면 배송된다. 승인 요청은 자동.",
      inputSchema: z.object({ items: z.array(z.object({ name: z.string(), qty: z.number().int().min(1).optional() })).min(1) }),
      execute: async ({ items }) => {
        const order = orderErrand({ items, now: ctx.now });
        shared.requests.push({ kind: "order", at: ctx.now.toISOString(), order });
        const list = order.items.map((i) => `${i.name} ${i.qty}개`).join(", ");
        ctx.actions.push({ type: "showCard", title: "장보기 주문 넣었어요", body: `${list}\n합계 ${won(order.totalWon)}\n따님 확인 후 ${order.arrives} 도착\n${DEMO}` });
        ctx.actions.push({ type: "notifyFamily", message: `주문 요청: ${list}`, level: "info" });
        log(ctx, "task", `주문 요청: ${list}, 합계 ${won(order.totalWon)}, ${order.arrives} 도착 (${DEMO})`, { visibility: "family" });
        return { ok: true, status: order.status, total: won(order.totalWon), arrives: order.arrives };
      },
    }),

    health_checkin: tool({
      description:
        "약 복용과 몸 상태를 기록한다. severity 를 정확히 준다. warn·urgent 면 가족 경고가 자동으로 간다 (family_notify 를 따로 부르지 않는다).",
      inputSchema: z.object({
        medicineTaken: z.boolean().optional().describe("약을 드셨는지, 모르면 비운다"),
        feeling: z.string().describe("할머니 말씀 요약. 예: '괜찮다고 하심', '무릎이 쑤신다고 하심'"),
        symptoms: z.array(z.string()).optional(),
        severity: z.enum(["ok", "mild", "warn", "urgent"]).describe("ok 괜찮음, mild 가벼운 불편, warn 아프심, urgent 위급"),
      }),
      execute: async ({ medicineTaken, feeling, symptoms = [], severity }) => {
        shared.health.push({ at: ctx.now.toISOString(), medicineTaken, feeling, symptoms, severity });
        const med = medicineTaken === undefined ? "" : medicineTaken ? `${clock()} 아침 약 드심. ` : "약 아직 안 드심. ";
        // "딸한테 말하지 마" keeps it private, unless it is an emergency.
        const hush = ctx.private && severity !== "urgent";
        log(ctx, "memory", `건강 기록: ${med}${feeling}`, { visibility: hush ? "private" : "family" });
        if (hush) return { recorded: true, familyAlerted: false, keptPrivate: true };
        if (severity === "warn" || severity === "urgent") {
          alertFamily(ctx, `할머니 건강 확인 필요: ${feeling}${symptoms.length ? ` (${symptoms.join(", ")})` : ""}`, severity);
        }
        return { recorded: true, familyAlerted: severity === "warn" || severity === "urgent" };
      },
    }),

    family_notify: tool({
      description: "가족(딸 민정)에게 메시지를 보낸다. 할머니 부탁이나 알릴 일. 가족 메시지에 대한 할머니 답이면 reply=true.",
      inputSchema: z.object({
        message: z.string().describe("가족에게 보낼 한 줄 요약"),
        reply: z.boolean().optional().describe("가족 메시지에 대한 할머니 답 요약이면 true"),
        level: z.enum(["info", "warn", "urgent"]).optional(),
      }),
      execute: async ({ message, reply, level = "info" }) => {
        ctx.actions.push({ type: "notifyFamily", message, level });
        if (reply) log(ctx, "family", `할머니 답 요약: ${message}`, { visibility: "family" });
        else if (level === "info") log(ctx, "family", `할머니 전하는 말: ${message}`, { visibility: "family" });
        else log(ctx, "alert", `[${level}] ${message}`, { visibility: "family" });
        return { sent: true };
      },
    }),

    tv_show: tool({
      description: "TV 화면에 큰 카드(글, 사진)를 띄운다.",
      inputSchema: z.object({ title: z.string(), body: z.string().optional(), imageUrl: z.string().optional() }),
      execute: async ({ title, body, imageUrl }) => {
        ctx.actions.push({ type: "showCard", title, body, imageUrl });
        return { shown: true };
      },
    }),

    info_weather: tool({
      description: "오늘 날씨(할머니 동네). 결과는 TV 카드로도 뜬다.",
      inputSchema: z.object({ card: z.boolean().optional().describe("카드를 띄울지, 기본 true") }),
      execute: async ({ card = true }) => {
        const w = weatherToday();
        if (card) ctx.actions.push({ type: "showCard", title: `오늘 날씨 ${w.sky}`, body: `아침 ${w.morningC}도, 낮 최고 ${w.highC}도\n${w.advice}\n${DEMO}` });
        return w;
      },
    }),

    info_news: tool({
      description: "오늘 소식 몇 가지. 쉬운 말 요약이 같이 온다.",
      inputSchema: z.object({ topic: z.string().optional().describe("건강, 생활, 날씨, 연예 중 하나 또는 비움") }),
      execute: async ({ topic }) => {
        const all = newsToday();
        const items = topic ? all.filter((n) => n.topic === topic) : all;
        const pick = (items.length ? items : all).slice(0, 2);
        ctx.actions.push({ type: "showCard", title: "오늘 소식", body: `${pick.map((n) => `· ${n.plain}`).join("\n")}\n${DEMO}` });
        return { items: pick };
      },
    }),

    tv_play: tool({
      description:
        "프로그램을 찾아 지금 방송 중이면 바로 튼다. 곧 시작하는 것은 later 로 알려 준다(시작할 때 틀어 드릴지 여쭙고, 그러라고 하시면 schedule_at). TV 요청은 이 도구 하나면 된다.",
      inputSchema: z.object({ query: z.string().describe("사람 이름이나 제목. 예: '임영웅', '가요무대', '뉴스'") }),
      execute: async ({ query }) => {
        const hits = searchEpg(query, ctx.now);
        const live = hits.find((h) => h.status === "now");
        const later = hits.filter((h) => h.status === "later").slice(0, 2).map((h) => ({
          channel: h.channel,
          channelName: h.channelName,
          title: h.title,
          startISO: h.start,
          startsAt: kstClock(new Date(h.start)),
          startsInMin: h.startsInMin,
        }));
        if (live) {
          ctx.actions.push({ type: "tune", channel: live.channel, reason: live.title });
          store.currentChannel = live.channel;
          log(ctx, "tuned", `${live.channel}번 ${live.channelName} "${live.title}"`, { visibility: "family" });
        }
        return {
          tuned: live ? { channel: live.channel, channelName: live.channelName, title: live.title } : null,
          later,
          note: "편성은 demo schedule data",
        };
      },
    }),

    epg_search: tool({
      description: "오늘 편성표만 찾아본다(틀지 않음). 틀어 달라는 요청엔 tv_play 를 쓴다.",
      inputSchema: z.object({ query: z.string().describe("예: '임영웅', '가요무대', '뉴스'") }),
      execute: async ({ query }) => {
        const hits = searchEpg(query, ctx.now);
        return {
          results: hits.map((h) => ({
            channel: h.channel,
            channelName: h.channelName,
            title: h.title,
            status: h.status,
            start: h.start,
            startsAt: kstClock(new Date(h.start)),
            startsInMin: h.startsInMin,
          })),
        };
      },
    }),

    tv_tune: tool({
      description: "TV 채널을 바로 바꾼다.",
      inputSchema: z.object({ channel: z.number().int(), reason: z.string().optional() }),
      execute: async ({ channel, reason }) => {
        const name = channelName(channel);
        if (!name) return { ok: false, error: "없는 채널" };
        ctx.actions.push({ type: "tune", channel, reason });
        store.currentChannel = channel;
        const showing = nowOn(channel, ctx.now);
        log(ctx, "tuned", `${channel}번 ${name}${showing ? ` "${showing.title}"` : ""}`, { visibility: "family" });
        return { ok: true, channel, channelName: name, nowShowing: showing?.title };
      },
    }),
  };
}
