// Long-term memory about grandma. Two backends share this interface:
// GBrain on keyless PGLite (default) and a JSON file (safety net).

export type MemoryCategory =
  | "lesson" // wisdom she teaches that helps others too (recipes, remedies, local tips)
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
  at: string; // ISO time it was learned (valid_from in GBrain)
  provenance?: string; // who taught it, when, where
};

// Shared write counter. The admin's server actions and the agent's route can load
// separate module copies, so every store re-reads when another copy wrote.
// One counter per backend, so the JSON write-through does not make GBrain re-read.
const G = globalThis as unknown as Record<string, number | undefined>;
export const memVersion = (key = "gbrain") => (G[`__hyodoMemVersion_${key}`] ??= 0);
export const bumpMemVersion = (key = "gbrain") => (G[`__hyodoMemVersion_${key}`] = memVersion(key) + 1);

export const isLesson = (f: Pick<MemoryFact, "category">) => f.category === "lesson";

export interface MemoryStore {
  readonly backend: "json" | "gbrain";
  /** `duplicate` is true when the exact fact was already known (GBrain status "duplicate"). */
  remember(input: {
    text: string;
    category?: MemoryCategory;
    source?: MemoryFact["source"];
    provenance?: string;
    at?: string;
  }): Promise<MemoryFact & { duplicate?: boolean }>;
  /** Record a correction: the new fact replaces the old one (GBrain `--replaces`). */
  correct(id: string, text: string, provenance?: string): Promise<MemoryFact | null>;
  /** Withdraw a fact (GBrain `forget`). */
  forget(id: string): Promise<boolean>;
  recall(query: string, limit?: number): Promise<MemoryFact[]>;
  all(): Promise<MemoryFact[]>;
}
