# Pitch (under 2 minutes, English)

Product name: `[NAME]` (from `PRODUCT_NAME_EN` in `src/lib/brand.ts` once the owner decides). The spoken script does not need it.

Spoken script first, about 300 words, in English (`APP_LANG = "en"`: the demo and the product launch in English; the founder's Korean grandmother is the origin story) (about 1:55 at 160 words per minute; rehearse with a timer and drop the gallery sentence if it runs over). Multiplayer vision is in the Q&A, not the spoken script. Then the judging map, answers to the hard questions, sources and the evidence for the gstack and GBrain prize.

## Spoken script

**Hook (0:00)**
Pickle covers your whole workday through Zoom. We cover grandma's whole day.

**Problem (0:06)**
My grandmother lives alone. My mom sleeps over every third night. Her only outing is the temple. The rest of the day, the TV is on.
She's in Korea, but this is everywhere: in the US, one in four people over 65 lives alone. We're starting with English-speaking seniors.

**One icon (0:20)**
She will never learn a new app. So we built a screen with nothing to learn. No buttons. No menus. One icon, like the call button she already knows. She taps it, and her assistant is already talking: "Did you take your pills? Take an umbrella to the temple."

**Pillar one: she hands things off (0:35)**
This morning my mom booked grandma a taxi to the hospital from her own phone. Now grandma just says "call me a taxi", and the plate number shows up in huge letters. Mom tops up an allowance; grandma spends it by voice; anything big waits for Mom's OK.

**Pillar two: mom stops calling (0:48)**
Mom sets it up once from the admin: scans one QR on grandma's phone, done. Then she sees what got done, not what was said. When grandma says "don't tell my daughter", it doesn't.

**Why she keeps using it (1:00)**
I ran an art gallery for years. Most of my regulars were retired, and what they loved most was teaching me. Care devices get abandoned because they say "you're old". Ours says "teach me". Everything she teaches becomes its memory, and with her consent, anonymized, it helps make AI better for everyone.

**How, and what's next (1:20)**
One Claude agent with real tools. Everything else runs on open source you can self-host: Kokoro voice, Silero VAD, GBrain memory, built today with gstack. Today, one icon on her phone. Next, the same agent on the TV she watches all day.

**Invite (1:42)**
Scan the first code and be grandma. Scan the second and be her daughter.

## How this maps to the three judging criteria

| Criterion | What we say | What we show |
|---|---|---|
| Clarity of problem and solution | One real person, one real day. A screen with nothing to learn: one icon. She hands things off; mom sees the results without calling. | The 90 second video follows her day. At the table, one judge becomes grandma and another becomes mom, each on their own phone. |
| Technical implementation | One agent, many real tools (memory, schedule, ride, order, TV guide search, tune, family message), the same agent on phone and TV, privacy enforced on the server, built on self-hostable open source with 1,000+ stars each (`docs/OPEN_SOURCE.md`). | Grandma's phone to mom's phone and back in seconds. Private lines never reach the phone, not even in the network panel. |
| Creativity | Three inversions. The interface is one icon and a particle, nothing to learn. She is the teacher, not the patient. Mom gets outcomes, not transcripts. | Grandma teaches at 1 pm; the agent uses it unprompted at 3 pm. "Don't tell my daughter" stays off mom's phone. |

## One-line answers

- **Why one icon?** She already knows exactly one gesture on her phone: tap a picture to call someone. Our whole interface is that gesture, then her voice. The family installs the icon and signs in once.
- **Why TV next?** It is the one screen she watches all day, so the agent can speak first even when the phone is in a drawer, and it is big enough for a plate number she can actually read.
- **Why now?** For the first time, what seniors know (recipes, how a neighborhood works, how to talk to people) is worth teaching to AI, so being taught by grandma is a contribution she can be proud of, not a service she has to accept.
- **How are we different from Ato?** Ato is a screen-free speaker that talks and relays messages; we start from the phone she already has and move onto the TV she already watches, we act for her (rides, groceries, shows) with the family approving anything that costs money, and she is the teacher, not the patient.

## The three hard questions (office hours) and who pays

1. **"This is a web page. How does grandma even get to it?"**
   The family adds it to her home screen as one icon and signs in once. She taps it like the call button. Then the same agent moves onto the TV she already has, in steps. Zero: the phone icon, today. One: an HDMI stick or USB app. Two: an app on Android TV and Google TV. Three: a pass-through box between the set-top box and the TV that draws the agent over live broadcasts and controls the set-top box over HDMI-CEC or IR. Four: the TV itself.
2. **"Seniors don't talk to devices."**
   She talks into a phone every day; tapping the icon feels like a call, and the agent speaks first, by name. There is nothing on the screen to get wrong: one particle that gathers in when it listens and ripples when it talks. And she keeps using it because it asks to be taught, not to take care of her.
3. **"How is this different from Ato, Alexa or the voice remote she already has?"**
   Those take commands or make check-in calls. Ours needs no new device, starts with one tap, acts for her, learns from her, and closes the loop with the family without exposing what she said in private.
4. **"Who pays?"**
   The adult child, as a monthly family subscription, because the pain we remove is theirs: the calls to check. The same account funds grandma's allowance (Stripe Checkout, test mode in the demo), and every spend over the limit waits for her OK. Later, bundled by pay-TV operators with their set-top box. (Price not validated yet. If mom gives us a number today, use it here.)

## Open source we build on (technical implementation)

One line for the stage: "Everything runs on open source you can self-host: Kokoro voice, Silero VAD, GBrain memory."
Full list with stars and licenses: `docs/OPEN_SOURCE.md` (every project 1,000+ stars). The ones to name if asked:
- Kokoro (hexgrad/kokoro, Apache-2.0): the English voice, an 82M model running locally, no API key.
- Silero VAD (snakers4/silero-vad, MIT, via ricky0123/vad): hands-free turn taking, which is why there are no buttons.
- three.js (MIT): the single particle that is the whole interface.
- serwist (MIT): installs it to the home screen like an app.
- GBrain (MIT): grandma's long-term memory with provenance, corrections and withdrawal, local PGLite.
- gstack (MIT): office hours and review during the build.
- Claude through the Vercel AI SDK: the agent loop with tool calling. This is the one hosted piece.

## Family admin and allowance (say it when asked "how does it get set up" or "who controls the money")

- Mom signs in once (`/login`). In the admin she taps "Connect grandma's phone" and scans one QR with grandma's phone. That phone stays signed in for good; grandma never sees a login screen.
- Tabs: Today (what got done, the "no need to call" line, approvals), Taught (her lessons and the real counter), Routines (pills, outings, doctor; saved into her memory), Allowance, Privacy, Device.
- Allowance: Mom tops up (demo credit today, Stripe Checkout in test mode once the key is set). Grandma spends by voice. Anything over the per-purchase limit (default $30) waits for Mom's Approve or Decline.
- Judges skip the login with the demo QR codes (`?demo=1`).

## Privacy and consent (say this whenever data comes up)

No camera. Mom sees tasks and safety, not conversations; private talk is counted, never shown. Anything grandma teaches is used beyond her own agent only with her consent and her family's, and only anonymized.

## Built with GBrain and gstack (side prize)

- **GBrain** is grandma's long-term memory: every fact she teaches is stored with its source (when, who said it) and can be corrected or withdrawn. Evidence: agent brain code and `docs/gstack/`.
- **gstack** ran our office hours (problem diagnosis, demo strategy: "watch, don't demo", "narrow beats wide") and review. Evidence: `docs/gstack/office-hours.md`, `docs/gstack/office-hours-run.md`.
- One line for the stage: "Built with GBrain for grandma's long-term memory, with provenance and corrections, and gstack for office hours and review."

## Numbers we use, with sources

| Claim | Number | Source |
|---|---|---|
| One in four Americans over 65 lives alone | 26 percent of US adults 65+ lived alone in 2023 | [Pew Research Center, 2025-12-04](https://www.pewresearch.org/short-reads/2025/12/04/a-smaller-share-of-older-us-adults-live-alone-today-than-in-1990/), from Census decennial and ACS data |
| More than one in five Koreans is 65+ (Q&A only) | 21.6 percent, 11.12 million (2026) | Ministry of Data and Statistics, via [Korea Times, 2026-10-01](https://www.koreatimes.co.kr/southkorea/20261001/1-in-5-south-koreans-aged-65-and-older-in-2026-data) |
| 38 percent of Korean senior households are one person (Q&A only) | 6.5 million senior households, 38 percent single person | Same source |
| Roughly 2.5 million seniors living alone (Q&A only) | 6.5 M x 38 percent = about 2.47 M | **Our estimate** from the line above. Always say "roughly". |
| Korea became super-aged in December 2024 (Q&A only) | 20 percent of registered population 65+ | Ministry of the Interior and Safety, via [Korea Times, 2024-12-24](https://www.koreatimes.co.kr/southkorea/society/20241224/korea-becomes-super-aged-society) |
| Ato | $179 device, $29 per month for full features; family texts read aloud, replies summarized | [Jon Peddie Research review](https://www.jonpeddie.com/reviews/ato-a-voice-first-ai-companion-built-for-seniors/) |
| Pickle | "Pickle joins Zoom calls on your behalf"; Daniel Park on the team | [YC launch page](https://www.ycombinator.com/launches/MnF-pickle-ai-body-double-for-video-calls) |
| Grandma's day | Alone, mom every third night, temple once or twice a week, TV the rest | Founder's family interview, 2026-11-08. One person, not a study. |
| Gallery regulars loved teaching | Retired, 65 and older | **Founder's own account** from years running an art gallery. Not measured. |

Do not use:
- "Mom calls three times a day": not confirmed with mom yet. Say "calls to check" until she gives a number.
- Any fixed lesson count (the old "37"). The counter shows the real number of lessons in memory, tagged "demo count". Do not pad the seed data to make it look bigger.
- "16 million Americans 65+ live alone": appears in secondary sources (NCOA, retirement sites) citing the 2023 CPS, but we did not open the Census table. Say "one in four" (Pew) instead.
- Minutes of TV per day for seniors: the Korean figures we found are from 2011 and 2012 and disagree.
- YC Winter 2027 RFS: checked 2026-11-09, it has no aging item (11 items, none on older adults). Our theme is the Fall 2026 RFS "AI for the Aging Population" as given by the organizers. Do not say it is in W27.
- Post-training data as revenue: it is the "why now" and the meaning, not the business model. Selling seniors' data would read as exploitation.

## Other likely questions

- **"Isn't an agent ordering things for an 80-year-old dangerous?"** Anything that spends money goes to the family first. In the demo, the grocery order waits for mom's tap.
- **"Will she really talk to a TV?"** This is our riskiest assumption and we have not tested it with her yet. Our bet: she answers when it speaks first, and she keeps it on because it asks to be taught.
- **"What is the long-term vision?"** Multiplayer: seniors meeting each other by voice through their TVs, with the agent as host.
- **"What does multiplayer AI mean here?"** Seniors meeting each other by voice on their TVs, with the agent as host: introducing temple friends, keeping the conversation going. No betting or gambling.
