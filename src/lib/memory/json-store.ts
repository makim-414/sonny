import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { SEED_FACTS } from "./seed";
import { rankFacts } from "./search";
import type { MemoryFact, MemoryStore } from "./types";

// File-backed memory. Lives outside the repo so nothing personal gets committed.
const DATA_DIR = process.env.HYODO_DATA_DIR ?? path.join(os.homedir(), ".hyodo-tv");
const FILE = path.join(DATA_DIR, "memory.json");

let cache: MemoryFact[] | null = null;
let writing: Promise<void> = Promise.resolve();

async function load(): Promise<MemoryFact[]> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, "utf8")) as MemoryFact[];
  } catch {
    const at = new Date().toISOString();
    cache = SEED_FACTS.map((f) => ({ ...f, id: crypto.randomUUID(), at }));
    await save();
  }
  return cache;
}

function save(): Promise<void> {
  const snapshot = JSON.stringify(cache ?? [], null, 2);
  writing = writing.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, snapshot, "utf8");
  });
  return writing;
}

export const jsonMemory: MemoryStore = {
  backend: "json",
  async remember({ text, category = "taught", source = "grandma" }) {
    const facts = await load();
    const fact: MemoryFact = { id: crypto.randomUUID(), text, category, source, at: new Date().toISOString() };
    facts.push(fact);
    await save();
    return fact;
  },
  async recall(query, limit = 6) {
    return rankFacts(await load(), query, limit);
  },
  async all() {
    return [...(await load())];
  },
};

// Demo reset: back to seed facts only.
export async function resetJsonMemory() {
  cache = null;
  await fs.rm(FILE, { force: true });
  await load();
}
