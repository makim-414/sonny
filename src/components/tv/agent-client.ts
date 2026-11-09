import type { AgentReply, AgentRequest, TvAction } from "@/lib/types";
import { mockAgent } from "./mock-agent";

// After the real API answers 404 (not built yet), skip it for a while instead of hitting it every turn.
const RETRY_AFTER_MS = 20_000;
let apiMissingUntil = 0;

export type AgentResult = { reply: AgentReply; fromMock: boolean };

function isReply(x: unknown): x is AgentReply {
  return typeof x === "object" && x !== null && typeof (x as AgentReply).say === "string";
}

function normalize(reply: AgentReply): AgentReply {
  const actions: TvAction[] = Array.isArray(reply.actions) ? reply.actions : [];
  return { say: reply.say, actions };
}

export async function callAgent(req: AgentRequest): Promise<AgentResult> {
  if (Date.now() >= apiMissingUntil) {
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
        // A slow model must not freeze the TV: after 20s fall back to the local reply.
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 404) {
        apiMissingUntil = Date.now() + RETRY_AFTER_MS;
      } else if (res.ok) {
        const json: unknown = await res.json();
        if (isReply(json)) return { reply: normalize(json), fromMock: false };
        console.warn("[tv] /api/agent returned an unexpected shape, using mock", json);
      } else {
        console.warn(`[tv] /api/agent failed with ${res.status}, using mock`);
      }
    } catch (err) {
      console.warn("[tv] /api/agent unreachable, using mock", err);
    }
  }
  return { reply: mockAgent(req), fromMock: true };
}
