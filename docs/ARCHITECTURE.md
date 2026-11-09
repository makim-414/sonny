# Hyodo TV architecture

A full AI assistant that lives inside grandma's TV. It talks, speaks first, remembers, keeps her schedule, reads her the world, and keeps the family in the loop.
Its character is a student that grandma teaches: what she teaches it becomes its long-term memory.
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

- `memory.recall(query)` / `memory.remember(fact)`: long-term memory about grandma, filled mostly by grandma teaching it (GBrain, keyless PGLite; JSON fallback)
- `schedule.at(time, action)`: reminders and routines (medicine, temple days, shows), proactive check-ins
- `family.notify(message, level)` / family inbox: pass messages and requests both ways, raise alerts
- `info.weather`, `info.news`: read the world to her in plain words (seed or live)
- `tv.show(card)`: put photos, text, family video messages on the big screen
- `ride.request(from, to, when)`: call a taxi for her (real case: mom booked a Kakao T taxi from home to the hospital for grandma this morning). Demo uses a mock ride service; the family gets an approval or a heads-up, and the TV shows the car, plate and arrival time in big text
- `epg.search(query, now)` and `tv.tune(channel)`: find and switch to a show (one tool among many)

The model is Claude via `@ai-sdk/anthropic`. `pnpm dev` and `pnpm start` read `ANTHROPIC_API_KEY` from the macOS keychain item `anthropic-hackathon-key`, so no key lives in files. Do not put the key in `.env` files or code.
Voice uses the browser (Web Speech API `ko-KR` for listening, `speechSynthesis` for speaking) so the demo needs no extra keys.

## Ownership (one writer per folder)

| Folder | Owner |
|---|---|
| `src/app/tv/**`, `src/components/tv/**`, `src/lib/voice/**` | TV screen session |
| `src/app/api/agent/**`, `src/lib/agent/**`, `src/lib/epg/**`, `src/lib/memory/**`, `src/lib/scheduler/**` | Agent brain session |
| `src/app/family/**`, `src/app/api/family/**`, `src/app/api/events/**`, `docs/pitch/**` | Family app and pitch session |
| `src/lib/types.ts`, `src/lib/store.ts`, `docs/ARCHITECTURE.md` | Integration (main) session |

## Demo story (90 seconds)

Draft, final cut decided by the pitch session.
1. Morning. The TV speaks first: greets her, reminds her of medicine, reads the weather for the temple trip.
2. Grandma teaches it something ("우리 딸은 화요일마다 와"). It thanks her like a student and remembers.
3. She asks for her singer; it finds the show and turns it on later by itself (one tool among many).
4. Mom sends a message from her phone; it appears on the TV and grandma answers by voice; mom gets a summary.
5. Close: today an app on the TV, next the TV itself.
