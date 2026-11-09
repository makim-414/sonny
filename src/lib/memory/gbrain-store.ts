import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { jsonMemory } from "./json-store";
import { SEED_FACTS, SEED_LESSONS } from "./seed";
import { rankFacts } from "./search";
import type { MemoryCategory, MemoryFact, MemoryStore } from "./types";

// GBrain (github.com/garrytan/gbrain) on keyless local PGLite, driven through its CLI.
// One entity "grandma" holds every fact. Each fact carries provenance (who taught it,
// when) and valid_from; corrections use `remember --replaces`, withdrawals use `forget`.
// Keyword-only: no embedding or LLM calls, so the Anthropic key is stripped on purpose.
const execFileP = promisify(execFile);

const HOME = os.homedir();
const BUN = process.env.HYODO_GBRAIN_BUN ?? path.join(HOME, ".hyodo-tv/bun/bun-darwin-aarch64/bun");
const CLI = process.env.HYODO_GBRAIN_CLI ?? "/Users/makim/_sessions/c0mpiled-17/vendor/gbrain/src/cli.ts";
const GBRAIN_HOME = process.env.GBRAIN_HOME ?? path.join(HOME, ".hyodo-tv/gbrain-home");
// Each demo run gets its own entity (grandma-run-N). A reset starts a new run
// instead of forgetting facts: GBrain refuses to re-remember a withdrawn claim,
// and keeping old runs leaves an honest record.
const RUN_FILE = path.join(GBRAIN_HOME, "hyodo-run.json");
let ENTITY = "grandma-run-1";
async function loadRun() {
  try {
    ENTITY = (JSON.parse(await fs.readFile(RUN_FILE, "utf8")) as { entity: string }).entity;
  } catch {
    await fs.writeFile(RUN_FILE, JSON.stringify({ entity: ENTITY }));
  }
}
export const currentEntity = () => ENTITY;

type GbFact = { id: number; fact: string; source: string | null; valid_from: string; created_at: string; expired_at: string | null; superseded_by: number | null };

// PGLite allows one process at a time, so calls are queued, and a failed call
// (lock still held by a process that is exiting) is retried once.
let queue: Promise<unknown> = Promise.resolve();

async function gbOnce(args: string[]): Promise<string> {
  const env: NodeJS.ProcessEnv = { ...process.env, GBRAIN_HOME };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_BASE_URL;
  const { stdout } = await execFileP(BUN, [CLI, ...args], { cwd: GBRAIN_HOME, env, timeout: 15_000, maxBuffer: 8 << 20 });
  return stdout;
}

function gb(args: string[]): Promise<string> {
  const run = queue.then(async () => {
    try {
      return await gbOnce(args);
    } catch (err) {
      const e = err as { stderr?: string; stdout?: string; code?: number };
      console.warn(`[gbrain] ${args[0]} failed (code ${e.code}), retrying:`, (e.stderr || e.stdout || "").slice(-400));
      await new Promise((r) => setTimeout(r, 300));
      return gbOnce(args);
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

// "[category] text" keeps our category inside GBrain's plain fact string.
const encode = (text: string, category: MemoryCategory) => `[${category}] ${text}`;
function decode(f: GbFact): MemoryFact {
  const m = f.fact.match(/^\[(\w+)\]\s*([\s\S]*)$/);
  const prov = f.source ?? "";
  const source: MemoryFact["source"] = prov.startsWith("seed") ? "seed" : prov.startsWith("family") ? "family" : "grandma";
  return {
    id: `gbrain-${f.id}`,
    text: m ? m[2] : f.fact,
    category: (m ? m[1] : "other") as MemoryCategory,
    source,
    at: f.valid_from ?? f.created_at,
    provenance: prov,
  };
}
const rawId = (id: string) => id.replace(/^gbrain-/, "");

async function fetchAll(): Promise<GbFact[]> {
  const out = JSON.parse(await gb(["recall", ENTITY, "--limit", "500", "--json"])) as { facts: GbFact[] };
  return out.facts.filter((f) => !f.expired_at && !f.superseded_by);
}

async function seed() {
  const items = [
    ...SEED_FACTS.map((f) => ({ fact: encode(f.text, f.category), entity: ENTITY, provenance: "seed (demo data)" })),
    ...SEED_LESSONS.map((l) => ({
      fact: encode(l.text, "lesson"),
      entity: ENTITY,
      provenance: "seed: 김순자 할머니가 TV 대화에서 가르침 (demo data)",
      valid_from: new Date(l.at).toISOString(),
    })),
  ];
  for (let i = 0; i < items.length; i += 20) {
    await gb(["remember", "--items", JSON.stringify(items.slice(i, i + 20)), "--content-origin", "user_said", "--json"]);
  }
}

export async function createGbrainMemory(): Promise<MemoryStore> {
  await loadRun();
  let cache: MemoryFact[] | null = null;
  const load = async () => (cache ??= (await fetchAll()).map(decode).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)));

  if ((await load()).length === 0) {
    await seed();
    cache = null;
    await load();
  }

  const newest = async (text: string) => {
    cache = null;
    const facts = await load();
    return [...facts].reverse().find((f) => f.text === text) ?? facts[facts.length - 1];
  };

  return {
    backend: "gbrain",
    async remember({ text, category = "taught", source = "grandma", provenance, at }) {
      const prov = provenance ?? `${source}: ${new Date().toISOString()}`;
      const args = ["remember", encode(text, category), "--entity", ENTITY, "--provenance", prov, "--content-origin", "user_said", "--json"];
      if (at) args.push("--valid-from", at);
      const out = JSON.parse(await gb(args)) as { id?: string };
      // Write-through to JSON so the demo survives if GBrain breaks mid-run.
      void jsonMemory.remember({ text, category, source, provenance: prov, at }).catch(() => undefined);
      if (!out.id) return newest(text);
      const fact: MemoryFact = { id: `gbrain-${out.id}`, text, category, source, at: at ?? new Date().toISOString(), provenance: prov };
      (await load()).push(fact);
      return fact;
    },
    async correct(id, text, provenance) {
      const old = (await load()).find((f) => f.id === id);
      if (!old) return null;
      const prov = provenance ?? `grandma correction: ${new Date().toISOString()}`;
      await gb(["remember", encode(text, old.category), "--entity", ENTITY, "--provenance", prov, "--replaces", rawId(id), "--content-origin", "user_said", "--json"]);
      return newest(text);
    },
    async forget(id) {
      if (!(await load()).some((f) => f.id === id)) return false;
      await gb(["forget", rawId(id)]);
      cache = null;
      return true;
    },
    async recall(query, limit = 6) {
      return rankFacts(await load(), query, limit);
    },
    async all() {
      return [...(await load())];
    },
  };
}

// Demo reset: start a new run entity and seed it. Nothing is forgotten.
export async function resetGbrainMemory() {
  await loadRun();
  const n = Number(ENTITY.match(/(\d+)$/)?.[1] ?? 1) + 1;
  ENTITY = `grandma-run-${n}`;
  await fs.writeFile(RUN_FILE, JSON.stringify({ entity: ENTITY }));
  await seed();
}
