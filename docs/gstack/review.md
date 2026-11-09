# gstack /review: build branch at the feature freeze

Run log: gstack `/review` v1.98.0.0, invoked through the Skill tool, 2026-11-09 about 12:19 to 12:25 KST. Telemetry: off.
Candidate: `build` at `9e1ba63`, merged into `gstack-usage`. Mode: report only. Fixes belong to the owning sessions, so this run edited no code (Step 5 fixes skipped on purpose).
Base: the repo has no `main` (origin HEAD is `build`), so the whole app since the first commit `15c2448` was reviewed.

## Pre-Landing Review: 13 issues (8 critical, 5 informational). INCOMPLETE: exploratory QA (Step 4.7) not run, see coverage.

Reviewers: core checklist pass, 3 specialists (server correctness, client correctness, security) and the native adversarial pass. Every finding below was spot-checked against the source before it was reported.

### CRITICAL (demo-breaking)
| # | Conf. | Where | Problem | Smallest mitigation |
|---|---|---|---|---|
| 1 | 8/10 | `src/components/tv/agent-client.ts:22`, `src/lib/agent/run.ts:558` | No timeout on the TV fetch or on `generateText`. A slow Anthropic call freezes the TV, and the serial queue (`TvApp.tsx:350`) blocks every later job. The mock fallback runs only on reject. | Client AbortSignal (about 12 s) that falls back to `mockAgent`. |
| 2 | 8/10 | `src/app/api/family/inbox/route.ts:7` | `splice` empties the inbox on read, and both `TvApp.tsx:540` and `OrbApp.tsx:673` poll it. A second open tab, or a dropped response, loses the daughter's approval. | Open one inbox reader during the demo. |
| 3 | 7/10 | `src/components/family/FamilyApp.tsx:107`, `src/app/api/family/route.ts:41` | Approve re-enables before refresh, and the server pushes to the TV inbox on every press. A double tap approves twice. | Skip the push when the id is already in `approvedIds`. |
| 4 | 7/10 | `src/components/family/IncomingCall.tsx:194`, `src/components/family/strings.ts:171` | Yes is tested before no, on interim results, and `approve` is a yes word. "No, don't approve" approves. | Test no first; act on final results only. |
| 5 | 7/10 | `src/components/tv/TvApp.tsx:559` | Speech unlocks only after a key or click on the TV tab. After a reload the TV answers with captions only. | Click the TV tab once after every reload. |
| 6 | 7/10 | `src/app/api/agent/route.ts:18` | `x-hyodo-model` lets any visitor pick any `claude-*` model; no text length or rate limit. Uncapped spend from a public QR URL. | Remove the override; set a spend cap in the Anthropic console. |
| 7 | 9/10 | `src/proxy.ts:60` | `?demo=1` signs any visitor in as the demo guardian or device, which opens `/admin`, the family feed and `/api/agent/reset`. Intended for judges, but anyone with the URL can wipe a live run. | Accept for today; rotate the tunnel URL after the event. |
| 8 | 6/10 | `src/lib/agent/run.ts:468`, `src/lib/agent/tools.ts:148` | Check against the script: the suggested dinner order (about $17) is under the per-purchase limit, so it pays at once and the daughter's phone does not ring. Only over-limit spends call her. | If the script needs the call, use an over-limit order or ride. |

### INFORMATIONAL
| # | Conf. | Where | Problem |
|---|---|---|---|
| 9 | 8/10 | `src/lib/agent/run.ts:625`, `src/app/api/family/view.ts:21` | The English "brain error: ..." text reaches the daughter's feed; the noise filter matches only the Korean string. |
| 10 | 6/10 | `src/lib/auth/session.ts:6` | `AUTH_SECRET` falls back to a source constant. Confirm the deployed environment sets it. |
| 11 | 6/10 | `src/lib/agent/tools.ts:177`, `src/lib/agent/run.ts:592` | On a retry after a thrown tool, `ctx.once` is not reset, so `memory_remember` returns AGAIN and the fact is never stored while the model says it was. |
| 12 | 5/10 | `src/components/family/IncomingCall.tsx:81` | `play()` runs after an awaited fetch; iOS Safari may block it with no speech fallback. Buttons still work. |
| 13 | 6/10 | reset route vs TV client | Reset clears only server state; the TV demo clock, timers and queue stay. Reload the TV after a reset. |

## Secrets
- No key, token or private key string in tracked files or in the history of 237 commits (regex scan for `sk-ant`, `AKIA`, `ghp_`, `xox*`, `AIza`, PEM, URL credentials). The only hit is the Keychain lookup in `package.json`, which reads the key at run time.
- No `.env` file is tracked (`.gitignore` has `.env*`).
- No server secret reaches the client: no `NEXT_PUBLIC_*`, and no `"use client"` file imports agent, auth or memory modules.
- Seed people and addresses are marked fake (`src/lib/memory/seed.ts`). The demo login and PIN fallback are in source on purpose and listed in the README.

## Gate edits
Gate edits: 11 listed, 11 read, 0 findings. Every hunk is a newly added file (RH-16) or the package.json scripts hunk (RH-15?). The repo has no tests or CI, so no gate was relaxed. Unlisted idioms: none.

## Exploratory QA and Verification Results
| Check | Outcome |
|---|---|
| Typecheck (`tsc --noEmit` in the main checkout at `9e1ba63`) | no errors printed |
| Smoke probes in a browser (Step 4.7) | not run: report-only run against a 13:00 deadline, and the dev server is owned by the main session |
| Repro of the findings above | not run: all findings come from static reading, then a source spot-check |

Coverage gaps: no runtime repro, deployed environment variables not checked, `docs/pitch` images not checked for personal data, dependency CVEs not checked.
