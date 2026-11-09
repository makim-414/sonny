# Recipe: family privacy-tiered memory on GBrain

A reusable pattern from Sonny for any agent that remembers one person and reports to that person's family.

## Problem

GBrain holds everything grandma says and teaches, with provenance. Her family needs to know what got done and whether she is okay, but not what she said. A client-side filter is not enough: anything sent to the browser can be read in the network panel.

## Data shape

Two layers.

1. **GBrain facts** (long-term memory). One entity per person and run (`grandma-run-N`, `grandma-en-run-N`). Each fact is a plain string with a category prefix, `"[lesson] ..."`, `"[skill] ..."`, `"[health] ..."`, `"[family] ..."`, plus `--provenance` (who taught it, when) and `--content-origin user_said`. Corrections use `--replaces`, so the old and new fact both stay on record.
2. **Activity events** (what happened today). Each event carries a privacy tier:

| Field | Values | Meaning |
|---|---|---|
| `visibility` | `family` | shown to the family as-is (tasks, rides, orders, medicine, safety) |
| | `summary` | only `familyText` is shown; hidden if there is none |
| | `private` | never shown, only counted |
| `familyText` | string | a one-line, family-safe rewrite written by the agent at the moment it acts |

Default when `visibility` is missing: raw talk (`heard`, `said`) is `summary` if it has a `familyText`, otherwise `private`. Everything else is `family`.

## Server-side redaction rules

1. Redact on the server, in the route that serves the family app. The raw event never leaves the machine.
2. `private` items are dropped and only a `hiddenCount` is returned, so the family knows Sonny talked with her without seeing what was said.
3. `summary` items return `familyText` only, never `text`.
4. Bookkeeping noise (memory lookups, brain errors, echoes of the family's own messages) is filtered out in every language.
5. A fact the person marks as personal is stored in GBrain but logged as `private` in the activity feed.

## How to use it

```ts
import { familyTextFor } from "@/lib/memory/privacy";

const visible = events.flatMap((e) => {
  const t = familyTextFor(e);
  return t === null ? [] : [{ ...e, text: t, familyText: undefined }];
});
```

The module has no dependencies, so it can be copied into any project that stores memory in GBrain.

## Where it lives in Sonny

| Piece | File |
|---|---|
| Reusable tier helpers | [`src/lib/memory/privacy.ts`](../../src/lib/memory/privacy.ts) |
| Family feed redaction | [`src/app/api/family/view.ts`](../../src/app/api/family/view.ts) |
| Agent writes `visibility` and `familyText` per turn | [`src/lib/agent/run.ts`](../../src/lib/agent/run.ts) |
| Family-safe line for a new skill | [`src/lib/agent/connections.ts`](../../src/lib/agent/connections.ts) |
| GBrain adapter (entities, provenance, `--replaces`, run reset) | [`src/lib/memory/gbrain-store.ts`](../../src/lib/memory/gbrain-store.ts) |
| Memory categories | [`src/lib/memory/types.ts`](../../src/lib/memory/types.ts) |
