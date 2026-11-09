import type { MemoryStore } from "./types";

// Placeholder until the GBrain PGLite adapter lands.
export async function createGbrainMemory(): Promise<MemoryStore> {
  throw new Error("GBrain adapter not wired yet");
}
