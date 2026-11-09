import type { MemoryFact } from "./types";

// Tiny Korean-friendly scorer: whole tokens plus 2-char shingles so particles
// ("임영웅은", "병원에") still match the stored fact.
function shingles(s: string): Set<string> {
  const out = new Set<string>();
  for (const tok of s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
    out.add(tok);
    for (let i = 0; i + 2 <= tok.length; i++) out.add(tok.slice(i, i + 2));
  }
  return out;
}

export function rankFacts(facts: MemoryFact[], query: string, limit = 6): MemoryFact[] {
  const q = shingles(query);
  if (q.size === 0) return facts.slice(-limit);
  return facts
    .map((f) => {
      const t = shingles(f.text + " " + f.category);
      let score = 0;
      for (const s of q) if (t.has(s)) score += s.length;
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.f);
}
