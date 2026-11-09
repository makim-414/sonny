import type { ModelMessage } from "ai";

// Short rolling conversation so the agent can ask one question and act on the
// answer (taxi confirm, family reply summary). One grandma, one TV.
type Session = {
  messages: ModelMessage[];
  lastAt: number;
  // Set when a family message was just relayed; the next voice turn is her reply.
  awaitingFamilyReply: { from: string; message: string } | null;
};

const g = globalThis as unknown as { __hyodoSession?: Session };
const session: Session = g.__hyodoSession ?? (g.__hyodoSession = { messages: [], lastAt: 0, awaitingFamilyReply: null });

const IDLE_RESET_MS = 15 * 60_000;
const MAX_MESSAGES = 16;

export function getSession(nowMs: number) {
  if (nowMs - session.lastAt > IDLE_RESET_MS && session.lastAt !== 0) {
    session.messages = [];
    session.awaitingFamilyReply = null;
  }
  session.lastAt = nowMs;
  return session;
}

export function pushTurn(user: string, assistant: string) {
  session.messages.push({ role: "user", content: user }, { role: "assistant", content: assistant });
  if (session.messages.length > MAX_MESSAGES) session.messages.splice(0, session.messages.length - MAX_MESSAGES);
}

export function resetSession() {
  session.messages = [];
  session.awaitingFamilyReply = null;
  session.lastAt = 0;
}
