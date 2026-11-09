# Pitch (under 2 minutes, English)

Product name: `[NAME]` (from `PRODUCT_NAME_EN` in `src/lib/brand.ts` once the owner decides). The spoken script does not need it.

Spoken script first, about 300 words (about 1:55 at 160 words per minute; rehearse with a timer and drop the multiplayer sentence if it runs over). Then the judging map, answers to the hard questions, sources and the evidence for the gstack and GBrain prize.

## Spoken script

**Hook (0:00)**
Pickle covers your whole workday through Zoom. We cover grandma's whole day through her TV.

**Problem (0:07)**
My grandmother lives alone. My mom sleeps over every third night. Her only outing is the temple. The rest of the day, the TV is on.
In Korea, more than one in five people is 65 or older, and 38 percent of senior households are one person, alone.

**Pillar one: she hands things off (0:22)**
So we put a full AI assistant inside her TV. It speaks first: "Did you take your pills? Take an umbrella to the temple." This morning my mom booked grandma a taxi to the hospital from her own phone. Now grandma just says "call me a taxi", and the plate number shows up in huge letters. Groceries, her favorite show, all by voice.

**Pillar two: mom stops calling (0:45)**
Mom sees what got done, not what was said. Pills taken, taxi on its way, groceries waiting for her one-tap approval. When grandma says "don't tell my daughter", it doesn't.

**Why she keeps it on (1:00)**
I ran an art gallery for years. Most of my regulars were retired, and what they loved most was teaching me. Care devices get unplugged because they say "you're old". Ours says "teach me". Grandma is the teacher. Everything she teaches becomes its memory, and with her consent, anonymized, it helps make AI better for everyone.

**Why TV, why now (1:20)**
She will never install an app, but she watches one screen all day. And for the first time, what seniors know is worth teaching to AI.

**How (1:30)**
One Claude agent with real tools, GBrain as her long-term memory, built today with gstack. Today an HDMI stick on the TV she has. Next, the TV itself. Then multiplayer: seniors meeting each other by voice, through their TVs.

**Invite (1:45)**
Scan this, and be grandma's daughter for 30 seconds.

## How this maps to the three judging criteria

| Criterion | What we say | What we show |
|---|---|---|
| Clarity of problem and solution | One real person, one real day. She hands things off; mom sees the results without calling. | The 90 second video follows her day. At the table, the judge becomes mom on their own phone. |
| Technical implementation | One agent, many real tools (memory, schedule, ride, order, TV guide search, tune, family message), proactive triggers on a fast-forwarding clock, privacy enforced on the server. | Judge's phone to TV and back in seconds. Private lines never reach the phone, not even in the network panel. |
| Creativity | Three inversions. The interface is the TV she has, not a new device. She is the teacher, not the patient. Mom gets outcomes, not transcripts. | Grandma teaches at 1 pm; the agent uses it unprompted at 3 pm. "Don't tell my daughter" stays off mom's phone. |

## One-line answers

- **Why TV?** It is the one screen she already watches all day, so there is nothing new to learn, and it is big enough for a taxi plate number she can actually read.
- **Why now?** For the first time, what seniors know (recipes, how a neighborhood works, how to talk to people) is worth teaching to AI, so being taught by grandma is a contribution she can be proud of, not a service she has to accept.
- **How are we different from Ato?** Ato is a screen-free speaker that talks and relays messages; we live on the screen she already watches, we act for her (rides, groceries, shows) with the family approving anything that costs money, and she is the teacher, not the patient.

## The three hard questions (office hours) and who pays

1. **"This is a web page. How does it get onto grandma's TV?"**
   We overlay the TV she already has, in four steps. One: an HDMI stick or USB app, which is what the laptop is doing in this demo. Two: an app on Android TV and Google TV. Three: a pass-through box between the set-top box and the TV that draws the agent over live broadcasts and controls the set-top box over HDMI-CEC or IR. Four: the TV itself.
2. **"Seniors don't talk to devices, and the TV is loud."**
   She doesn't have to start. The TV speaks first, by name, at the times she already watches, and she just answers. When she talks, the TV lowers its own volume. And she keeps it on because it asks to be taught, not to take care of her.
