import { tool } from "ai";
import { z } from "zod";
import { channelName, nowOn, searchEpg } from "@/lib/epg";
import type { MemoryStore } from "@/lib/memory";
import { addSchedule, kstClock } from "@/lib/scheduler";
import { logEvent, store } from "@/lib/store";
import type { TvAction } from "@/lib/types";
import { orderErrand } from "./services/errand";
import { newsToday, weatherToday } from "./services/info";
import { requestRide } from "./services/ride";

// One request's context. Tools push TV actions here; the route returns them.
export type AgentContext = {
  now: Date;
  memory: MemoryStore;
  actions: TvAction[];
};

type HealthRecord = { at: string; medicineTaken?: boolean; feeling: string; severity: string; symptoms: string[] };
const g = globalThis as unknown as { __hyodoHealth?: HealthRecord[] };
export const healthLog: HealthRecord[] = g.__hyodoHealth ?? (g.__hyodoHealth = []);

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

function notify(ctx: AgentContext, message: string, level: "info" | "warn" | "urgent") {
  ctx.actions.push({ type: "notifyFamily", message, level });
  logEvent(level === "info" ? "family" : "alert", `가족 알림(${level}): ${message}`, ctx.now.toISOString());
}

const innerAction = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("tune"), channel: z.number().int().describe("틀 채널 번호") }),
    z.object({ type: z.literal("showCard"), title: z.string(), body: z.string().optional() }),
  ])
  .describe("시간이 되면 TV가 할 일. 프로그램이면 tune, 그 밖엔 showCard");

