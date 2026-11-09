# Sonny: judge Q&A (eleven questions, two sentences each)

Killer line, use it once early: "Grandma isn't the patient. She's the boss."

Say the first sentence; add the second only if they lean in. Numbers are sourced in `docs/pitch/pitch.md` ("Numbers we use"); anything marked estimate is ours.

| # | Question | Answer |
|---|---|---|
| 1 | **What is it?** | Sonny is an AI errand runner for parents who live alone: grandma taps one icon and gives the orders out loud, and Sonny gets them done (rides, groceries, reminders) with the allowance mom funds. When something is big, strange, or she gets stuck, Sonny calls her daughter first, so mom stops calling all day to check. |
| 2 | **Isn't this just another elder-care app?** | Every elder-care app watches grandma. Sonny works for her: grandma isn't the patient, she's the boss, giving the orders out loud while mom funds the allowance and holds the veto. |
| 3 | **Who needs this most?** | The daughter, 45 to 60, whose parent lives alone; she pays, and today she is already her mom's remote assistant, booking rides from her own phone and calling to check. There are 63 million family caregivers in the U.S., one in four adults, up 45% since 2015 (NAC and AARP, 2025). |
| 4 | **How do you know?** | This morning at 8:04 my mom booked my grandmother's taxi from her own phone; we have the receipt, and that is the job Sonny takes over. Caregivers average 27 hours a week and 84% handle three or more everyday tasks (NAC and AARP, 2025); we have not yet tested Sonny with my grandmother herself, which is our next step. |
| 5 | **Does it really work?** | Yes: what you saw is the running product, a Claude agent calling real tools for memory, scheduling, rides, orders, the allowance and phone calls to mom, with the Kokoro voice and GBrain memory running on our server. Two parts are mocked and labelled as such: the ride service, and Stripe runs in test mode. |
| 6 | **Why now?** | Agents can finally finish tasks by voice instead of only answering questions, and the voice, listening and memory pieces are now open source you can self-host. Seniors already have the device: 79% of Americans 65+ own a smartphone (Pew), so the barrier is apps and setup, which Sonny removes with one icon. |
| 7 | **How is this different from Ato, Alexa, or the carriers' care services?** | Companions talk; Sonny gets things done, and calls mom. Ato and similar companions chat and relay messages, Alexa waits for commands, and check-in services call to ask how she is; none of them books the taxi, spends a family allowance with a veto, or quietly calls the daughter when grandma is stuck. |
| 8 | **How do you make money?** | Paid by the family, monthly: the daughter subscribes, and the same account tops up grandma's allowance through Stripe. We have not validated a price yet (estimate, to be tested with families); next comes bundling with phone carriers and, later, TV boxes. |
| 9 | **How big is this?** | 63 million Americans already do this job unpaid, and about one in four Americans 65+ lives alone (Pew, 2023 data). At an assumed $20 a month, one million paying families would be $240 million a year (estimate, our arithmetic, not a market study). |
| 10 | **Isn't this the family spying on grandma?** | No: mom sees what got done (pills, rides, orders, safety), never what was said, and grandma's private conversations are hidden on the server, not just on screen; "don't tell my daughter" stays between them. There is no camera, and anything grandma teaches leaves her own Sonny only with her consent and her family's, anonymized. |
| 11 | **What if grandma doesn't use it?** | She doesn't have to start anything: Sonny is always on and calls her first at the times she already keeps, like a grandkid checking in. If she doesn't answer at her usual time, or seems stuck, Sonny calls mom, so silence itself becomes useful information. |

## If they push further

- **"Will she really talk to it?"** Our riskiest assumption and we say so. We bet on two things: it calls her first, so she only has to answer, and it asks to be taught, so it feels like a grandkid, not a caretaker.
- **"Why a phone and not the TV?"** The phone is the one device she already answers; the same agent moves to her TV next (HDMI stick, then a box, then the TV itself) because the TV is where she spends her day.
- **"Why you?"** It is my grandmother and my mom; and I ran an art gallery for years where my regulars were retired, and what they loved most was teaching me (founder's own account, not measured).
- **"What does Pickle have to do with it?"** Pickle covers your workday through Zoom; Sonny covers grandma's day through the phone she already answers.
