import { tool } from "ai";
import { z } from "zod";
import { channelName, nowOn, searchEpg } from "@/lib/epg";
import { isLesson, type MemoryFact, type MemoryStore } from "@/lib/memory";
import { addSchedule, kstClock, kstParts } from "@/lib/scheduler";
import { logEvent, store } from "@/lib/store";
import type { ActivityEvent, TvAction } from "@/lib/types";
import { CORRECTED_BY, TAUGHT_BY } from "@/lib/memory/seed";
import { orderErrand, type ErrandOrder } from "./services/errand";
import { newsToday, weatherToday } from "./services/info";
import { requestRide, type RideBooking } from "./services/ride";
import { T } from "./strings";
import { ringGuardian, spend, walletSnapshot } from "./wallet";

// One request's context. Tools push TV actions here; the route returns them.
export type AgentContext = {
  now: Date;
  memory: MemoryStore;
  actions: TvAction[];
  private: boolean; // this turn was kept from the family
  once?: Set<string>; // tools that may act only once per turn (Haiku sometimes calls twice in parallel)
};

const AGAIN = { ok: false, note: "Already done in this turn. Do not call it again; just answer her." };
/** True the first time a once-per-turn tool runs in this turn. */
function first(ctx: AgentContext, name: string) {
  ctx.once ??= new Set();
  if (ctx.once.has(name)) return false;
  ctx.once.add(name);
  return true;
}

export const DEMO = T.demo;

// Requests waiting for mom's approval in the family app.
export type PendingRequest =
  | { kind: "taxi"; at: string; ride: RideBooking; walletEntryId: string }
  | { kind: "order"; at: string; order: ErrandOrder; walletEntryId: string };

type HealthRecord = { at: string; medicineTaken?: boolean; feeling: string; severity: string; symptoms: string[] };
type LaterShow = { channel: number; channelName: string; title: string; startISO: string; startsAt: string; startsInMin: number };
type Shared = {
  health: HealthRecord[];
  requests: PendingRequest[];
  lastLater?: LaterShow[];
  // An order Sonny asked grandma to double-check ("2 or 2,000?").
  confirmOrder?: { items: { name: string; qty?: number }[]; question: string };
};
const g = globalThis as unknown as { __hyodoAgent?: Shared };
export const shared: Shared = g.__hyodoAgent ?? (g.__hyodoAgent = { health: [], requests: [] });


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

