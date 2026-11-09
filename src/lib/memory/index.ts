import { jsonMemory } from "./json-store";
import type { MemoryStore } from "./types";

export type { MemoryFact, MemoryStore, MemoryCategory } from "./types";

// HYODO_MEMORY=gbrain switches to the GBrain adapter; JSON is the safe default.
let chosen: MemoryStore | null = null;

export async function getMemory(): Promise<MemoryStore> {
  if (chosen) return chosen;
  if (process.env.HYODO_MEMORY === "gbrain") {
    try {
      const { createGbrainMemory } = await import("./gbrain-store");
      chosen = await createGbrainMemory();
      return chosen;
    } catch (err) {
      console.warn("[memory] GBrain unavailable, falling back to JSON:", err);
    }
  }
  chosen = jsonMemory;
  return chosen;
}
