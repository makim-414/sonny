import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { jsonMemory } from "./json-store";
import { SEED_FACTS } from "./seed";
import { rankFacts } from "./search";
import type { MemoryCategory, MemoryFact, MemoryStore } from "./types";

// GBrain (github.com/garrytan/gbrain) on keyless local PGLite, driven through its CLI.
// One entity "grandma" holds every fact. Keyword-only: no embedding or LLM calls,
// so the Anthropic key is stripped from the child env on purpose.
const execFileP = promisify(execFile);

const HOME = os.homedir();
const BUN = process.env.HYODO_GBRAIN_BUN ?? path.join(HOME, ".hyodo-tv/bun/bun-darwin-aarch64/bun");
const CLI = process.env.HYODO_GBRAIN_CLI ?? "/Users/makim/_sessions/c0mpiled-17/vendor/gbrain/src/cli.ts";
const GBRAIN_HOME = process.env.GBRAIN_HOME ?? path.join(HOME, ".hyodo-tv/gbrain-home");
const ENTITY = "grandma";

type GbFact = { id: number; fact: string; kind: string; source: string | null; created_at: string; expired_at: string | null };

async function gb(args: string[]): Promise<string> {
  const env: NodeJS.ProcessEnv = { ...process.env, GBRAIN_HOME };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_BASE_URL;
  const { stdout } = await execFileP(BUN, [CLI, ...args], { cwd: GBRAIN_HOME, env, timeout: 15_000, maxBuffer: 8 << 20 });
  return stdout;
}

// "[category] text" keeps our category inside GBrain's plain fact string.
const encode = (text: string, category: MemoryCategory) => `[${category}] ${text}`;
function decode(f: GbFact): MemoryFact {
  const m = f.fact.match(/^\[(\w+)\]\s*([\s\S]*)$/);
  const src = f.source === "seed" || f.source === "family" || f.source === "agent" ? f.source : "grandma";
  return {
    id: `gbrain-${f.id}`,
    text: m ? m[2] : f.fact,
    category: (m ? m[1] : "other") as MemoryCategory,
    source: src,
    at: f.created_at,
  };
}

export async function createGbrainMemory(): Promise<MemoryStore> {
  let cache: MemoryFact[] | null = null;

  async function load(): Promise<MemoryFact[]> {
    if (cache) return cache;
    const out = JSON.parse(await gb(["recall", ENTITY, "--limit", "200", "--json"])) as { facts: GbFact[] };
    cache = out.facts.filter((f) => !f.expired_at).map(decode).reverse(); // oldest first
    return cache;
  }

  // Seed an empty brain once.
  if ((await load()).length === 0) {
    const items = SEED_FACTS.map((f) => ({ fact: encode(f.text, f.category), entity: ENTITY, provenance: "seed" }));
    await gb(["remember", "--items", JSON.stringify(items), "--content-origin", "user_said", "--json"]);
    cache = null;
    await load();
  }

  return {
    backend: "gbrain",
    async remember({ text, category = "taught", source = "grandma" }) {
      await gb(["remember", encode(text, category), "--entity", ENTITY, "--provenance", source, "--content-origin", "user_said", "--json"]);
      // Write-through to JSON so the demo survives if GBrain breaks mid-run.
      await jsonMemory.remember({ text, category, source }).catch(() => undefined);
      cache = null;
      const facts = await load();
      return facts[facts.length - 1];
    },
    async recall(query, limit = 6) {
      return rankFacts(await load(), query, limit);
    },
    async all() {
      return [...(await load())];
    },
  };
}

// Demo reset: withdraw every non-seed fact.
export async function resetGbrainMemory() {
  const out = JSON.parse(await gb(["recall", ENTITY, "--limit", "200", "--json"])) as { facts: GbFact[] };
  for (const f of out.facts) if (f.source !== "seed" && !f.expired_at) await gb(["forget", String(f.id)]);
}