/** Step 2 of the safety net: Sonny phones the guardian about a spend over the limit. */
function callGuardian(ctx: AgentContext, pay: ReturnType<typeof spend>, what: string, cost: string) {
  const reason = pay.reason === "over_limit" ? "over_limit" : "low_balance";
  const script = T.callScript(what, cost, T.usd(store.wallet.perSpendLimit), reason, T.usd(pay.balance));
  const call = ringGuardian(pay.entry, script, reason, ctx.now.toISOString());
  ctx.actions.push({ type: "showCard", title: T.callCardTitle, body: `${T.callCardBody(what, cost)}\n${DEMO}` });
  log(ctx, "call", `${T.callLog(cost, what)} (call ${call.id})`, { visibility: "family" });
  return call;
}

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
        if (!first(ctx, "memory_remember")) return AGAIN;
        const category = kind === "lesson" ? "lesson" : (topic ?? "taught");
        const provenance = `${TAUGHT_BY}, ${ctx.now.toISOString()}`;
        const saved = await ctx.memory.remember({ text: fact, category, source: "grandma", provenance, at: ctx.now.toISOString() });
        if (saved.duplicate) {
          ctx.actions.push({ type: "showCard", title: T.alreadyTitle(card), body: T.alreadyBody });
          return { saved: false, alreadyKnown: true, id: saved.id, say: "Tell her warmly she taught you this before and you still remember it." };
        }
        if (kind === "lesson") {
          const n = (await lessonsThisMonth(ctx.memory, ctx.now)).length;
          // TV shows titles with the learned count as a big number card; body is the lesson.
          ctx.actions.push({ type: "showCard", title: T.learnedTitle(n), body: fact });
          log(ctx, "memory", T.logLesson(fact, n), { visibility: "family", familyText: T.famLesson(card, n) });
          return { saved: true, id: saved.id, kind, lessonsThisMonth: n, backend: ctx.memory.backend };
        }
        ctx.actions.push({ type: "showCard", title: T.personalTitle(card), body: T.personalBody });
        log(ctx, "memory", T.logPersonal(fact), { visibility: "private" });
        // Mom sees only how many personal things were taught today, never what.
        const today = kstParts(ctx.now);
        const taughtToday = (await ctx.memory.all()).filter((f) => {
          if (isLesson(f) || f.source === "seed") return false;
          const p = kstParts(new Date(f.at));
          return p.year === today.year && p.month === today.month && p.day === today.day;
        }).length;
        log(ctx, "memory", T.logPersonal(fact), { visibility: "summary", familyText: T.famTaughtCount(Math.max(1, taughtToday)) });
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
        const saved = await ctx.memory.correct(id, fact, `${CORRECTED_BY}, ${ctx.now.toISOString()}`);
        if (!saved) return { ok: false, error: "no memory with that id" };
        ctx.actions.push({ type: "showCard", title: T.correctedTitle(card), body: before ? T.correctedBefore(before.text) : undefined });
        const shared = before && isLesson(before);
        log(ctx, "memory", T.logCorrect(before?.text ?? id, fact), shared ? { visibility: "family" } : { visibility: "private" });
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
        ctx.actions.push({ type: "showCard", title: T.learnedTitle(list.length), body: list[list.length - 1]?.text ?? T.learnedBodyFooter });
        return { count: list.length };
      },
    }),

    keep_private: tool({
      description: "할머니가 '딸한테 말하지 마', '비밀이야' 하시면 부른다. 이번 대화를 가족에게 알리지 않는다.",
      inputSchema: z.object({ what: z.string().describe("무엇을 비밀로 하는지 짧게") }),
      execute: async ({ what }) => {
        ctx.private = true;
        log(ctx, "memory", T.logSecret(what), { visibility: "private" });
        ctx.actions.push({ type: "showCard", title: T.secretTitle, body: T.secretBody });
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
        let ms = Date.parse(at);
        let channel = then.type === "tune" ? then.channel : 0;
        if (then.type === "tune") {
          // Trust the guide over the model: match the show by its label and use its
          // real channel and start (the model once guessed "KBS1" meant channel 1).
          const words = label.replace(/시작|틀기|알림|방송/g, " ").trim();
          const hit =
            searchEpg(words, ctx.now).find((h) => h.status === "later") ??
            searchEpg(words.split(/\s+/)[0] ?? "", ctx.now).find((h) => h.status === "later" && words.includes(h.title.slice(0, 4)));
          if (hit) {
            channel = hit.channel;
            ms = Date.parse(hit.start);
          } else if (!channelName(channel)) {
            return { ok: false, error: "편성표에서 그 프로그램을 못 찾았어요. tv_play 로 먼저 찾아 주세요." };
          }
        }
        if (!Number.isFinite(ms)) return { ok: false, error: "시간 형식이 틀렸어요. ISO로 다시." };
        const iso = new Date(ms).toISOString();
        const inner: TvAction =
          then.type === "tune" ? { type: "tune", channel, reason: label } : { type: "showCard", title: then.title, body: then.body };
        ctx.actions.push(addSchedule(iso, label, inner));
        log(ctx, "scheduled", `${kstClock(new Date(ms))} ${label}`, { visibility: "family" });
        return { ok: true, at: iso, spoken: kstClock(new Date(ms)), channel: then.type === "tune" ? channel : undefined };
      },
    }),

    ride_request: tool({
      description:
        "택시를 요청한다(가짜 서비스, 실제 호출·결제 없음). 목적지와 시간을 할머니께 확인한 뒤 부른다. 따님 승인 요청과 TV 카드는 자동. 승인되면 차가 배정된다.",
      inputSchema: z.object({
        to: z.string().describe("목적지. 예: '병원', '햇살내과의원', '햇살사'"),
        from: z.string().optional().describe("출발지, 없으면 집"),
        when: z.string().optional().describe("ISO 시각. 지금이면 비운다"),
      }),
      execute: async ({ to, from, when }) => {
        if (!first(ctx, "ride_request")) return AGAIN;
        const ride = requestRide({ to, from, when, now: ctx.now });
        const cost = T.usd(ride.fareCents);
        const pay = spend(ride.fareCents, `Taxi to ${ride.destination.name} (${DEMO})`, ctx.now.toISOString());
        const pickup = kstClock(new Date(ride.pickupAt));
        if (pay.status === "done") {
          ctx.actions.push({
            type: "showCard",
            title: T.rideCardTitle,
            body: `${T.rideBody(ride.pickup.name, ride.destination.name, ride.carModel, ride.plate, ride.etaMin)}\n${DEMO}`,
          });
          ctx.actions.push({ type: "notifyFamily", message: T.notifyRide(ride.pickup.name, ride.destination.name), level: "info" });
          // Paid rides are a plain family line (kind family), not an approval card.
          log(ctx, "family", T.logRidePaid(cost, ride.destination.name, ride.carModel, ride.plate, pickup) + ` (${DEMO})`, { visibility: "family" });
          return { ok: true, status: "done", paid: cost, balanceLeft: T.usd(pay.balance), car: ride.carModel, plate: ride.plate, etaMin: ride.etaMin, destination: ride.destination.name };
        }
        shared.requests.push({ kind: "taxi", at: ctx.now.toISOString(), ride, walletEntryId: pay.entry.id });
        callGuardian(ctx, pay, T.whatRide(ride.destination.name), cost);
        ctx.actions.push({ type: "notifyFamily", message: T.notifyRide(ride.pickup.name, ride.destination.name), level: "warn" });
        return { ok: true, status: "calling_daughter", cost, reason: pay.reason === "over_limit" ? `over the ${T.usd(store.wallet.perSpendLimit)} per-purchase limit` : `only ${T.usd(pay.balance)} left in the allowance`, destination: ride.destination.name, say: "Tell her: I'm calling Sarah to check." };
      },
    }),

    errand_order: tool({
      description: "Order groceries or household items (demo service). Paid from grandma's allowance; over the limit it waits for her daughter's OK automatically.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              name: z.string().describe("item in plain words, e.g. 'milk', 'eggs', 'rice'"),
              qty: z.number().int().min(1).optional().describe("number of packs as sold: a dozen eggs = 1, two gallons of milk = 2. Use exactly the number she said, even if it is huge."),
            }),
          )
          .min(1),
        confirmed: z.boolean().optional().describe("true only after she confirmed an unusual amount you asked about"),
      }),
      execute: async ({ items, confirmed }) => {
        if (!first(ctx, "errand_order")) return AGAIN;
        const order = orderErrand({ items, now: ctx.now });
        const list = order.items.map((i) => T.qty(i.name, i.qty)).join(", ");
        const cost = T.usd(order.totalCents);
        // Step 1 of the safety net: an unusual amount is checked with grandma first.
        const odd = order.items.find((i) => i.qty > 10);
        if (!confirmed && (odd || order.totalCents > 3 * store.wallet.perSpendLimit)) {
          const item = odd ?? order.items.reduce((a, b) => (b.priceCents > a.priceCents ? b : a));
          const small = String(item.qty).replace(/0+$/, "") || "1";
          const question = T.confirmAsk(small === String(item.qty) ? "1" : small, item.qty.toLocaleString("en-US"), item.name);
          shared.confirmOrder = { items, question };
          log(ctx, "task", `Checking an unusual order with Grandma: ${list}, ${cost}`, { visibility: "family" });
          return { ok: false, status: "needs_confirmation", total: cost, ask: question, say: `Ask her exactly: "${question}" Do not order yet.` };
        }
        shared.confirmOrder = undefined;
        const pay = spend(order.totalCents, `Groceries: ${list} (${DEMO})`, ctx.now.toISOString());
        if (pay.status === "done") {
          order.status = "paid";
          ctx.actions.push({ type: "showCard", title: T.orderCardTitle, body: `${T.orderBody(list, cost, order.arrives)}\n${DEMO}` });
          ctx.actions.push({ type: "notifyFamily", message: T.notifyOrder(list), level: "info" });
          log(ctx, "family", T.logOrderPaid(cost, list, order.arrives) + ` (${DEMO})`, { visibility: "family" });
          return { ok: true, status: "done", paid: cost, balanceLeft: T.usd(pay.balance), arrives: order.arrives };
        }
        shared.requests.push({ kind: "order", at: ctx.now.toISOString(), order, walletEntryId: pay.entry.id });
        callGuardian(ctx, pay, T.whatOrder(list), cost);
        ctx.actions.push({ type: "notifyFamily", message: T.notifyOrder(list), level: "warn" });
        return { ok: true, status: "calling_daughter", cost, reason: pay.reason === "over_limit" ? `over the ${T.usd(store.wallet.perSpendLimit)} per-purchase limit` : `only ${T.usd(pay.balance)} left in the allowance`, say: "Tell her: I'm calling Sarah to check." };
      },
    }),

    wallet_balance: tool({
      description: "How much allowance grandma has left (the family tops it up). Shows a card.",
      inputSchema: z.object({}),
      execute: async () => {
        const w = walletSnapshot();
        ctx.actions.push({ type: "showCard", title: T.walletTitle(T.usd(w.balanceCents)), body: `${T.walletBody(T.usd(w.limitCents))}\n${DEMO}` });
        return { balance: T.usd(w.balanceCents), perSpendLimit: T.usd(w.limitCents), waitingForOk: w.pending, recent: w.recent };
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
        const med = medicineTaken === undefined ? "" : medicineTaken ? T.medTaken(clock()) : T.medNotTaken;
        // "딸한테 말하지 마" keeps it private, unless it is an emergency.
        const hush = ctx.private && severity !== "urgent";
        log(ctx, "memory", T.health(med, feeling), { visibility: hush ? "private" : "family" });
        if (hush) return { recorded: true, familyAlerted: false, keptPrivate: true };
        if (severity === "warn" || severity === "urgent") {
          alertFamily(ctx, T.healthAlert(feeling, symptoms.join(", ")), severity);
        }
        return { recorded: true, familyAlerted: severity === "warn" || severity === "urgent" };
      },
    }),

    family_notify: tool({
      description: "가족(딸 수진)에게 메시지를 보낸다. 할머니 부탁이나 알릴 일. 가족 메시지에 대한 할머니 답이면 reply=true.",
      inputSchema: z.object({
        message: z.string().describe("가족에게 보낼 한 줄 요약"),
        reply: z.boolean().optional().describe("가족 메시지에 대한 할머니 답 요약이면 true"),
        level: z.enum(["info", "warn", "urgent"]).optional(),
      }),
      execute: async ({ message, reply, level = "info" }) => {
        ctx.actions.push({ type: "notifyFamily", message, level });
        if (reply) log(ctx, "family", T.reply(message), { visibility: "family" });
        else if (level === "info") log(ctx, "family", T.says(message), { visibility: "family" });
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
        if (card) ctx.actions.push({ type: "showCard", title: T.weatherTitle(w.sky), body: `${T.weatherBody(w)}\n${DEMO}` });
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
        ctx.actions.push({ type: "showCard", title: T.newsTitle, body: `${pick.map((n) => `· ${n.plain}`).join("\n")}\n${DEMO}` });
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
        shared.lastLater = later;
        return {
          tuned: live ? { channel: live.channel, channelName: live.channelName, title: live.title } : null,
          later,
          note: T.tvData,
        };
      },
    }),

    epg_search: tool({
      description: "오늘 편성표만 찾아본다(틀지 않음). 틀어 달라는 요청엔 tv_play 를 쓴다.",
      inputSchema: z.object({ query: z.string().describe("예: '임영웅', '가요무대', '뉴스'") }),
      execute: async ({ query }) => {
        const hits = searchEpg(query, ctx.now);
        shared.lastLater = hits
          .filter((h) => h.status === "later")
          .slice(0, 2)
          .map((h) => ({ channel: h.channel, channelName: h.channelName, title: h.title, startISO: h.start, startsAt: kstClock(new Date(h.start)), startsInMin: h.startsInMin }));
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
