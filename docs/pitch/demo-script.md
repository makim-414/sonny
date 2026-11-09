# Demo video script (90 seconds)

One day in grandma's life, told through one icon on her phone and mom's phone next to it.

- Product name: `[NAME]` everywhere in this file. It lives in one place, `PRODUCT_NAME_EN` in `src/lib/brand.ts`.
- Language: **English is the original** for every line (`APP_LANG = "en"`, global market first). Korean appears only as optional subtitles, for the founder's own story.
- The founder's Korean grandmother is why we built this. The product launches with English-speaking seniors first.

The message: **a screen with nothing to learn.** No buttons, no menus. One icon, like the call button she already knows. She taps it, a single particle blooms, and the agent is already talking. Listening, it gathers in. Speaking, it ripples.

Rules that shape this cut:
- **Narrow beats wide** (gstack office hours): one loop is shown for real and in depth. She taps, she talks, the agent acts, she teaches it, mom's phone gets the result.
- **Her whole day** (owner): everything else is a fast, clearly labelled card montage that follows the clock.
- **Same agent, next on her TV:** the TV appears only in the roadmap at the end.
- **No made-up numbers on screen:** the lesson counter shows the real count from memory, tagged "demo count".

Two pillars to land:
1. Grandma hands things off to the agent: pills, taxi, groceries, her show.
2. Mom sees what got done, not what was said. She stops calling to check.

## Recording setup

- Left half: grandma's phone (`/`, the particle screen). Right half: mom's phone (`/family`, English UI). Both at phone size, side by side.
- Captions: burn in the spoken English lines as captions (seniors and judges both read along). Korean subtitles only on the founder's story in scene 1, if at all.
- The time of day is an edit overlay in the top corner (7:50 AM, 9:40 AM, ...).
- Grandma's voice: recorded by an older English speaker if possible, or read by the presenter. No real face, name or address on screen.
- Anything not live gets a small corner label: "demo data", "ride service mocked", "demo count".
- Narration only in scenes 1, 2 and 9.

## Timeline

| # | Time | Clock overlay | What | Live loop or card |
|---|---|---|---|---|
| 1 | 0:00 to 0:08 | none | Why we built it: the founder's grandmother, alone with the TV | Title cards |
| 2 | 0:08 to 0:17 | 7:50 AM | One tap on the icon, the particle blooms: "Good morning, grandma. Did you sleep well?" | Live |
| 3 | 0:17 to 0:27 | 7:51 AM | Pills and weather. Mom's phone: "No need to call today." | Live loop |
| 4 | 0:27 to 0:39 | 9:40 AM | Clinic taxi, plate number in huge letters, card on mom's phone | Live loop |
| 5 | 0:39 to 0:50 | 1:10 PM | Grandma teaches, the agent remembers, real lesson counter | Live loop |
| 6 | 0:50 to 0:56 | 1:12 PM | "Don't tell my daughter": nothing shows on mom's phone | Live loop |
| 7 | 0:56 to 1:08 | 5:30 PM | Mom's message reaches grandma, her answer comes back as a summary | Live loop |
| 8 | 1:08 to 1:18 | 3:20 PM to 9:00 PM | The rest of her day in 10 seconds | Card montage |
| 9 | 1:18 to 1:30 | none | Roadmap: phone today, her TV next. Pickle line. Two QR codes | Close |

## Scenes

### 1. Why we built it (0:00 to 0:08)

- Screen: dim living room, the TV glowing, an empty chair. Title cards:
  "My grandmother lives alone." / "My mom stays over every third night." / "Her only outing: the temple, once or twice a week." / "The rest of the day, the TV is on."
- Narration: "This is my grandmother's day. Millions of seniors live it. None of them will learn a new app."

### 2. One icon (0:08 to 0:17)

- Screen: grandma's phone home screen, big icons. A thumb taps the `[NAME]` icon next to her phone app.
- The screen goes dark, one particle blooms in the middle and ripples as it speaks:
  - Agent: "Good morning, grandma. Did you sleep well?"
- Narration: "So she doesn't have to. No buttons. No menus. One icon, like the call button she already knows."
- Lower third: "Mom set it up once from her admin: scanned one QR on grandma's phone, done."

### 3. Morning: pills and weather (0:17 to 0:27)

- Agent: "Did you take your morning pills? It'll rain this afternoon, so take an umbrella to the temple."
- The particle gathers in while she answers.
  - Grandma: "Yes, I just took them."
- Mom's phone: the top turns green, "No need to call today.", and "Pills: Taken".

### 4. Clinic taxi (0:27 to 0:39)

