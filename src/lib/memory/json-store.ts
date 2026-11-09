import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { APP_LANG } from "@/lib/brand";
import { SEED_FACTS, SEED_LESSONS, SEED_PROVENANCE } from "./seed";
import { rankFacts } from "./search";
import { bumpMemVersion, memVersion, type MemoryFact, type MemoryStore } from "./types";

// File-backed memory, the safety net under GBrain. Lives outside the repo.
const DATA_DIR = process.env.HYODO_DATA_DIR ?? path.join(os.homedir(), ".hyodo-tv");
const FILE = path.join(DATA_DIR, APP_LANG === "en" ? "memory-en.json" : "memory.json");

let cache: MemoryFact[] | null = null;
let seen = memVersion("json");
let writing: Promise<void> = Promise.resolve();

export function seedFacts(): MemoryFact[] {
  const at = new Date().toISOString();
  return [
    ...SEED_FACTS.map((f) => ({ ...f, id: crypto.randomUUID(), at, provenance: "seed (demo data)" })),
    ...SEED_LESSONS.map((l) => ({
      id: crypto.randomUUID(),
      text: l.text,
      category: "lesson" as const,
      source: "seed" as const,
      at: new Date(l.at).toISOString(),
      provenance: SEED_PROVENANCE,
    })),
  ];
}

async function load(): Promise<MemoryFact[]> {
  if (seen !== memVersion("json")) cache = null;
  seen = memVersion("json");
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, "utf8")) as MemoryFact[];
  } catch {
    cache = seedFacts();
    await save();
  }
  return cache;
}

function save(): Promise<void> {
  bumpMemVersion("json");
  seen = memVersion("json");
  const snapshot = JSON.stringify(cache ?? [], null, 2);
  writing = writing.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, snapshot, "utf8");
  });
  return writing;
}

export const jsonMemory: MemoryStore = {
  backend: "json",
  async remember({ text, category = "taught", source = "grandma", provenance, at }) {
    const facts = await load();
    const known = facts.find((f) => f.text === text);
    if (known) return { ...known, duplicate: true };
    const fact: MemoryFact = { id: crypto.randomUUID(), text, category, source, at: at ?? new Date().toISOString(), provenance };
    facts.push(fact);
    await save();
    return fact;
  },
  async correct(id, text, provenance) {
    const facts = await load();
    const i = facts.findIndex((f) => f.id === id);
    if (i < 0) return null;
    const next: MemoryFact = { ...facts[i], id: crypto.randomUUID(), text, at: new Date().toISOString(), provenance, source: "grandma" };
    facts.splice(i, 1, next);
    await save();
    return next;
  },
  async forget(id) {
    const facts = await load();
    const i = facts.findIndex((f) => f.id === id);
    if (i < 0) return false;
    facts.splice(i, 1);
    await save();
    return true;
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
