import type { ActivityEvent } from "@/lib/types";
import { effectiveVisibility } from "@/lib/memory/privacy";

// What mom's phone is allowed to see. Redaction happens here on the server,
// so private words never leave the machine, not even in the network panel.
//   visibility "family"  -> shown as-is (tasks, rides, orders, medicine, safety)
//   visibility "summary" -> only familyText is shown; hidden if there is none
//   visibility "private" -> hidden, only counted
// Events without a visibility: grandma's raw talk ("heard", "said") counts as private,
// everything else counts as "family".
export type FamilyView = { events: ActivityEvent[]; hiddenCount: number };

// The agent echoes inbox items as "엄마 → TV: ..."; our own route already logged them.
const INBOX_ECHO = /^\S+\s*(→|->)\s*TV:/;
// Agent bookkeeping that means nothing to mom: memory lookups and brain errors.
const NOISE = /^(기억 찾기|기억 꺼냄)|두뇌 오류|brain error/i;

export function familyView(events: ActivityEvent[]): FamilyView {
  const out: ActivityEvent[] = [];
  let hiddenCount = 0;
  for (const e of events) {
    if (e.kind === "family" && INBOX_ECHO.test(e.text)) continue;
    if ((e.kind === "memory" || e.kind === "alert") && NOISE.test(e.text)) continue;
    const v = effectiveVisibility(e);
    if (v === "private") {
      hiddenCount++;
      continue;
    }
    if (v === "summary") {
      if (!e.familyText) {
        hiddenCount++;
        continue;
      }
      out.push({ id: e.id, at: e.at, kind: e.kind, text: e.familyText, visibility: "summary" });
      continue;
    }
    out.push({ id: e.id, at: e.at, kind: e.kind, text: e.familyText ?? e.text, visibility: "family" });
  }
  return { events: out, hiddenCount };
}
