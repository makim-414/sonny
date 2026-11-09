# GBrain usage log (agent brain)

How the TV agent's long-term memory runs on [GBrain](https://github.com/garrytan/gbrain) during c0mpiled-17 Seoul (2026-11-09). Times are KST from the system clock. Code: `src/lib/memory/gbrain-store.ts`.

## What GBrain does in the product

Grandma teaches the TV, and every fact she teaches becomes a GBrain fact with provenance.

| Product moment | GBrain feature used | Command (through the CLI) |
|---|---|---|
| "내 손주 이름은 민수야" (my grandson's name is Minsu) | `remember` a fact on one entity, with provenance (who taught it, when) and `valid_from` | `gbrain remember "[family] 손주 이름은 민수다" --entity grandma-run-N --provenance "할머니가 TV 대화에서 가르침, <ISO>" --valid-from <ISO> --content-origin user_said` |
| Next morning the TV opens with "민수는 학교 잘 다녀왔대요?" | `recall` of the entity's live facts, ranked locally | `gbrain recall grandma-run-N --json` |
| Kimchi brining tip, counted as "이번 달 할머니께 배운 것 31개" | lessons are facts tagged `[lesson]`; 30 seeded lessons carry their own `valid_from` dates this month | `gbrain remember --items '[...]'` (20 per batch) |
| "아니 화요일 말고 수요일이야" (not Tuesday, Wednesday) | correction: the new fact supersedes the old one, and both stay in the record | `gbrain remember "<new fact>" --replaces <fact_id>` |
| Demo reset | new run entity, nothing forgotten (see the finding below) | `remember --items` into `grandma-run-N+1` |

The brain is keyless: `gbrain init --pglite --no-embedding`. Search is keyword-only, and no text leaves the machine through GBrain. The Anthropic key is removed from the GBrain child process environment on purpose, so GBrain never calls a model.

## Log

| Time | Step | Result |
|---|---|---|
| 10:23 | Read `INSTALL_FOR_AGENTS.md` in the vendored GBrain (0.60.619.0) | Needs Bun 1.4.4+. The machine has Bun 1.3.10, so a private Bun 1.4.4 was unpacked to `~/.hyodo-tv/bun` and the global one was left alone. |
| 10:24 | `bun install` in the vendored repo, then `gbrain init --pglite --no-embedding` with `GBRAIN_HOME=~/.hyodo-tv/gbrain-home` | 291 migrations applied. Init stopped with `local_conflict`, because the home folder is itself a git repo. Rerun with `--git` gave the content folder its own repo. |
| 10:24 | `gbrain apply-migrations --yes --no-autopilot-install` | Setup migrations done. |
| 10:25 | Tried `remember`, `recall --json`, `forget` | About 0.4 to 0.5 s per CLI call. `recall` returns the entity's facts with `valid_from`, `source` (provenance) and `superseded_by`. |
| 10:26 | Adapter `gbrain-store.ts` behind the same `MemoryStore` interface as the JSON file | GBrain is the default backend. JSON is the safety net: writes go to both, and the agent falls back to JSON if GBrain fails at startup. |
| 10:36 | Checked `--items` with `valid_from` and `--replaces` on a scratch brain | Both work. A superseded fact drops out of `recall` and points to its replacement. |
| 10:41 | Finding: after a demo reset that used `forget`, saving the same sentence again failed (exit 2) | GBrain refuses to re-remember a withdrawn claim ("this exact claim was explicitly forgotten"). That is a sound rule for a real brain. The demo reset now starts a new entity `grandma-run-N` and seeds it, so nothing is forgotten and every run stays on record. |
| 10:41 | CLI calls queued in-process, one retry | PGLite allows a single writer, so calls never overlap. |
| 10:45 | Read the gstack `setup-gbrain` skill (`~/.claude/skills/gstack/setup-gbrain/SKILL.md`) | Followed its PGLite path for the product brain: install the CLI, init the PGLite brain, run doctor. Skipped two steps on purpose: registering GBrain as an MCP server for Claude Code (step 5a) and writing a GBrain block into CLAUDE.md (step 8). Both change the owner's own agent setup, not the product, so they are left for the owner. |
| 10:52 | `gbrain doctor --fast --json` | Memory checks (`memory_verbs_usage`, `memory_writeback`, `memorable_relay_health`, `bun_runtime`) ok. The overall status is `unhealthy` because of the skill and resolver checks, which are about a coding agent's skill folder and do not affect the brain. |
| 10:58 | Scenario run, see [agent-scenarios.md](../agent-scenarios.md) | In run `grandma-run-9` GBrain holds facts #383 (grandson Minsu, personal), #384 (kimchi brining, lesson) and #385 (temple on Wednesday and Friday, a correction that supersedes the seed fact). Each one carries its provenance. |

| 11:00 | English demo (`APP_LANG = "en"`) | One run file per language (`hyodo-run-en.json`), entity `grandma-en-run-N`, 39 English seed facts (30 lessons). English and Korean demos never share facts. |
| 11:04 | Scenario run in English, see [agent-scenarios.md](../agent-scenarios.md) | In `grandma-en-run-9`: fact #898 "Grandson's name is Max" (personal, private) and #899 "bingo every Wednesday and Friday", which supersedes the seed fact "Tuesday and Friday" through `--replaces`. Both carry provenance ("June taught this in a talk with Sonny, <ISO>" / "June corrected this, <ISO>"). |
| 11:07 | Finding: GBrain answers an exact repeat with `status: "duplicate"` ("already knew this, kept fact #868") and the old id | The adapter now reports it as already known, the lesson counter does not move, and Sonny says she taught it before. |

| 11:53 | "Teach him how to do it": procedures as GBrain facts | A taught procedure is a fact of category `skill`, kept readable in the brain, for example "Sunday groceries (errand): milk; a dozen eggs; the small rye bread; store: Green Market", with provenance and `valid_from`. Sonny later repeats it step by step. "No, the big rye now" is stored as a `--replaces` correction ("June corrected this, <ISO>"), so the brain keeps both what she taught and how she changed it. |

## Limits we know about

- Keyword-only recall: no embeddings, so near-duplicate phrasings are not merged (GBrain reports `degraded_dedup`). We rank the entity's facts locally with a small Korean-aware scorer.
- The adapter shells out to the CLI, about 0.4 s per call. Facts are cached in memory, so a normal turn makes no GBrain call. Only remember, correct and reset touch the CLI.
- Not built yet (only if time allows): a family-side "엄마 오늘 어땠어?" path over GBrain MCP (`gbrain serve`).
