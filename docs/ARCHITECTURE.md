# Hyodo TV architecture

An agent that lives inside grandma's TV. It listens, speaks first, remembers, and acts on the TV and toward the family.
Changing channels is one tool, not the product.

## Surfaces

| Route | Who uses it | What it does |
|---|---|---|
| `/tv` | Grandma, full screen on the TV (laptop on HDMI for the demo) | Virtual TV with channels, big captions, voice in and out, remote keys only (arrows, OK, mic) |
| `/family` | Mom, on her phone | Live activity feed, alerts, send a message or command to the TV |
| `POST /api/agent` | The TV | `AgentRequest` in, `AgentReply` out (see `src/lib/types.ts`) |
| `GET /api/events` | Family app | Activity log |
| `POST /api/family` | Family app | Mom sends a message or a command to the TV (goes into `store.tvInbox`) |
| `GET /api/family/inbox` | The TV | TV polls every 3 s, takes and clears `store.tvInbox`, then sends each item to `/api/agent` with `source: "family"` |

Scheduling runs on the TV side: when the agent returns a `schedule` action, the TV keeps the timer against its own demo clock (which can fast-forward) and runs the inner action when due.
Every route that does something writes one line with `logEvent` so the family feed shows it.

Dev ports: TV screen session 3101, agent brain session 3102, family session 3103, integration 3000.

## Agent tools (inside `src/lib/agent`)

- `epg.search(query, now)`: find programs by person or title across about 220 channels (seed data in `src/lib/epg`)
- `tv.tune(channel)`
- `schedule.at(time, action)`: tune later, remind later
- `memory.recall(query)` / `memory.remember(fact)`: long-term memory about grandma (GBrain, keyless PGLite; JSON fallback)
- `family.notify(message, level)`

The model is Claude via `@ai-sdk/anthropic` (`ANTHROPIC_API_KEY`).
Voice uses the browser (Web Speech API `ko-KR` for listening, `speechSynthesis` for speaking) so the demo needs no extra keys.

## Ownership (one writer per folder)

| Folder | Owner |
|---|---|
| `src/app/tv/**`, `src/components/tv/**`, `src/lib/voice/**` | TV screen session |
| `src/app/api/agent/**`, `src/lib/agent/**`, `src/lib/epg/**`, `src/lib/memory/**`, `src/lib/scheduler/**` | Agent brain session |
| `src/app/family/**`, `src/app/api/family/**`, `src/app/api/events/**`, `docs/pitch/**` | Family app and pitch session |
| `src/lib/types.ts`, `src/lib/store.ts`, `docs/ARCHITECTURE.md` | Integration (main) session |

## Demo story (90 seconds)

1. Grandma: "임영웅 틀어줘". TV: not on now, TV조선 in 30 minutes, I will turn it on then.
2. Clock fast-forwards. The TV tunes itself.
3. Mom's phone: grandma is watching, all good.
4. Next morning the TV speaks first: "오늘 8시에 임영웅 나와요. 약은 드셨어요?" (memory)
5. Close: today a file on the TV, next the TV itself.