3. **"How is this different from Ato, Alexa or the voice remote she already has?"**
   Those take commands or make check-in calls. Ours lives on her screen all day, acts for her, learns from her, and closes the loop with the family without exposing what she said in private.
4. **"Who pays?"**
   The adult child, as a monthly family subscription, because the pain we remove is theirs: the calls to check. Later, bundled by pay-TV operators with their set-top box. (Price not validated yet. If mom gives us a number today, use it here.)

## Privacy and consent (say this whenever data comes up)

No camera. Mom sees tasks and safety, not conversations; private talk is counted, never shown. Anything grandma teaches is used beyond her own agent only with her consent and her family's, and only anonymized.

## Built with GBrain and gstack (side prize)

- **GBrain** is grandma's long-term memory: every fact she teaches is stored with its source (when, who said it) and can be corrected or withdrawn. Evidence: agent brain code and `docs/gstack/`.
- **gstack** ran our office hours (problem diagnosis, demo strategy: "watch, don't demo", "narrow beats wide") and review. Evidence: `docs/gstack/office-hours.md`, `docs/gstack/office-hours-run.md`.
- One line for the stage: "Built with GBrain for grandma's long-term memory, with provenance and corrections, and gstack for office hours and review."

## Numbers we use, with sources

| Claim | Number | Source |
|---|---|---|
| More than one in five Koreans is 65+ | 21.6 percent, 11.12 million (2026) | Ministry of Data and Statistics, via [Korea Times, 2026-10-01](https://www.koreatimes.co.kr/southkorea/20261001/1-in-5-south-koreans-aged-65-and-older-in-2026-data) |
| 38 percent of senior households are one person | 6.5 million senior households, 38 percent single person | Same source |
| Roughly 2.5 million seniors living alone (Q&A only) | 6.5 M x 38 percent = about 2.47 M | **Our estimate** from the line above. Always say "roughly". |
| Korea became super-aged in December 2024 (Q&A only) | 20 percent of registered population 65+ | Ministry of the Interior and Safety, via [Korea Times, 2024-12-24](https://www.koreatimes.co.kr/southkorea/society/20241224/korea-becomes-super-aged-society) |
| Ato | $179 device, $29 per month for full features; family texts read aloud, replies summarized | [Jon Peddie Research review](https://www.jonpeddie.com/reviews/ato-a-voice-first-ai-companion-built-for-seniors/) |
| Pickle | "Pickle joins Zoom calls on your behalf"; Daniel Park on the team | [YC launch page](https://www.ycombinator.com/launches/MnF-pickle-ai-body-double-for-video-calls) |
| Grandma's day | Alone, mom every third night, temple once or twice a week, TV the rest | Founder's family interview, 2026-11-08. One person, not a study. |
| Gallery regulars loved teaching | Retired, 65 and older | **Founder's own account** from years running an art gallery. Not measured. |

Do not use:
- "Mom calls three times a day": not confirmed with mom yet. Say "calls to check" until she gives a number.
- "37 things this month": a demo count, shown on screen with a "demo count" label only.
- Minutes of TV per day for seniors: the Korean figures we found are from 2011 and 2012 and disagree.
- YC Winter 2027 RFS: checked 2026-11-09, it has no aging item (11 items, none on older adults). Our theme is the Fall 2026 RFS "AI for the Aging Population" as given by the organizers. Do not say it is in W27.
- Post-training data as revenue: it is the "why now" and the meaning, not the business model. Selling seniors' data would read as exploitation.

## Other likely questions

- **"Isn't an agent ordering things for an 80-year-old dangerous?"** Anything that spends money goes to the family first. In the demo, the grocery order waits for mom's tap.
- **"Will she really talk to a TV?"** This is our riskiest assumption and we have not tested it with her yet. Our bet: she answers when it speaks first, and she keeps it on because it asks to be taught.
- **"What does multiplayer AI mean here?"** Seniors meeting each other by voice on their TVs, with the agent as host: introducing temple friends, keeping the conversation going. No betting or gambling.
