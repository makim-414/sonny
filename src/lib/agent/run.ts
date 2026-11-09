import net from "node:net";
import { anthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { generateText, isStepCount } from "ai";
import { channelName } from "@/lib/epg";
import { getMemory, isLesson } from "@/lib/memory";
import { kstClock, kstLabel, kstParts, todayAgenda } from "@/lib/scheduler";
import { logEvent, store } from "@/lib/store";
import type { AgentReply, AgentRequest, TvAction } from "@/lib/types";
import { AGENT_NAME, PERSONA, PROACTIVE_TASKS } from "./persona";
import { getSession, pushTurn } from "./session";
import { createTools, DEMO, lessonsThisMonth, shared, type AgentContext } from "./tools";

// On the venue network IPv6 to api.anthropic.com hangs and Node's default 250 ms
// happy-eyeballs window fails the whole connect (ETIMEDOUT). Give IPv4 time.
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

// Routing: Haiku (no thinking) for talk, Sonnet for turns that act in the world.
const FAST = process.env.HYODO_FAST_MODEL ?? "claude-haiku-5-5";
const SMART = process.env.HYODO_SMART_MODEL ?? "claude-sonnet-5-5";
// Clear teaching ("내 손주 이름은 민수야", "김장할 때는 ... 해야 해"): Haiku is made to
// call memory_remember on its first step, since it sometimes only says it will.
const TEACH_WORDS = /기억해|이름은|이름이|비법|가르쳐|알려 줄게|해야 (해|돼|한다)|하면 (돼|좋아)|절여|넣어야|remember this|my .* name is|recipe/i;
const PLAY_EN = /\b(turn on|put on|play|watch|switch to)\b/i;
const MED_WORDS = /약.{0,6}(먹었|먹음|먹을게|드셨|챙겨 먹|안 먹)|took my (medicine|pills)/i;
const LESSON_COUNT_WORDS = /배운 (거|게|것).{0,8}(몇|얼마)|how many .*(learn|taught)/i;
// Haiku sometimes claims an action without calling the tool. Rerun those on Sonnet.
const CLAIMS = [
  { words: /주문했|시켰|주문 넣/, tools: ["errand_order"] },
  { words: /택시.*(불렀|요청했)/, tools: ["ride_request"] },
  { words: /기억할게|기억해 둘게|기억해 두었|기억했/, tools: ["memory_remember", "memory_correct"] },
  { words: /틀어 드렸|틀었어|찾아볼게|찾아 드릴게/, tools: ["tv_play", "tv_tune", "epg_search"] },
  { words: /틀어 드릴게|알려 드릴게|예약했|예약해 둘게/, tools: ["schedule_at", "tv_play"] },
  { words: /알렸어|전해 드렸|전했어|전해 드릴게|전할게/, tools: ["family_notify", "health_checkin"] },
];
// Turns that spend money, touch safety or privacy, or rewrite memory go to Sonnet.
// Talk, teaching, TV and reminders stay on Haiku (guarded by CLAIMS above).
const SMART_WORDS =
  /택시|불러|시켜|주문|사다|사 줘|장보|배달|아파|아프|어지|숨이|가슴|넘어|쓰러|말하지 마|비밀|아니야|아니,|말고|고쳐|틀렸|taxi|cab|order|buy|hurt|pain|dizzy|don't tell|secret|not .* but/i;

function pickModel(req: AgentRequest): string {
  if (process.env.HYODO_MODEL) return process.env.HYODO_MODEL;
  if (req.source === "voice" && SMART_WORDS.test(req.text)) return SMART;
  return FAST;
}

function providerOptions(model: string) {
  const effort = (process.env.HYODO_EFFORT ?? "low") as "low" | "medium" | "high";
  // Haiku 5.5 can turn thinking off; Sonnet 5.5 always thinks.
  // Haiku 5.5 can turn thinking off; Sonnet 5.5's lowest setting is between_tools.
  return (model.includes("haiku")
    ? { effort, thinking: { type: "disabled" } }
    : { effort, thinking: { type: "between_tools" } }) satisfies AnthropicLanguageModelOptions;
}

const FALLBACK_SAY = "잠깐만요 할머니, 제가 다시 한번 여쭤볼게요.";
const FALLBACK_EN = "One moment, let me ask you again.";
const isEnglish = (s: string) => (s.match(/[a-z]/gi)?.length ?? 0) > (s.match(/[가-힣]/g)?.length ?? 0);

function parseFamily(text: string) {
  // TV may send "엄마: 메시지" or just the message. "엄마" (mom) is grandma's daughter.
  const m = text.match(/^\s*([^:：]{1,10})\s*[:：]\s*([\s\S]+)$/);
  const raw = m ? m[1].trim() : "";
  const from = !raw || /^(엄마|mom|딸)$/i.test(raw) ? "딸 민정" : raw;
  return { from, message: (m ? m[2] : text).trim() };
}

const tag = (s: string, t: string) => s.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`))?.[1]?.trim();
const clean = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\[[^\]]*\]/g, "").replace(/\s*\n+\s*/g, " ").trim();

type Reply = AgentReply & { meta: Record<string, unknown> };

/** Mom approved a taxi or order in the family app. Deterministic, no model call. */
function handleApproval(text: string, now: Date): Reply | null {
  if (!/승인/.test(text)) return null;
  const wantTaxi = /택시|카카오|차량|배차/.test(text);
  const wantOrder = /주문|장보기|배달|구매|마트/.test(text);
  const idx = [...shared.requests.keys()]
    .reverse()
    .find((i) => (wantTaxi ? shared.requests[i].kind === "taxi" : wantOrder ? shared.requests[i].kind === "order" : true));
  if (idx === undefined) return null;
  const [req] = shared.requests.splice(idx, 1);
  const at = now.toISOString();
  const actions: TvAction[] = [];
  let say: string;
  let sayEn: string;
  if (req.kind === "taxi") {
    const r = req.ride;
    const eta = 5;
    const plateTail = r.plate.slice(-4);
    actions.push({
      type: "showCard",
      title: `택시가 ${eta}분 뒤 도착해요`,
      body: `${r.carModel}  ${r.plate}\n${r.driver}\n${r.pickup.name} → ${r.destination.name}\n따님이 승인했어요\n${DEMO}`,
    });
    say = `따님이 승인했어요. ${r.carModel} 택시가 ${eta}분 뒤에 와요. 차 번호는 ${plateTail}이에요.`;
    sayEn = `Your daughter approved it. A ${r.carModel.includes("쏘나타") ? "white Sonata" : "taxi"} arrives in ${eta} minutes, plate ending ${plateTail}.`;
    logEvent("task", `택시 배차: ${r.carModel} ${r.plate}, ${kstClock(new Date(now.getTime() + eta * 60_000))} 도착, ${r.pickup.name} → ${r.destination.name} (${DEMO})`, at, { visibility: "family" });
  } else {
    const o = req.order;
    const list = o.items.map((i) => `${i.name} ${i.qty}개`).join(", ");
    actions.push({ type: "showCard", title: "주문이 확정됐어요", body: `${list}\n${o.arrives} 도착\n따님이 승인했어요\n${DEMO}` });
    say = `따님이 주문을 승인했어요. ${o.arrives}에 도착해요.`;
    sayEn = `Your daughter approved the order. It arrives tomorrow before 7 a.m.`;
    logEvent("task", `주문 확정: ${list}, ${o.arrives} 도착 (${DEMO})`, at, { visibility: "family" });
  }
  logEvent("said", say, at, { visibility: "family" });
  pushTurn(`[가족 승인] ${text}`, `${say} [한 일: ${req.kind === "taxi" ? "택시 배차 확정" : "주문 확정"}]`);
  return { say, sayEn, actions, meta: { ms: 0, model: "none (approval)", tools: [] } };
}

export async function runAgent(req: AgentRequest, opts: { model?: string } = {}): Promise<Reply> {
  const started = Date.now();
  const now = req.now && Number.isFinite(Date.parse(req.now)) ? new Date(req.now) : new Date();
  const nowIso = now.toISOString();
  const memory = await getMemory();
  const session = getSession(Date.now());
  const ctx: AgentContext = { now, memory, actions: [], private: false };

  if (req.source === "family") {
    const approved = handleApproval(req.text, now);
    if (approved) return { ...approved, meta: { ...approved.meta, ms: Date.now() - started, memory: memory.backend } };
  }

  // Build the user turn for this request.
  let userTurn: string;
  let task = "";
  let defaultSay = FALLBACK_SAY;
  let heardEn: string | undefined;
  let replyingToFamily = false;
  const english = req.source !== "proactive" && isEnglish(req.text);
  if (req.source === "proactive") {
    const key = req.text.trim();
    task = PROACTIVE_TASKS[key] ?? `TV가 먼저 말을 건다: ${key}`;
    userTurn = `[시스템: 먼저 말 걸기 ${key}]`;
    logEvent("heard", `먼저 말 걸기: ${key}`, nowIso, { visibility: "family" });
  } else if (req.source === "family") {
    const fam = parseFamily(req.text);
    session.awaitingFamilyReply = fam;
    ctx.actions.push({ type: "showCard", title: `${fam.from} 메시지`, body: fam.message });
    task = `가족(${fam.from})이 보낸 메시지가 방금 TV에 떴다. 할머니께 다정하게 그대로 전해 드리고, 답하실 말씀이 있으면 해 달라고 한마디 덧붙인다. 도구는 부르지 않는다. <heard> 에는 가족 메시지의 영어 번역을 쓴다.`;
    userTurn = `[가족 메시지 도착] ${fam.from}: ${fam.message}`;
    defaultSay = `할머니, ${fam.from.replace(/^딸 /, "")}이가 메시지를 보냈어요. ${fam.message}`;
  } else {
    replyingToFamily = !!session.awaitingFamilyReply;
    userTurn = req.text;
    logEvent("heard", req.text, nowIso, { visibility: "private" });
    if (english) {
      heardEn = req.text;
      task = "이번 말은 영어다(TV를 체험하는 손님일 수 있다). 뜻대로 처리하고, <ko> 는 아주 짧은 한국어, <en> 은 영어로 쓴다. <heard> 는 들은 영어 그대로.";
    }
    if (session.awaitingFamilyReply) {
      const fam = session.awaitingFamilyReply;
      task += ` 방금 ${fam.from}의 메시지("${fam.message}")를 전해 드렸고, 지금 말씀은 그에 대한 할머니 답일 가능성이 높다. 답이 맞으면 family_notify(reply=true) 로 할머니 답을 한 줄 요약해 보내고, 전해 드리겠다고 짧게 말씀드린다. 비밀로 하라고 하시면 보내지 않는다.`;
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

  const today = kstParts(now);
  const tookMeds = shared.health.some((h) => {
    const p = kstParts(new Date(h.at));
    return h.medicineTaken && p.year === today.year && p.month === today.month && p.day === today.day;
  });

  const ch = store.currentChannel;
  const instructions = [
    PERSONA,
    `지금 시각: ${kstLabel(now)} (ISO ${nowIso}, 한국 시간 +09:00)`,
    `지금 TV: ${ch ? `${ch}번 ${channelName(ch) ?? ""}` : "꺼져 있거나 모름"}`,
    `오늘 약: ${tookMeds ? "이미 드셨다고 기록됨. 다시 묻지 않는다." : "아직 기록 없음"}`,
    `오늘 일정:\n${todayAgenda(now).map((a) => `- ${a}`).join("\n") || "- 없음"}`,
    `할머니에 대해 기억하는 것 (GBrain id, 내용):\n${facts.map((f) => `- (${f.id}) ${f.text}`).join("\n")}`,
    recentTaught.length ? `최근 새로 배운 것:\n${recentTaught.map((f) => `- (${f.id}) ${f.text}`).join("\n")}` : "",
    `이번 달 할머니께 배운 lesson: ${lessons.length}개`,
    shared.lastLater?.length
      ? `방금 알려 드린 나중 프로그램 (예약할 때 이 채널과 시각을 그대로 쓴다):\n${shared.lastLater.map((l) => `- ${l.channel}번 ${l.channelName} "${l.title}" ${l.startsAt} (${l.startISO})`).join("\n")}`
      : "",
    task ? `이번 차례 할 일: ${task.trim()}` : "",
    "마지막 답은 반드시 <ko>…</ko><en>…</en><heard>…</heard><family>…</family> 형식으로 쓴다.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const model = opts.model ?? pickModel(req);
  // Force the one tool this turn clearly needs (Haiku only: Sonnet always thinks,
  // and Anthropic rejects a forced tool choice with thinking on).
  const force: "family_notify" | "memory_remember" | "health_checkin" | "lessons_show" | "tv_play" | null =
    req.source !== "voice"
      ? null
      : replyingToFamily && !/말하지 마|비밀|don't tell/i.test(req.text)
        ? "family_notify"
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
      prepareStep: ({ stepNumber }) =>
        force && m.includes("haiku") && stepNumber === 0
          ? { toolChoice: { type: "tool" as const, toolName: force } }
          : { toolChoice: "auto" as const },
    });
  let usedModel = model;
  let rerun = false;
  try {
    let result = await generate(model);
    let raw = (result.finalStep.text || result.text).trim();
    let ran = result.toolResults.map((r) => r.toolName);
    const ko0 = tag(raw, "ko") ?? raw;
    const lied = CLAIMS.some((c) => c.words.test(ko0) && !c.tools.some((t) => ran.includes(t)));
    if (lied && model !== SMART) {
      console.log("[agent] fast model claimed an action without the tool, rerunning on", SMART, JSON.stringify(ko0));
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
    const ko = clean(tag(raw, "ko") ?? raw.split(/<en>/)[0]);
    if (ko.length >= 4) say = ko;
    sayEn = tag(raw, "en") ? clean(tag(raw, "en")!) : undefined;
    heardEn = heardEn ?? (tag(raw, "heard") ? clean(tag(raw, "heard")!) || undefined : undefined);
    familyText = tag(raw, "family") ? clean(tag(raw, "family")!) : undefined;
    if (process.env.HYODO_DEBUG || ko.length < 4) console.log("[agent] raw:", JSON.stringify(raw), result.finishReason);
  } catch (err) {
    console.error("[agent] generateText failed:", err);
    logEvent("alert", `[warn] ${AGENT_NAME} 두뇌 오류: ${err instanceof Error ? err.message : String(err)}`, nowIso);
    sayEn = FALLBACK_EN;
  }

  const done = [...new Set(toolNames)].filter((n) => !["memory_recall", "info_weather", "info_news", "epg_search", "lessons_show"].includes(n));
  pushTurn(userTurn, done.length ? `${say} [한 일: ${done.join(", ")}]` : say);
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
    meta: { ms: Date.now() - started, model: usedModel, rerun, memory: memory.backend, steps, tools: toolNames, lessons: lessons.length },
  };
}