- Grandma: "I have a doctor's appointment today. Can you call me a taxi?"
- Agent: "Done. A taxi from your door to the clinic, here in ten minutes. I let your daughter know."
- Grandma's screen: the plate number and arrival time in very large text.
- Mom's phone: a "Taxi" card in the feed.
- Lower third: "This morning my mom booked this exact ride for my grandmother, on her own phone. Now grandma just asks." Corner label: "ride service mocked".

### 5. Grandma teaches (0:39 to 0:50)

- Grandma: "Let me teach you something. My daughter comes every third day and stays the night. On those days, dinner is for two."
- Agent: "Thank you for teaching me, grandma. I'll remember that."
- The lesson counter appears under the particle with the **real** number of lessons in her memory (GBrain, `category: "lesson"`), tagged "demo count". Do not script a fixed number; read whatever the counter shows.
- Point made: she is the teacher, not the patient. What she teaches becomes the agent's long-term memory, with source and corrections.

### 6. "Don't tell my daughter" (0:50 to 0:56)

- Grandma: "Don't tell my daughter. I'm knitting her a scarf for her birthday."
- Agent: "Okay. Just between us."
- Mom's phone: nothing new in the feed. At the bottom only: "1 private conversation not shown. They're grandma's."
- Caption on mom's side: "Mom sees what got done, not what was said."

### 7. Mom's message, grandma's answer (0:56 to 1:08)

- Mom's phone: she taps the big button "I'll be there at 7 tonight".
- Grandma's phone: the particle ripples and reads it out.
  - Agent: "A message from your daughter: I'll be there at 7 tonight."
- Grandma: "Good. Tell her to drive safe, and to take some kimchi home. It's ready."
- Mom's phone: the reply card fills in, "Grandma's reply: 7 is fine. Take the kimchi home."

### 8. The rest of her day, in 10 seconds (1:08 to 1:18)

Fast cards, about 2 seconds each, clock overlay jumping forward. Corner label on all: "demo data".

1. 3:20 PM, groceries from her allowance: "Your daughter is coming tonight. Groceries for two: tofu, zucchini, eggs?" It is over the $30 per-purchase limit, so an approval card appears in mom's admin (Allowance tab); mom taps Approve. (It used what she taught in scene 5.) Caption: "Mom tops up an allowance; grandma spends it by voice; anything big waits for Mom's OK."
2. 6:00 PM, temple: "Tomorrow is a temple day. The bus is at 9:40."
3. 7:55 PM, her show: "Your favorite singer is on in five minutes."
4. 9:00 PM, evening pills: "Time for your evening pills."
5. Next morning, safety: "Grandma hasn't talked at her usual time" lands on mom's phone as an alert.

- Music only. Captions name each card: "Groceries, approved by mom", "Temple day", "Her favorite show", "Evening pills", "Safety check".

### 9. Close: phone today, her TV next (1:18 to 1:30)

- Screen: a five-step strip that lights up left to right: "0. Phone icon (today)" / "1. HDMI stick" / "2. Android and Google TV app" / "3. Pass-through box over the set-top box" / "4. The TV itself".
- During steps 1 to 4: a hand plugs an HDMI stick into a TV; the TV plays its "connected" boot screen (`/tv?boot`) and the same agent appears on the big screen.
- Then two QR codes side by side: "Be grandma" (`/?demo=1`) and "Be her daughter" (`/family?demo=1`). `?demo=1` signs the scanner in as the demo device or demo family account, so nobody types a password.
- Narration: "Pickle covers your whole workday through Zoom. We cover grandma's whole day. Today one icon on her phone, next the TV she watches all day. Scan the first code and be grandma. Scan the second and be her daughter."
- End card: `[NAME]`, GitHub URL, "Built in 5 hours at c0mpiled-17 Seoul on open source: Kokoro, Silero VAD, three.js, GBrain, gstack".

## Live demo at the judging table (not the video)

Office hours rule: watch, don't demo. Put the phone in the judge's hand.

1. On the table: a printed card or a screen with two QR codes. "Be grandma" opens `/?demo=1`. "Be her daughter" opens `/family?demo=1` (or `/admin?demo=1` to show the full admin).
2. Judge one scans "Be grandma". The particle blooms and greets them. They just talk, in English.
3. Judge two (or the presenter) scans "Be her daughter" and taps "I'll be there at 7 tonight". Grandma's phone reads it out.
4. Judge one answers. Within seconds, judge two's phone shows "Grandma's reply" with the summary.
5. Optional: judge one says "call me a taxi". A taxi card with Approve appears on judge two's phone.

Fallbacks: if a phone's mic is blocked, use the presenter's phone that already has the icon on its home screen. If Wi-Fi fails, phone hotspot. If both fail, play the 90 second video.
