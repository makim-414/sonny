import net from "node:net";
import { anthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { generateText, isStepCount } from "ai";
import { getMemory } from "@/lib/memory";
import { kstLabel, todayAgenda } from "@/lib/scheduler";
import { logEvent, store } from "@/lib/store";
import type { AgentReply, AgentRequest } from "@/lib/types";
import { channelName } from "@/lib/epg";
import { AGENT_NAME, PERSONA, PROACTIVE_TASKS } from "./persona";
import { getSession, pushTurn } from "./session";
import { createTools, type AgentContext } from "./tools";

// On the venue network IPv6 to api.anthropic.com hangs and Node's default 250 ms
// happy-eyeballs window fails the whole connect (ETIMEDOUT). Give IPv4 time.
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

export const MODEL_ID = process.env.HYODO_MODEL ?? "claude-sonnet-5-5";
const FALLBACK_SAY = "잠깐만요 할머니, 제가 다시 한번 여쭤볼게요.";

function parseFamily(text: string) {
  // TV may send "엄마: 메시지" or just the message.
  const m = text.match(/^\s*([^:：]{1,10})\s*[:：]\s*([\s\S]+)$/);
  // The family app speaks as "엄마" (mom); to grandma that is her daughter.
  const raw = m ? m[1].trim() : "";
  const from = !raw || /^(엄마|mom|딸)$/i.test(raw) ? "딸 민정" : raw;
  return { from, message: (m ? m[2] : text).trim() };
}

export async function runAgent(req: AgentRequest): Promise<AgentReply & { meta: Record<string, unknown> }> {
  const started = Date.now();
  const now = req.now && Number.isFinite(Date.parse(req.now)) ? new Date(req.now) : new Date();
  const nowIso = now.toISOString();
  const memory = await getMemory();
  const session = getSession(Date.now());
  const ctx: AgentContext = { now, memory, actions: [] };

  // Build the user turn for this request.
  let userTurn: string;
  let task = "";
  let defaultSay = FALLBACK_SAY;
  if (req.source === "proactive") {
    const key = req.text.trim();
    task = PROACTIVE_TASKS[key] ?? `TV가 먼저 말을 건다: ${key}`;
    userTurn = `[시스템: 먼저 말 걸기 ${key}]`;
    logEvent("heard", `먼저 말 걸기: ${key}`, nowIso);
  } else if (req.source === "family") {
    const fam = parseFamily(req.text);
    session.awaitingFamilyReply = fam;
    ctx.actions.push({ type: "showCard", title: `${fam.from} 메시지`, body: fam.message });
    logEvent("family", `${fam.from} → TV: ${fam.message}`, nowIso);
    task = `가족(${fam.from})이 보낸 메시지가 방금 TV에 떴다. 할머니께 다정하게 그대로 전해 드리고, 답하실 게 있으면 말씀해 달라고 한마디 덧붙인다. 도구는 부르지 않는다.`;
    userTurn = `[가족 메시지 도착] ${fam.from}: ${fam.message}`;
    defaultSay = `할머니, ${fam.from.replace(/^딸 /, "")}이가 메시지를 보냈어요. ${fam.message}`;
  } else {
    userTurn = req.text;
    logEvent("heard", req.text, nowIso);
    if (session.awaitingFamilyReply) {
      const fam = session.awaitingFamilyReply;
      task = `방금 ${fam.from}의 메시지("${fam.message}")를 전해 드렸고, 지금 말씀은 그에 대한 할머니 답일 가능성이 높다. 답이 맞으면 family_notify 로 "할머니 답: (한 줄 요약)" 을 보내고, 전해 드리겠다고 짧게 말씀드린다.`;
      session.awaitingFamilyReply = null;
    }
  }

  // Pull relevant memory up front so most turns need no recall step.
  const recalled = await memory.recall(req.source === "proactive" ? "약 절 병원 딸 좋아" : req.text, 6);
  const core = await memory.recall("약 병원 집 딸 임영웅 절", 8);
  const facts = [...new Map([...core, ...recalled].map((f) => [f.id, f])).values()];
  if (recalled.length) logEvent("memory", `기억 꺼냄: ${recalled.map((f) => f.text).slice(0, 2).join(" / ")}`, nowIso);

  const agenda = todayAgenda(now);
  const ch = store.currentChannel;
  const instructions = [
    PERSONA,
    `지금 시각: ${kstLabel(now)} (ISO ${nowIso}, 한국 시간 +09:00)`,
    `지금 TV: ${ch ? `${ch}번 ${channelName(ch) ?? ""}` : "꺼져 있거나 모름"}`,
    `오늘 일정:\n${agenda.length ? agenda.map((a) => `- ${a}`).join("\n") : "- 없음"}`,
    `할머니에 대해 기억하는 것 (${memory.backend}):\n${facts.map((f) => `- ${f.text}`).join("\n")}`,
    task ? `이번 차례 할 일: ${task}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let say = defaultSay;
  let steps = 0;
  let toolNames: string[] = [];
  try {
    const result = await generateText({
      model: anthropic(MODEL_ID),
      instructions,
      messages: [...session.messages, { role: "user", content: userTurn }],
      tools: createTools(ctx),
      stopWhen: isStepCount(5),
      // Sonnet 5.5 always thinks; thinking counts toward this limit. Low effort keeps replies fast.
      maxOutputTokens: 2000,
      providerOptions: {
        anthropic: { effort: (process.env.HYODO_EFFORT ?? "low") as "low" | "medium" | "high" } satisfies AnthropicLanguageModelOptions,
      },
    });
    steps = result.steps.length;
    toolNames = result.toolResults.map((r) => r.toolName); // executed only
    const text = (result.finalStep.text || result.text).trim();
    if (process.env.HYODO_DEBUG || text.length < 8) console.log("[agent] raw:", JSON.stringify(result.steps.map((st) => ({ text: st.text, finish: st.finishReason, calls: st.toolCalls.map((c) => c.toolName), results: st.toolResults.length, content: st.content.map((c) => c.type) }))));
    if (text) say = text.replace(/\[[^\]]*\]/g, "").replace(/\s*\n+\s*/g, " ").trim();
    if (text.length < 8 || say.length < 8) say = defaultSay;
  } catch (err) {
    console.error("[agent] generateText failed:", err);
    logEvent("alert", `${AGENT_NAME} 두뇌 오류: ${err instanceof Error ? err.message : String(err)}`, nowIso);
  }

  // Keep a note of what was already done so the next turn does not redo it.
  const done = [...new Set(toolNames)].filter((n) => n !== "memory_recall" && n !== "info_weather" && n !== "info_news" && n !== "epg_search");
  pushTurn(userTurn, done.length ? `${say} [한 일: ${done.join(", ")}]` : say);
  logEvent("said", say, nowIso);

  return {
    say,
    actions: ctx.actions,
    meta: { ms: Date.now() - started, model: MODEL_ID, memory: memory.backend, steps, tools: toolNames },
  };
}
