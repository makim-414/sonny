// Family privacy tiers, dependency-free so any GBrain-backed app can reuse it.
// See docs/gbrain/family-privacy-memory.md.
//   "family"  -> shown as-is
//   "summary" -> only familyText is shown; hidden if there is none
//   "private" -> hidden, only counted
export type Visibility = "family" | "summary" | "private";

export type TieredItem = { kind: string; text: string; visibility?: Visibility; familyText?: string };

/** Raw talk kinds default to private (or summary when a family line exists); everything else to family. */
export function effectiveVisibility(e: TieredItem, rawKinds: readonly string[] = ["heard", "said"]): Visibility {
  if (e.visibility) return e.visibility;
  if (rawKinds.includes(e.kind)) return e.familyText ? "summary" : "private";
  return "family";
}

/** The text a family member may see, or null when the item must stay hidden. */
export function familyTextFor(e: TieredItem, rawKinds?: readonly string[]): string | null {
  const v = effectiveVisibility(e, rawKinds);
  if (v === "private") return null;
  if (v === "summary") return e.familyText ?? null;
  return e.familyText ?? e.text;
}
