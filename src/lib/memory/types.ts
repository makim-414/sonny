// Long-term memory about grandma. Two backends share this interface:
// a JSON file (always works) and GBrain on keyless PGLite (judge-facing signal).

export type MemoryCategory =
  | "likes"
  | "routine"
  | "health"
  | "family"
  | "place"
  | "taught"
  | "other";

export type MemoryFact = {
  id: string;
  text: string; // one fact in plain Korean, e.g. "임영웅을 아주 좋아하신다"
  category: MemoryCategory;
  source: "seed" | "grandma" | "family" | "agent";
  at: string; // ISO time it was learned
};

export interface MemoryStore {
  readonly backend: "json" | "gbrain";
  remember(input: { text: string; category?: MemoryCategory; source?: MemoryFact["source"] }): Promise<MemoryFact>;
  recall(query: string, limit?: number): Promise<MemoryFact[]>;
  all(): Promise<MemoryFact[]>;
}
