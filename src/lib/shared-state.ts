import { after } from "next/server";

// Shared state across serverless instances.
// Locally every request lands in one Node process, so the globalThis objects below are the
// whole truth. On Vercel, grandma's phone and mom's phone can hit different instances, so
// each request first pulls the latest copy from Redis (Upstash REST) and, after it is done,
// pushes back only the slots it changed. Without KV_REST_API_URL/TOKEN nothing changes.

// Every globalThis slot that holds demo state. Each module creates its slot on first import.
const SLOTS = [
  "__hyodoStore",
  "__hyodoFamily",
  "__sonnyWellness",
  "__sonnyWatch",
  "__sonnyConnections",
  "__hyodoSession",
  "__hyodoAgent",
] as const;

const PREFIX = "sonny:state:";
const VERSION_KEY = "sonny:state:version";

const URL_ = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;
export const sharedEnabled = () => Boolean(URL_ && TOKEN);

type Bag = Record<string, unknown>;
const G = globalThis as unknown as Bag & {
  __sonnyShared?: { version: number; baseline: Record<string, string> };
};
const meta = (G.__sonnyShared ??= { version: -1, baseline: {} });

/** Upstash REST pipeline: [["GET","k"], ...] -> results. */
export async function redis(commands: (string | number)[][]): Promise<unknown[]> {
  const res = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  const out = (await res.json()) as { result?: unknown; error?: string }[];
  return out.map((r) => {
    if (r.error) throw new Error(`redis: ${r.error}`);
    return r.result;
  });
}

const snap = (slot: string) => (G[slot] === undefined ? undefined : JSON.stringify(G[slot]));

/** Replace a slot's contents in place, so modules holding a reference keep seeing it. */
function apply(slot: string, value: unknown) {
  const cur = G[slot];
  if (Array.isArray(cur) && Array.isArray(value)) {
    cur.length = 0;
    cur.push(...value);
  } else if (cur && typeof cur === "object" && value && typeof value === "object" && !Array.isArray(value)) {
    for (const k of Object.keys(cur)) delete (cur as Bag)[k];
    Object.assign(cur, value);
  } else {
    G[slot] = value;
  }
}

function dirtySlots(): string[] {
  return SLOTS.filter((s) => {
    const now = snap(s);
    return now !== undefined && now !== meta.baseline[s];
  });
}

/** Push changed slots to Redis. */
export async function persistShared() {
  // Never write before this instance has read the shared copy once, or its seed would win.
  if (!sharedEnabled() || meta.version < 0) return;
  const dirty = dirtySlots();
  if (!dirty.length) return;
  const values = dirty.map((s) => snap(s) as string);
  const out = await redis([...dirty.map((s, i) => ["SET", PREFIX + s, values[i]]), ["INCR", VERSION_KEY]]);
  dirty.forEach((s, i) => (meta.baseline[s] = values[i]));
  meta.version = Number(out[out.length - 1]);
}

/**
 * Call first in every route handler and server action that touches demo state.
 * Pulls newer state from Redis and schedules a write-back once the response is sent.
 */
export async function syncShared() {
  if (!sharedEnabled()) return;
  try {
    after(() => persistShared().catch((err) => console.error("[shared] persist failed", err)));
  } catch {
    // Outside a request scope (scripts): the caller persists itself.
  }
  try {
    const [ver] = await redis([["GET", VERSION_KEY]]);
    const version = Number(ver ?? 0);
    if (version === meta.version) return;
    // Local changes not yet written win over the remote copy for that slot. A fresh
    // instance has nothing of its own yet, so it takes every slot from Redis.
    const dirty = new Set(meta.version < 0 ? [] : dirtySlots());
    const pull = SLOTS.filter((s) => !dirty.has(s));
    const values = pull.length ? await redis(pull.map((s) => ["GET", PREFIX + s])) : [];
    pull.forEach((s, i) => {
      const raw = values[i];
      if (typeof raw !== "string") {
        // Nothing stored yet: this instance's seed becomes the first shared copy.
        meta.baseline[s] = "";
        return;
      }
      apply(s, JSON.parse(raw));
      meta.baseline[s] = raw;
    });
    meta.version = version;
  } catch (err) {
    console.error("[shared] sync failed, using this instance's copy", err);
  }
}

/** Demo reset: wipe the shared copy so the next request reseeds it. */
export async function clearShared() {
  if (!sharedEnabled()) return;
  await redis([...SLOTS.map((s) => ["DEL", PREFIX + s]), ["INCR", VERSION_KEY]]).catch(() => null);
  meta.baseline = {};
}