export function createTools(ctx: AgentContext) {
  return {
    memory_remember: tool({
      description: "할머니에 대한 사실을 장기 기억에 저장한다. 할머니가 가르쳐 주신 것, 새로 알게 된 습관·가족·건강·약속.",
      inputSchema: z.object({
        fact: z.string().describe("한 문장 사실, 3인칭 존댓말. 예: '딸 민정이는 화요일마다 온다'"),
        category: z.enum(["likes", "routine", "health", "family", "place", "taught", "other"]).optional(),
      }),
      execute: async ({ fact, category }) => {
        const saved = await ctx.memory.remember({ text: fact, category: category ?? "taught", source: "grandma" });
        logEvent("memory", `새로 배운 것: ${fact}`, ctx.now.toISOString());
        return { saved: true, id: saved.id, backend: ctx.memory.backend };
      },
    }),

    memory_recall: tool({
      description: "할머니에 대한 기억을 찾는다. 대답하기 전에 모르는 사실이 있으면 먼저 찾아본다.",
      inputSchema: z.object({ query: z.string().describe("찾을 말. 예: '병원', '딸', '좋아하는 가수'") }),
      execute: async ({ query }) => {
        const facts = await ctx.memory.recall(query, 6);
        logEvent("memory", `기억 찾기 "${query}": ${facts.length}개`, ctx.now.toISOString());
        return { facts: facts.map((f) => f.text), found: facts.length };
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
          then.type === "tune"
            ? { type: "tune", channel: then.channel, reason: label }
            : { type: "showCard", title: then.title, body: then.body };
        ctx.actions.push(addSchedule(iso, label, inner));
        logEvent("scheduled", `${kstClock(new Date(ms))} ${label}`, ctx.now.toISOString());
        return { ok: true, at: iso, spoken: kstClock(new Date(ms)) };
      },
    }),

    ride_request: tool({
      description:
        "택시를 부른다(가짜 서비스, 실제 호출·결제 없음). 목적지와 시간을 할머니께 확인한 뒤 부른다. 가족 알림과 TV 큰 카드는 자동.",
      inputSchema: z.object({
        to: z.string().describe("목적지. 예: '병원', '서울바른내과의원', '보현사'"),
        from: z.string().optional().describe("출발지, 없으면 집"),
        when: z.string().optional().describe("ISO 시각. 지금이면 비운다"),
      }),
      execute: async ({ to, from, when }) => {
        const ride = requestRide({ to, from, when, now: ctx.now });
        const pickupClock = kstClock(new Date(ride.pickupAt));
        ctx.actions.push({
          type: "showCard",
          title: ride.status === "reserved" ? `택시 예약됐어요, ${pickupClock}` : `택시가 ${ride.etaMin}분 뒤 도착해요`,
          body: `${ride.carModel}  ${ride.plate}\n${ride.driver}\n${ride.pickup.name} → ${ride.destination.name}`,
        });
        notify(
          ctx,
          `할머니 택시 ${ride.status === "reserved" ? "예약" : "호출"}: ${ride.pickup.name} → ${ride.destination.name}, ${pickupClock} 탑승, ${ride.carModel} ${ride.plate}, 예상 요금 ${won(ride.fareWon)}`,
          "info",
        );
        return {
          ok: true,
          status: ride.status,
          plate: ride.plate,
          car: ride.carModel,
          etaMin: ride.etaMin,
          pickupAt: pickupClock,
          destination: ride.destination.name,
          familyNotified: true,
        };
      },
    }),

    errand_order: tool({
      description: "장보기·생필품을 주문한다(가짜 서비스). 가족이 승인해야 배송된다. 가족 승인 알림은 자동.",
      inputSchema: z.object({
        items: z.array(z.object({ name: z.string(), qty: z.number().int().min(1).optional() })).min(1),
      }),
      execute: async ({ items }) => {
        const order = orderErrand({ items, now: ctx.now });
        const list = order.items.map((i) => `${i.name} ${i.qty}개`).join(", ");
        ctx.actions.push({ type: "showCard", title: "장보기 주문 넣었어요", body: `${list}\n합계 ${won(order.totalWon)}\n가족 확인 후 ${order.arrives} 도착` });
        notify(ctx, `할머니 장보기 승인 요청: ${list} (합계 ${won(order.totalWon)})`, "warn");
        return { ok: true, status: order.status, total: won(order.totalWon), arrives: order.arrives };
      },
    }),

    health_checkin: tool({
      description: "약 복용과 몸 상태를 기록한다. 아프신 데가 있으면 severity 를 정확히 준다. warn·urgent 면 가족에게 경고가 간다.",
      inputSchema: z.object({
        medicineTaken: z.boolean().optional().describe("약을 드셨는지, 모르면 비운다"),
        feeling: z.string().describe("할머니 말씀 요약. 예: '괜찮다고 하심', '무릎이 쑤신다고 하심'"),
        symptoms: z.array(z.string()).optional(),
        severity: z.enum(["ok", "mild", "warn", "urgent"]).describe("ok 괜찮음, mild 가벼운 불편, warn 아프심, urgent 위급"),
      }),
      execute: async ({ medicineTaken, feeling, symptoms = [], severity }) => {
        const rec = { at: ctx.now.toISOString(), medicineTaken, feeling, symptoms, severity };
        healthLog.push(rec);
        const med = medicineTaken === undefined ? "" : medicineTaken ? "약 드심. " : "약 아직 안 드심. ";
        logEvent("memory", `건강 기록: ${med}${feeling}`, ctx.now.toISOString());
        if (severity === "warn" || severity === "urgent") {
          notify(ctx, `할머니 건강 확인 필요: ${feeling}${symptoms.length ? ` (${symptoms.join(", ")})` : ""}`, severity);
        }
        return { recorded: true, familyAlerted: severity === "warn" || severity === "urgent" };
      },
    }),

    family_notify: tool({
      description: "가족(딸 민정)에게 메시지를 보낸다. 할머니 부탁, 가족 메시지에 대한 할머니 답 요약, 알릴 일.",
      inputSchema: z.object({
        message: z.string().describe("가족에게 보낼 한 줄. 할머니 답 요약이면 '할머니 답: ...'"),
        level: z.enum(["info", "warn", "urgent"]).optional(),
      }),
      execute: async ({ message, level = "info" }) => {
        notify(ctx, message, level);
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
      description: "오늘 날씨(할머니 동네).",
      inputSchema: z.object({}),
      execute: async () => weatherToday(),
    }),

    info_news: tool({
      description: "오늘 소식 몇 가지. 쉬운 말 요약이 같이 온다.",
      inputSchema: z.object({ topic: z.string().optional().describe("건강, 생활, 날씨, 연예 중 하나 또는 비움") }),
      execute: async ({ topic }) => {
        const all = newsToday();
        const items = topic ? all.filter((n) => n.topic === topic) : all;
        return { items: items.length ? items : all };
      },
    }),

    epg_search: tool({
      description: "오늘 편성표에서 프로그램을 찾는다(약 220채널). 사람 이름이나 제목으로.",
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
        logEvent("tuned", `${channel}번 ${name}${showing ? ` "${showing.title}"` : ""}`, ctx.now.toISOString());
        return { ok: true, channel, channelName: name, nowShowing: showing?.title };
      },
    }),
  };
}
