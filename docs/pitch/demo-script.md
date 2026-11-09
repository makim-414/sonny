# Sonny: demo video script v4 (90 seconds)

Source of truth for the cut: `/Users/makim/_sessions/c0mpiled-17/video/DEMO-V4.md` (owner's story order, 12:10). This file is the line-by-line version.

Order: my scene → the numbers → the product (allowance, agent, calls mom when grandma is stuck) → the goal → going to market (phone → TV → device) → the vision.

- **Motif: the phone rings.** Sonny opens every moment as a call; the last shot is both phones ringing together.
- **Killer line:** "Grandma isn't the patient. She's the boss."
- **Goal line:** "Sonny handles the errands, so family can just be family."
- **Core message (owner):** "Families don't want to be caretakers. They want to be family. Grandma wants mom to call and say hi, not to manage her errands. Sonny takes the errands, so mom can live her day with peace of mind, and the call home is just a call home." (narration or captions around scenes 3 and 9)
- **Vision line:** "The easiest first step into AI for the oldest generation. Then health check-ins, then the rest of their daily life."
- **Names on screen:** grandma is June, mom is Sarah (demo names).
- **Language:** English. Captions always on; the center emphasis line is 2 to 4 words; one number per screen.
- **Honesty:** "demo data" on staged data, "ride service mocked" on the taxi. Only confirmed numbers; if a number is not confirmed, drop the caption.
- **Not in the video, pitch or repo:** any gambling or betting extension (sports betting, casinos). It would read as targeting seniors' money, and online gambling is illegal in Korea.

## Scenes

| # | Time | Screen | Words (captions) | Center line | Material |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:07 | The founder centered on a couch facing camera; behind them on the sofa, grandma and the TV in profile | "This morning, I saw my mom calling a taxi for my grandmother, to the hospital." | | Seedance live action 1 (intro); fallback a title card |
| 2 | 0:07 to 0:10 | The blurred taxi receipt (`docs/pitch/assets/taxi-receipt-blurred.jpg`), zoom to 8:04 | | "Mom is grandma's assistant." | Photo |
| 3 | 0:10 to 0:16 | Two number cards, one per screen | "63 million Americans care for family. 1 in 4 adults." then "27 hours a week." (source small: NAC and AARP, 2025) | | Motion |
| 4 | 0:16 to 0:19 | A plain phone home screen, one Sonny icon, "Sonny is calling" | | "Grandma isn't the patient. She's the boss." | Real screen |
| 5 | 0:19 to 0:32 | Grandma's phone: answer, greeting and offer, June: "Do my Sunday groceries." Sonny runs the list she taught once; allowance payment card. Mom's phone: "Groceries ordered, from allowance" | | "Mom loads the allowance. Grandma just says it." | Real screen |
| 6 | 0:32 to 0:37 | Grandma's hand hesitating over the phone | (captions only) | | Seedance live action 2 (B-roll A) |
| 7 | 0:37 to 0:50 | June tries to book a taxi and gets lost. Sonny: "No rush, June. I'll ask Sarah to help." Mom's phone: "Sonny is calling", the request read aloud, "Book it for her". The taxi card on grandma's screen | "When grandma gets stuck, Sonny doesn't make her feel slow. It quietly calls mom." | "Stuck? Sonny quietly calls mom." | Real screen |
| 8 | 0:50 to 0:54 | Sarah stepping out of a meeting room to take the call | (captions only) | | Seedance live action 3 (B-roll B) |
| 9 | 0:54 to 1:00 | The goal, one card | "Sonny handles the errands, so family can just be family." | | Motion |
| 10 | 1:00 to 1:12 | Going to market: (1) phone today (real screen); (2) a Sonny TV app, 2 seconds of `/tv`, with "Seniors 75+ watch 4.4 hours of TV a day" (BLS 2025) and "61% of U.S. internet households stream mainly on a smart TV" (Parks Associates 2026), one per screen; (3) our own Sonny device | | "Same Sonny. Bigger screen." | Real screen and motion |
| 11 | 1:12 to 1:22 | The vision: the first AI to cross the doorstep | "The easiest first step into AI for the oldest generation. Then health check-ins, then the rest of their daily life." | | Motion |
| 12 | 1:22 to 1:30 | Both phones ringing at once, then the logo | "Sonny. The grandkid who's always home." github.com/makim-414/sonny | | Real screen |

Optional third TV card, only if there is room: "Samsung's Tizen is 23% of U.S. connected-TV use" (Parks Associates, reported April 2026). Never put 34% (Tizen among smart TV owners) and 23% (Tizen among all connected-TV homes) on the same screen; their bases differ. No combined platform percentage.

## Lines in full

- Scene 5, Sonny: "Morning, June. It's Sunday." June: "Do my Sunday groceries." Sonny: "Milk, eggs, the small tofu, bananas not too ripe, from Kim's market, the way you taught me. Seventeen dollars from your allowance. Ordering now."
- Scene 7, June: "Call me a taxi to the... the doctor, the one near the bank." Sonny: "No rush, June. I'll ask Sarah to help." Sonny to Sarah (Kokoro): "Hi Sarah, it's Sonny. June has been trying to book a taxi to the doctor for fifteen minutes and can't remember the clinic's name. Shall I book Dr. Kim's clinic for her, or would you like to call her?" Sarah taps "Book it for her". Sonny to June: "Your taxi to Dr. Kim's is on its way, June."

If the live-action clips do not arrive: scene 1 becomes a title card, scenes 6 and 8 are cut, and scenes 5 and 7 run longer.

## Live demo at the judging table

1. A card with two QR codes: "Be grandma" (`/?demo=1`) and "Be her daughter" (`/admin?demo=1`).
2. Judge one: "Do my Sunday groceries." Then "Order two thousand burgers"; judge two's phone rings.
3. If the struggle call cannot be triggered live: `POST /api/family/calls/demo?demo=1 {"reason":"struggle"}`; judge two taps "Book it for her".

Fallbacks: the presenter's paired phone as grandma; a phone hotspot; the 90 second video.
