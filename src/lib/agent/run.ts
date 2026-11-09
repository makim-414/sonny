import net from "node:net";
import { anthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { generateText, isStepCount } from "ai";
import { APP_LANG } from "@/lib/brand";
import { channelName } from "@/lib/epg";
import { getMemory, isLesson } from "@/lib/memory";
import { kstClock, kstLabel, kstParts, todayAgenda } from "@/lib/scheduler";
import { logEvent, store } from "@/lib/store";
import type { AgentReply, AgentRequest, TvAction } from "@/lib/types";
import { AGENT_NAME, PERSONA, PROACTIVE_TASKS } from "./persona";
import { getSession, pushTurn } from "./session";
import { T } from "./strings";
import { createTools, DEMO, lessonsThisMonth, shared, type AgentContext } from "./tools";
import { settle } from "./wallet";

// On the venue network IPv6 to api.anthropic.com hangs and Node's default 250 ms
// happy-eyeballs window fails the whole connect (ETIMEDOUT). Give IPv4 time.
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

const EN = APP_LANG === "en";

// Routing: Haiku (no thinking) for talk, Sonnet for turns that act in the world.
const FAST = process.env.HYODO_FAST_MODEL ?? "claude-haiku-5-5";
const SMART = process.env.HYODO_SMART_MODEL ?? "claude-sonnet-5-5";
// Clear teaching ("내 손주 이름은 민수야", "my grandson's name is Max"): Haiku is made to
// call memory_remember on its first step, since it sometimes only says it will.
const TEACH_WORDS =
  /기억해|이름은|이름이|비법|가르쳐|알려 줄게|해야 (해|돼|한다)|하면 (돼|좋아)|절여|넣어야|remember (this|that)|\bname is\b|\bnamed\b|recipe|the trick is|the secret is|you (have|need) to|always (put|use|add)|never (put|use)/i;
const ORDER_NOW = /\b(order|buy|get me|pick up)\b.{2,}|시켜|주문해|사다 줘|사 줘/i;
const PLAY_EN = /\b(turn on|put on|play|watch|switch to)\b/i;
const MED_WORDS = /약.{0,6}(먹었|먹음|먹을게|드셨|챙겨 먹|안 먹)|\b(took|taken|had|take)\b.{0,12}\b(pills?|medicine|meds)\b|\bI (took|have taken|had) (it|them|that)\b/i;
const LESSON_COUNT_WORDS = /배운 (거|게|것).{0,8}(몇|얼마)|how many .*(learn|taught)/i;
// Haiku sometimes claims an action without calling the tool. Rerun those on Sonnet.
const CLAIMS = [
  { words: /주문했|시켰|주문 넣|도착해요|\bI('ve| have)? ordered\b|\bon (the|its|their) way\b|\bwill arrive\b|\barrives?\b|\bbooked\b/i, tools: ["errand_order", "ride_request"] },
  { words: /택시.*(불렀|요청했)|\bI('ve| have)? (called|booked|requested) (a|the|your) (taxi|cab|ride)/i, tools: ["ride_request"] },
  { words: /기억할게|기억해 둘게|기억해 두었|기억했|\bI('ll| will) remember\b|\bI('ve| have) (saved|noted) that\b/i, tools: ["memory_remember", "memory_correct"] },
  { words: /틀어 드렸|틀었어|찾아볼게|찾아 드릴게|\bI('ve| have)? (turned|put) (it |that )?on\b|\blet me find\b/i, tools: ["tv_play", "tv_tune", "epg_search"] },
  { words: /틀어 드릴게|알려 드릴게|예약했|예약해 둘게|\bI('ll| will) remind\b|\bI('ve| have)? set (a|the) reminder\b/i, tools: ["schedule_at", "tv_play"] },
  { words: /\b(I'll|I will|I've|I have) (record|recorded|written|write|noted|note)\b.{0,30}\b(pill|medicine)/i, tools: ["health_checkin"] },
  { words: /\basked your daughter\b|\bsent (it )?to your daughter\b|\bcalling (sarah|your daughter)\b/i, tools: ["ride_request", "errand_order"] },
  { words: /알렸어|전해 드렸|전했어|전해 드릴게|전할게|\bI('ve| have)? (told|let) your daughter\b|\bI('ll| will) (tell|let) your daughter\b/i, tools: ["family_notify", "health_checkin", "ride_request", "errand_order"] },
];
// Turns that spend money, touch safety or privacy, or rewrite memory go to Sonnet.
// Talk, teaching, TV and reminders stay on Haiku (guarded by CLAIMS above).
// Turns that touch safety or privacy, or rewrite memory, go to Sonnet. Everything else
// (talk, teaching, TV, reminders, taxi, groceries) stays on Haiku, guarded by CLAIMS.
const SMART_WORDS =
  /아파|아프|어지|숨이|가슴|넘어|쓰러|말하지 마|비밀|아니야|아니,|말고|고쳐|틀렸|hurt|pain|dizzy|chest|breathe|\bfell\b|don't tell|secret|\bno,? not\b|not .* but|actually it'?s|that'?s wrong/i;
const SECRET_WORDS = /말하지 마|비밀|don't tell|secret|between us/i;

function pickModel(req: AgentRequest): string {
  if (process.env.HYODO_MODEL) return process.env.HYODO_MODEL;
  if (req.source === "voice" && SMART_WORDS.test(req.text)) return SMART;
  return FAST;
}

function providerOptions(model: string) {
  const effort = (process.env.HYODO_EFFORT ?? "low") as "low" | "medium" | "high";
  // Haiku 5.5 can turn thinking off; Sonnet 5.5's lowest setting is between_tools.
  return (model.includes("haiku")
    ? { effort, thinking: { type: "disabled" } }
    : { effort, thinking: { type: "between_tools" } }) satisfies AnthropicLanguageModelOptions;
}

// Labels for the per-turn context, in the conversation language.
const L = EN
  ? {
      fallbackSay: "One moment, Grandma. Could you say that again?",
      now: "Now",
      tz: "local time +09:00",
      tv: "TV now",
      tvOff: "off or unknown",
      chan: (n: number, name: string) => (n ? `channel ${n} ${name}` : `${name} (live US listing, no channel number: never say a channel, just remind her)`),
      meds: "Today's pill",
      medsTaken: "already taken (recorded). Do not ask again.",
      medsNot: "not recorded yet",
      agenda: "Today's schedule",
      none: "none",
      facts: "What you remember about her (GBrain id, fact)",
      recent: "Recently learned",
      lessons: (n: number) => `Lessons learned from her this month: ${n}`,
      later: "Later shows you just mentioned (use this channel and time when you set a reminder)",
      task: "This turn",
      format: "Your final answer must use the <say>…</say><heard>…</heard><family>…</family> format.",
      proactiveTurn: (k: string) => `[system: you speak first, ${k}]`,
      proactiveTask: (k: string) => `You speak first: ${k}`,
      familyTask: (from: string) =>
        `${from} just sent a message and it is on screen. Pass it on to her warmly, word for word, and add one short line inviting her reply. Do not call tools. In <heard>, put the message.`,
      familyTurn: (from: string, m: string) => `[family message] ${from}: ${m}`,
      familyDefault: (from: string, m: string) => `Grandma, ${from} sent you a message. ${m}`,
      replyTask: (from: string, m: string) =>
        ` You just passed on ${from}'s message ("${m}"), so what she says now is most likely her reply. If so, send a one-line summary with family_notify(reply=true) and tell her briefly you passed it on. If she says to keep it secret, do not send it.`,
      doneNote: (d: string) => `[done: ${d}]`,
      approvalTurn: (t: string) => `[family approved] ${t}`,
      brainError: "brain error",
      mom: "your daughter Sarah",
    }
  : {
      fallbackSay: "잠깐만요 할머니, 제가 다시 한번 여쭤볼게요.",
      now: "지금 시각",
      tz: "한국 시간 +09:00",
      tv: "지금 TV",
      tvOff: "꺼져 있거나 모름",
      chan: (n: number, name: string) => `${n}번 ${name}`,
      meds: "오늘 약",
      medsTaken: "이미 드셨다고 기록됨. 다시 묻지 않는다.",
      medsNot: "아직 기록 없음",
      agenda: "오늘 일정",
      none: "없음",
      facts: "할머니에 대해 기억하는 것 (GBrain id, 내용)",
      recent: "최근 새로 배운 것",
      lessons: (n: number) => `이번 달 할머니께 배운 lesson: ${n}개`,
      later: "방금 알려 드린 나중 프로그램 (예약할 때 이 채널과 시각을 그대로 쓴다)",
      task: "이번 차례 할 일",
      format: "마지막 답은 반드시 <say>…</say><en>…</en><heard>…</heard><family>…</family> 형식으로 쓴다.",
      proactiveTurn: (k: string) => `[시스템: 먼저 말 걸기 ${k}]`,
      proactiveTask: (k: string) => `TV가 먼저 말을 건다: ${k}`,
      familyTask: (from: string) =>
        `가족(${from})이 보낸 메시지가 방금 TV에 떴다. 할머니께 다정하게 그대로 전해 드리고, 답하실 말씀이 있으면 해 달라고 한마디 덧붙인다. 도구는 부르지 않는다. <heard> 에는 가족 메시지의 영어 번역을 쓴다.`,
      familyTurn: (from: string, m: string) => `[가족 메시지 도착] ${from}: ${m}`,
      familyDefault: (from: string, m: string) => `할머니, ${from.replace(/^딸 /, "")}이가 메시지를 보냈어요. ${m}`,
      replyTask: (from: string, m: string) =>
        ` 방금 ${from}의 메시지("${m}")를 전해 드렸고, 지금 말씀은 그에 대한 할머니 답일 가능성이 높다. 답이 맞으면 family_notify(reply=true) 로 할머니 답을 한 줄 요약해 보내고, 전해 드리겠다고 짧게 말씀드린다. 비밀로 하라고 하시면 보내지 않는다.`,
      doneNote: (d: string) => `[한 일: ${d}]`,
      approvalTurn: (t: string) => `[가족 승인] ${t}`,
      brainError: "두뇌 오류",
      mom: "딸 수진",
    };

const FALLBACK_EN = "One moment, let me ask you again.";
const isEnglish = (s: string) => (s.match(/[a-z]/gi)?.length ?? 0) > (s.match(/[가-힣]/g)?.length ?? 0);

function parseFamily(text: string) {
  // TV may send "엄마: 메시지" / "Mom: message" or just the message. Mom is grandma's daughter.
  const m = text.match(/^\s*([^:：]{1,12})\s*[:：]\s*([\s\S]+)$/);
  const raw = m ? m[1].trim() : "";
  const from = !raw || /^(엄마|mom|딸|daughter|sarah)$/i.test(raw) ? L.mom : raw;
  return { from, message: (m ? m[2] : text).trim() };
}

const tag = (s: string, t: string) => s.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`))?.[1]?.trim();
const clean = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\[[^\]]*\]/g, "").replace(/\s*\n+\s*/g, " ").trim();
const sayTag = (raw: string) => tag(raw, "say") ?? tag(raw, "ko");

// Speech that looks like tool arguments or a log line ("... said yes ok true").
const LEAK = /\b(true|false|null|undefined)\b|severity|medicineTaken|symptoms|feeling:|\bok true\b|Health check:|건강 기록:|[{}]|\w+_\w+\(/i;
function safeLine(ran: string[]): string {
  if (EN) {
    if (ran.includes("health_checkin")) return "Great, I've noted it. I'll let Sarah know.";
    if (ran.includes("memory_remember")) return "Thank you, I'll remember that.";
    if (ran.includes("errand_order")) return "Okay, I've taken care of the groceries.";
    if (ran.includes("schedule_at")) return "Okay, I'll remind you.";
    return "Okay, June.";
  }
  if (ran.includes("health_checkin")) return "잘하셨어요, 기록해 둘게요.";
  if (ran.includes("memory_remember")) return "고마워요, 꼭 기억할게요.";
  return "네, 할머니.";
}

// Older listeners: at most two sentences on stage (the prompt asks for about 15 words each).
function twoSentences(s: string): string {
  const parts = s.match(/[^.!?]+[.!?]+["')]?\s*/g);
  return parts && parts.length > 2 ? parts.slice(0, 2).join("").trim() : s;
}

type Reply = AgentReply & { meta: Record<string, unknown> };

/** Mom answered Sonny's call ("Mom approved call <id>"). The family app already settled the wallet. */
function handleCallAnswer(text: string, now: Date): Reply | null {
  const m = text.match(/\b(approved|declined|missed) call ([0-9a-f-]{8,})/i);
  if (!m) return null;
  const verdict = m[1].toLowerCase();
  const call = store.calls.find((c) => c.id === m[2]);
  const idx = call ? shared.requests.findIndex((r) => r.walletEntryId === call.walletEntryId) : -1;
  const req = idx >= 0 ? shared.requests[idx] : undefined;
  const at = now.toISOString();
  const actions: TvAction[] = [];
  let say: string;
  if (verdict === "missed") {
    say = T.missedSay;
  } else if (!req) {
    say = verdict === "approved" ? T.orderedSay : T.declinedSay("");
  } else {
    shared.requests.splice(idx, 1);
    if (verdict === "declined") {
      say = T.declinedSay("");
      actions.push({ type: "showCard", title: T.declinedCard, body: req.kind === "taxi" ? T.whatRide(req.ride.destination.name) : req.order.items.map((i) => T.qty(i.name, i.qty)).join(", ") });
    } else if (req.kind === "taxi") {
      const r = req.ride;
      say = T.rideOkSay(r.carModel, 5);
      actions.push({ type: "showCard", title: T.rideCardTitle, body: `${T.rideBody(r.pickup.name, r.destination.name, r.carModel, r.plate, 5)}\n${T.approvedTag}\n${DEMO}` });
    } else {
      const o = req.order;
      const list = o.items.map((i) => T.qty(i.name, i.qty)).join(", ");
      say = T.orderedSay;
      actions.push({ type: "showCard", title: T.orderCardTitle, body: `${T.orderBody(list, T.usd(o.totalCents), o.arrives)}\n${T.approvedTag}\n${DEMO}` });
    }
  }
  logEvent("said", say, at, { visibility: "family" });
  pushTurn(L.approvalTurn(text), `${say} ${L.doneNote(`call ${verdict}`)}`);
  return { say, sayEn: EN ? say : undefined, actions, meta: { ms: 0, model: "none (call answer)", tools: [] } };
}

/** Mom approved a taxi or order in the family app. Deterministic, no model call. */
function handleApproval(text: string, now: Date): Reply | null {
  if (!/승인|approved|\bOK'?d\b|said yes/i.test(text)) return null;
  const wantTaxi = /택시|카카오|차량|배차|taxi|\bcab\b|\bride\b/i.test(text);
  const wantOrder = /주문|장보기|배달|구매|마트|order|grocer/i.test(text);
  const idx = [...shared.requests.keys()]
    .reverse()
    .find((i) => (wantTaxi ? shared.requests[i].kind === "taxi" : wantOrder ? shared.requests[i].kind === "order" : true));
  if (idx === undefined) return null;
  const [req] = shared.requests.splice(idx, 1);
  settle(req.walletEntryId); // take it from the allowance now
  const at = now.toISOString();
  const actions: TvAction[] = [];
  let say: string;
  if (req.kind === "taxi") {
    const r = req.ride;
    const eta = 5;
    const plate = EN ? r.plate : r.plate.slice(-4);
    actions.push({
      type: "showCard",
      title: T.rideCardTitle,
      body: `${T.rideBody(r.pickup.name, r.destination.name, r.carModel, r.plate, eta)}\n${T.approvedTag}\n${DEMO}`,
    });
    say = T.approvedRideSay(r.carModel, eta, plate);
    logEvent(
      "family",
      `${T.logRidePaid(T.usd(r.fareCents), r.destination.name, r.carModel, r.plate, kstClock(new Date(now.getTime() + eta * 60_000)))} (${DEMO})`,
      at,
      { visibility: "family" },
    );
  } else {
    const o = req.order;
    const list = o.items.map((i) => T.qty(i.name, i.qty)).join(", ");
    actions.push({ type: "showCard", title: T.orderCardTitle, body: `${T.orderBody(list, T.usd(o.totalCents), o.arrives)}\n${T.approvedTag}\n${DEMO}` });
    say = T.approvedOrderSay(o.arrives);
    logEvent("family", `${T.logOrderPaid(T.usd(o.totalCents), list, o.arrives)} (${DEMO})`, at, { visibility: "family" });
  }
  logEvent("said", say, at, { visibility: "family" });
  pushTurn(L.approvalTurn(text), `${say} ${L.doneNote(req.kind === "taxi" ? "taxi dispatched" : "order placed")}`);
  return { say, sayEn: EN ? say : undefined, actions, meta: { ms: 0, model: "none (approval)", tools: [] } };
}

async function translate(say: string): Promise<string | undefined> {
  try {
    const t = await generateText({
      model: anthropic(FAST),
      instructions: "Translate the Korean line into natural, short English. Output only the translation.",
      prompt: say,
      maxOutputTokens: 200,
      providerOptions: { anthropic: providerOptions(FAST) },
    });
    return t.text.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function runAgent(req: AgentRequest, opts: { model?: string } = {}): Promise<Reply> {
  const started = Date.now();
  const now = req.now && Number.isFinite(Date.parse(req.now)) ? new Date(req.now) : new Date();
  const nowIso = now.toISOString();
  const memory = await getMemory();
  const session = getSession(Date.now());
  const ctx: AgentContext = { now, memory, actions: [], private: false };

  if (req.source === "family") {
    const approved = handleCallAnswer(req.text, now) ?? handleApproval(req.text, now);
    if (approved) return { ...approved, meta: { ...approved.meta, ms: Date.now() - started, memory: memory.backend } };
  }

  // Build the user turn for this request.
  let userTurn: string;
  let task = "";
  let defaultSay = L.fallbackSay;
  let heardEn: string | undefined;
  let replyingToFamily = false;
  const englishInKo = !EN && req.source !== "proactive" && isEnglish(req.text);
  if (req.source === "proactive") {
    const key = req.text.trim();
    task = PROACTIVE_TASKS[key] ?? L.proactiveTask(key);
    userTurn = L.proactiveTurn(key);
    // "먼저 말 걸기:" is the prefix the family app skips when it looks for grandma's last words.
    logEvent("heard", `먼저 말 걸기: ${key}`, nowIso, { visibility: "private" });
  } else if (req.source === "family") {
    const fam = parseFamily(req.text);
    session.awaitingFamilyReply = fam;
    ctx.actions.push({ type: "showCard", title: T.messageTitle(fam.from), body: fam.message });
    task = L.familyTask(fam.from);
    userTurn = L.familyTurn(fam.from, fam.message);
    defaultSay = L.familyDefault(fam.from, fam.message);
    if (EN) heardEn = fam.message;
  } else {
    replyingToFamily = !!session.awaitingFamilyReply;
    userTurn = req.text;
    logEvent("heard", req.text, nowIso, { visibility: "private" });
    if (EN) heardEn = req.text;
    if (englishInKo) {
      heardEn = req.text;
      task = "이번 말은 영어다(TV를 체험하는 손님일 수 있다). 뜻대로 처리하고, <say> 는 아주 짧은 한국어, <en> 은 영어로 쓴다. <heard> 는 들은 영어 그대로.";
    }
    if (session.awaitingFamilyReply) {
      const fam = session.awaitingFamilyReply;
      task += L.replyTask(fam.from, fam.message);
      session.awaitingFamilyReply = null;
    }
  }

  // Pull memory up front so most turns need no recall step.
  const all = await memory.all();
  const personal = all.filter((f) => !isLesson(f));
  const relevant = req.source === "proactive" ? [] : await memory.recall(req.text, 4);
  const recentTaught = personal.filter((f) => f.source !== "seed").slice(-5);
  const facts = [...new Map([...personal.filter((f) => f.source === "seed"), ...recentTaught, ...relevant].map((f) => [f.id, f])).values()];
  const lessons = await lessonsThisMonth(memory, now);

  // Speaking first: build the greeting around the newest thing she taught (lesson or
  // personal), so yesterday's teaching shows up this morning.
  const taughtNewest = all.filter((f) => f.source !== "seed").slice(-1)[0];
  let focusLine = "";
  if (req.source === "proactive" && /morning|checkin|idle|evening/.test(req.text) && taughtNewest) {
    focusLine = EN
      ? ` Open with what she taught you most recently: "${taughtNewest.text}". Turn it into one warm, useful offer for today (for example, if family is coming for dinner: "Sarah's staying tonight, want me to get groceries for two?"). That offer is your one question. Do not just repeat the fact: make the offer. Mention the 8 AM pill only as a short reminder, not a question.`
      : ` 할머니가 최근에 가르쳐 주신 것으로 시작한다: "${taughtNewest.text}". 그걸로 오늘 쓸모 있는 제안 하나를 한다(예: 가족이 저녁에 오면 "오늘 수진이 오니까 장 좀 봐 드릴까요?"). 질문은 그 제안 하나. 약은 짧게 알려 드리기만 한다.`;
  }
  // She said yes to the offer made while speaking first: carry it out.
  const offer = shared.offer;
  shared.offer = undefined;
  const yesToOffer = !!offer && req.source === "voice" && /\b(yes|yeah|sure|please|ok|okay|go ahead)\b|그래|응|네|좋아/i.test(req.text);
  if (yesToOffer && offer) {
    task += EN
      ? ` She just said yes to your offer "${offer.said}" (based on: "${offer.basis}"). Do it now with errand_order: a small, sensible order for it (for dinner for two, e.g. 1 chicken, 1 bag of salad, 1 loaf of bread). Then say in one short sentence what you ordered.`
      : ` 할머니가 방금 제안("${offer.said}")에 좋다고 하셨다. errand_order 로 바로 적당히 주문한다(예: 두 사람 저녁이면 닭 1, 채소 1, 두부 1). 무엇을 주문했는지 짧게 말씀드린다.`;
  }

  const today = kstParts(now);
  const tookMeds = shared.health.some((h) => {
    const p = kstParts(new Date(h.at));
    return h.medicineTaken && p.year === today.year && p.month === today.month && p.day === today.day;
  });

  const ch = store.currentChannel;
  const instructions = [
    PERSONA,
    `${L.now}: ${kstLabel(now)} (ISO ${nowIso}, ${L.tz})`,
    `${L.tv}: ${ch ? L.chan(ch, channelName(ch) ?? "") : L.tvOff}`,
    `${L.meds}: ${tookMeds ? L.medsTaken : L.medsNot}`,
    `${L.agenda}:\n${todayAgenda(now).map((a) => `- ${a}`).join("\n") || `- ${L.none}`}`,
    `${L.facts}:\n${facts.map((f) => `- (${f.id}) ${f.text}`).join("\n")}`,
    recentTaught.length ? `${L.recent}:\n${recentTaught.map((f) => `- (${f.id}) ${f.text}`).join("\n")}` : "",
    L.lessons(lessons.length),
    shared.lastLater?.length
      ? `${L.later}:\n${shared.lastLater.map((l) => `- ${L.chan(l.channel, l.channelName)} "${l.title}" ${l.startsAt} (${l.startISO})`).join("\n")}`
      : "",
    task ? `${L.task}: ${task.trim()}` : "",
    shared.confirmOrder && req.source === "voice"
      ? `You just asked her: "${shared.confirmOrder.question}" about this order: ${JSON.stringify(shared.confirmOrder.items)}. Her words now are the answer. Call errand_order with the amounts she means now and confirmed=true. If she says no or cancel, do not order.`
      : "",
    focusLine ? `MOST IMPORTANT for this greeting:${focusLine}` : "",
    L.format,
  ]
    .filter(Boolean)
    .join("\n\n");

  // The greeting built on what she taught must make an offer; Haiku often only
  // restated the fact (1 of 3), so this speak-first turn goes to Sonnet.
  const model = opts.model ?? (focusLine && !process.env.HYODO_MODEL ? SMART : pickModel(req));
  // Force the one tool this turn clearly needs (Haiku only: Sonnet always thinks,
  // and Anthropic rejects a forced tool choice with thinking on).
  const force: "family_notify" | "memory_remember" | "health_checkin" | "lessons_show" | "tv_play" | "errand_order" | null =
    req.source !== "voice"
      ? null
      : yesToOffer
        ? "errand_order"
      : shared.confirmOrder && !/\b(no|cancel|never ?mind)\b|취소|아니/i.test(req.text)
        ? "errand_order"
        : replyingToFamily && !SECRET_WORDS.test(req.text)
        ? "family_notify"
        : ORDER_NOW.test(req.text) && !/\b(taxi|cab|ride)\b|택시/i.test(req.text)
          ? "errand_order"
          : PLAY_EN.test(req.text)
          ? "tv_play"
          : MED_WORDS.test(req.text)
            ? "health_checkin"
            : LESSON_COUNT_WORDS.test(req.text)
              ? "lessons_show"
              : TEACH_WORDS.test(req.text)
                ? "memory_remember"
                : null;
  let say = defaultSay;
  let sayEn: string | undefined;
  let familyText: string | undefined;
  let steps = 0;
  let toolNames: string[] = [];
  const generate = (m: string) =>
    generateText({
      model: anthropic(m),
      instructions,
      messages: [...session.messages, { role: "user", content: userTurn }],
      tools: createTools(ctx),
      stopWhen: isStepCount(5),
      maxOutputTokens: 2000, // Sonnet thinking counts toward this limit
      providerOptions: { anthropic: providerOptions(m) },
      // A forced turn needs exactly one tool call; afterwards only the spoken answer
      // (Haiku once saved the same lesson twice and the count jumped by two).
      // After a forced call the forced tool is taken away (no double saves), but tool
      // choice stays auto: with "none", Haiku wrote its tool arguments out as speech.
      prepareStep: ({ stepNumber }) =>
        force && m.includes("haiku")
          ? stepNumber === 0
            ? { toolChoice: { type: "tool" as const, toolName: force } }
            : { toolChoice: "auto" as const, activeTools: Object.keys(createTools(ctx)).filter((n) => n !== force) as (keyof ReturnType<typeof createTools>)[] }
          : { toolChoice: "auto" as const },
    });
  let usedModel = model;
  let rerun = false;
  try {
    let result = await generate(model);
    let raw = (result.finalStep.text || result.text).trim();
    let ran = result.toolResults.map((r) => r.toolName);
    const first = sayTag(raw) ?? raw;
    const lied = CLAIMS.some((c) => c.words.test(first) && !c.tools.some((t) => ran.includes(t)));
    if (lied && model !== SMART) {
      console.log("[agent] fast model claimed an action without the tool, rerunning on", SMART, JSON.stringify(first));
      ctx.actions.length = 0;
      ctx.private = false;
      rerun = true;
      usedModel = SMART;
      result = await generate(SMART);
      raw = (result.finalStep.text || result.text).trim();
      ran = result.toolResults.map((r) => r.toolName);
    }
    steps = result.steps.length;
    toolNames = ran; // executed only
    for (const st of result.steps)
      for (const c of st.content)
        if (c.type === "tool-error") console.warn("[agent] tool error:", c.toolName, String((c as { error?: unknown }).error));
    let spoken = clean(sayTag(raw) ?? raw.split(/<(en|heard|family)>/)[0]);
    // Never read tool arguments or log text out loud.
    if (LEAK.test(spoken)) {
      console.warn("[agent] replaced a leaked tool-looking reply:", JSON.stringify(spoken));
      spoken = safeLine(ran);
    }
    if (spoken.length >= 4) say = EN ? twoSentences(spoken) : spoken;
    if (EN) sayEn = say;
    else sayEn = tag(raw, "en") ? clean(tag(raw, "en")!) : undefined;
    heardEn = heardEn ?? (tag(raw, "heard") ? clean(tag(raw, "heard")!) || undefined : undefined);
    familyText = tag(raw, "family") ? clean(tag(raw, "family")!) : undefined;
    if (process.env.HYODO_DEBUG || spoken.length < 4) console.log("[agent] raw:", JSON.stringify(raw), result.finishReason);
  } catch (err) {
    console.error("[agent] generateText failed:", err);
    logEvent("alert", `[warn] ${AGENT_NAME} ${L.brainError}: ${err instanceof Error ? err.message : String(err)}`, nowIso);
    sayEn = EN ? say : FALLBACK_EN;
  }

  // Korean mode: the model sometimes drops the <en> tag; subtitles must not go blank on stage.
  if (!sayEn && say !== L.fallbackSay) sayEn = await translate(say);
  if (EN) sayEn ??= say;

  if (req.source === "proactive" && /\b(groceries|get you|pick up|order|shopping)\b|장 ?봐|주문|사다/i.test(say)) {
    shared.offer = { kind: "errand", said: say, basis: taughtNewest?.text ?? "" };
  }

  const done = [...new Set(toolNames)].filter((n) => !["memory_recall", "info_weather", "info_news", "epg_search", "lessons_show", "wallet_balance"].includes(n));
  pushTurn(userTurn, done.length ? `${say} ${L.doneNote(done.join(", "))}` : say);
  logEvent(
    "said",
    say,
    nowIso,
    ctx.private ? { visibility: "private" } : { visibility: "summary", familyText: familyText ? `${kstClock(now)} ${familyText}` : undefined },
  );

  return {
    say,
    sayEn,
    heardEn,
    // Kept from the family: keep_private, or only private records and nothing sent to mom.
    private: (ctx.private && !toolNames.includes("family_notify")) || undefined,
    actions: ctx.actions,
    meta: { ms: Date.now() - started, model: usedModel, rerun, memory: memory.backend, lang: APP_LANG, steps, tools: toolNames, lessons: lessons.length },
  };
}
