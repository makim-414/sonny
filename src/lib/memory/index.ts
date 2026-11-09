import { sharedEnabled } from "@/lib/shared-state";
import { jsonMemory, resetJsonMemory } from "./json-store";
import type { MemoryStore } from "./types";

export type { MemoryFact, MemoryStore, MemoryCategory } from "./types";
export { isLesson } from "./types";

// GBrain (keyless PGLite) is the default; HYODO_MEMORY=json forces the JSON file.
// GBrain is a local PGLite CLI, so on Vercel (shared Redis on) the Redis-backed JSON store is used.
// Any GBrain failure at startup falls back to JSON so the demo never stalls.
let chosen: Promise<MemoryStore> | null = null;

async function pick(): Promise<MemoryStore> {
  if (process.env.HYODO_MEMORY !== "json" && !sharedEnabled()) {
    try {
      const { createGbrainMemory } = await import("./gbrain-store");
      return await createGbrainMemory();
    } catch (err) {
      console.warn("[memory] GBrain unavailable, falling back to JSON:", err instanceof Error ? err.message : err);
    }
  }
  return jsonMemory;
}

export function getMemory(): Promise<MemoryStore> {
  return (chosen ??= pick());
}

export async function resetMemory() {
  await resetJsonMemory();
  if (process.env.HYODO_MEMORY !== "json" && !sharedEnabled()) {
    const { resetGbrainMemory } = await import("./gbrain-store");
    await resetGbrainMemory().catch((err) => console.warn("[memory] GBrain reset failed:", err));
  }
  chosen = null;
}
