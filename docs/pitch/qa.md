# Sonny: judge Q&A (thirteen questions, two sentences each)

Character line, use it once early: "Sonny is a little yellow cockatiel. Parrots learn by repeating what you teach them, and so does Sonny."

Say the first sentence; add the second only if they lean in. Numbers are sourced in `docs/pitch/pitch.md` ("Numbers we use"); anything marked estimate is ours.

| # | Question | Answer |
|---|---|---|
| 1 | **What is it?** | Sonny is an AI errand runner for parents who live alone: grandma taps one icon and gives the orders out loud, and Sonny gets them done (rides, groceries, reminders) with the allowance mom funds. When something is big, strange, or she gets stuck, Sonny calls her daughter first, so mom stops calling all day to check. |
| 2 | **Isn't this just another elder-care app?** | Every elder-care app watches grandma. Sonny works for her: she gives the orders out loud, while mom funds the allowance and holds the veto. |
| 3 | **How is this an agent, not a chatbot?** | Grandma programs it by teaching: she says how she does her Sunday groceries once, and Sonny runs that procedure with her allowance. Teach it once, and it is done her way from then on, with mom's veto on anything big or strange. |
| 4 | **Who needs this most?** | The daughter, 45 to 60, whose parent lives alone; she pays, and today she is already her mom's remote assistant, booking rides from her own phone and calling to check. There are 63 million family caregivers in the U.S., one in four adults, up 45% since 2015 (NAC and AARP, 2025). |
| 5 | **How do you know?** | This morning at 8:04 my mom booked my grandmother's taxi from her own phone; we have the receipt, and that is the job Sonny takes over. Caregivers average 27 hours a week and 84% handle three or more everyday tasks (NAC and AARP, 2025); we have not yet tested Sonny with my grandmother herself, which is our next step. |
| 6 | **Does it really work?** | Yes: what you saw is the running product, a Claude agent calling real tools for memory, scheduling, rides, orders, the allowance and phone calls to mom, with the Kokoro voice and GBrain memory running on our server. Two parts are mocked and labelled as such: the ride service, and Stripe runs in test mode. |
| 7 | **Why now?** | Agents can finally finish tasks by voice instead of only answering questions, and the voice, listening and memory pieces are now open source you can self-host. Seniors already have the device: 79% of Americans 65+ own a smartphone (Pew), so the barrier is apps and setup, which Sonny removes with one icon. |
| 8 | **How is this different from Ato, Alexa, or the carriers' care services?** | Companions talk; Sonny gets things done, and calls mom. Ato and similar companions chat and relay messages, Alexa waits for commands, and check-in services call to ask how she is; none of them books the taxi, spends a family allowance with a veto, or quietly calls the daughter when grandma is stuck. |
| 9 | **How do you make money?** | Paid by the family, monthly: the daughter subscribes, and the same account tops up grandma's allowance through Stripe. We have not validated a price yet (estimate, to be tested with families); next comes bundling with phone carriers and, later, TV boxes. |
| 10 | **How big is this?** | 63 million Americans already do this job unpaid, and about one in four Americans 65+ lives alone (Pew, 2023 data). At an assumed $20 a month, one million paying families would be $240 million a year (estimate, our arithmetic, not a market study). |
| 11 | **Isn't this the family spying on grandma?** | No: mom sees what got done (pills, rides, orders, safety), never what was said, and grandma's private conversations are hidden on the server, not just on screen; "don't tell my daughter" stays between them. There is no camera, and anything grandma teaches leaves her own Sonny only with her consent and her family's, anonymized. |
| 12 | **What if grandma doesn't use it?** | She doesn't have to start anything: Sonny is always on and calls her first at the times she already keeps, like a grandkid checking in. If she doesn't answer at her usual time, or seems stuck, Sonny calls mom, so silence itself becomes useful information. |
| 13 | **Why start on the phone if the TV is the goal?** | The phone ships today and proves the agent; the TV apps reuse the same web app; the device comes when we know exactly what grandma uses. And the TV is worth it: Americans 75+ watch 4.4 hours of TV a day (BLS 2025), and 61% of U.S. internet households already stream mainly on a smart TV (Parks Associates 2026); Samsung's Tizen alone is 23% of U.S. connected-TV use. |

## If they push further

- **"What's the goal?"** "Sonny handles the errands, so family can just be family." Families don't want to be caretakers; they want to be family.
- **"Doesn't this replace family?"** The opposite: Sonny nudges mom to call, with something to talk about. It takes the errands, so the call home is just a call home.
- **"Where does this go?"** "The easiest first step into AI for the oldest generation. Then health check-ins, then the rest of their daily life." (No gambling or betting, ever.)

- **"Will she really talk to it?"** Our riskiest assumption and we say so. We bet on two things: it calls her first, so she only has to answer, and it asks to be taught, so it feels like a grandkid, not a caretaker.
- **"What is the roadmap?"** Today: a one-icon web app on grandma's phone, set up by mom with one QR. Next: a Sonny app on the TV she already watches all day (Android TV / Google TV, Samsung Tizen); then our own Sonny device, plugged in by the family, nothing to install.
- **"Why you?"** It is my grandmother and my mom; and I ran an art gallery for years where my regulars were retired, and what they loved most was teaching me (founder's own account, not measured).
- **"What does Pickle have to do with it?"** Pickle covers your workday through Zoom; Sonny covers grandma's day through the phone she already answers.
