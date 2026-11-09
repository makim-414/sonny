import type { MemoryFact } from "@/lib/memory";

// "Teach him how to do it": procedures grandma teaches by voice, stored in GBrain as
// plain, readable facts of category "skill", so the brain shows what she taught:
//   Sunday groceries (errand): milk; a dozen eggs; the small rye bread; store: Green Market
//   call Martha (message): to: Martha; say: I'm fine; ask: how is her knee

export type SkillAction = "errand" | "message" | "other";
export type Skill = { id: string; name: string; action: SkillAction; steps: string[]; at: string; provenance?: string };

export function encodeSkill(name: string, action: SkillAction, steps: string[]): string {
  return `${name.trim()} (${action}): ${steps.map((s) => s.trim().replace(/;/g, ",")).filter(Boolean).join("; ")}`;
}

export function parseSkill(f: MemoryFact): Skill | null {
  const m = f.text.match(/^(.+?) \((errand|message|other)\): (.+)$/);
  if (!m) return null;
  return { id: f.id, name: m[1], action: m[2] as SkillAction, steps: m[3].split(/;\s*/).filter(Boolean), at: f.at, provenance: f.provenance };
}

export function skillsOf(facts: MemoryFact[]): Skill[] {
  return facts.filter((f) => f.category === "skill").map(parseSkill).filter((s): s is Skill => !!s);
}

const STOP = ["the", "and", "for", "my", "your", "how", "do", "please", "call", "send", "get", "make", "run", "can", "you", "now", "some"];
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.includes(w));

/** The skill whose name best matches what she said (at least one real word in common). */
/** strict: every real word of the skill name must be heard (used to force a run). */
export function findSkill(skills: Skill[], said: string, strict = false): Skill | null {
  const heard = new Set(words(said));
  let best: { s: Skill; score: number } | null = null;
  for (const s of skills) {
    const nameWords = words(s.name);
    const score = nameWords.filter((w) => heard.has(w)).length;
    if (strict && score < nameWords.length) continue;
    if (score > 0 && (!best || score > best.score || (score === best.score && s.at > best.s.at))) best = { s, score };
  }
  return best?.s ?? null;
}

/** Split errand steps into items and the store ("store: Green Market"). */
export function errandParts(s: Skill): { items: { name: string; qty?: number }[]; store?: string } {
  let store: string | undefined;
  const items: { name: string; qty?: number }[] = [];
  for (const step of s.steps) {
    const st = step.match(/^(?:store|shop|from|always from)\s*:?\s*(.+)$/i);
    if (st) {
      store = st[1].trim();
      continue;
    }
    const q = step.match(/^(\d+)\s+(.+)$/);
    items.push(q ? { name: q[2], qty: Number(q[1]) } : { name: step });
  }
  return { items, store };
}

/** Message skills: "to: Martha; say: ...; ask: ..." */
export function messageParts(s: Skill): { to: string; text: string } {
  let to = "a friend";
  const lines: string[] = [];
  for (const step of s.steps) {
    const m = step.match(/^(to|say|ask)\s*:\s*(.+)$/i);
    if (!m) {
      lines.push(step);
      continue;
    }
    if (m[1].toLowerCase() === "to") to = m[2].trim();
    else lines.push(m[1].toLowerCase() === "ask" ? `${m[2].trim().replace(/\?*$/, "")}?` : m[2].trim());
  }
  return { to, text: lines.join(" ") };
}
