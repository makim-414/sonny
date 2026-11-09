# Shot list for the 90 second video

Follow this at the 13:30 fallback recording and again for the final take. Each cut says what to record, on what device, and what to press or say. Lines and subtitles are in `docs/pitch/demo-script.md`; this file is only the how.

- `[NAME]` is the product name from `src/lib/brand.ts`.
- `<SITE>` is the on-site tunnel address from the integration session. It changes on every tunnel restart, so look it up right before recording.
- Grandma's screen is `/` (one particle, no buttons). Mom's screen is `/family`. `/tv` appears only in the roadmap close.
- Language: English. `APP_LANG = "en"` in `src/lib/brand.ts`, so the agent speaks English and `/family` shows English. Grandma's lines below are what to say, word for word.
- Numbers: never script a lesson count. Film whatever the real counter shows (it reads the lesson count from memory and is tagged "demo count").

## Check before recording (12:30, after the feature freeze)

The `/` particle screen is being built by another session. Confirm these and fix this file if anything differs:
- [ ] Opening `/` greets grandma by itself (the morning check-in). If it needs a tap first, the first tap in cut 2 is that tap.
- [ ] How to start talking on `/`: tap anywhere, or always listening. Write the exact gesture into cuts 3 to 7.
- [ ] A typed fallback exists on `/` for when the mic fails, and how to open it.
- [ ] The taxi card (plate number) and the lesson counter show on `/`, not only on `/tv`.
- [ ] Mom's inbox messages reach `/` (it polls `/api/family/inbox` like the TV does).

## Gear and layout

| Role | Device | What it records |
|---|---|---|
| Phone G | A real phone with `[NAME]` added to the home screen (Safari: Share, Add to Home Screen; Chrome: menu, Add to Home screen), signed in already. iOS or Android screen recording on. | Cut 2 (the tap on the icon, the bloom). Optionally all of cuts 2 to 7 as grandma's side. |
| Screen A | Laptop, macOS screen recording (`Cmd+Shift+5`, Record Entire Screen) | Two browser windows side by side at phone size (DevTools device mode, 390 x 844): left `<SITE>/` as grandma, right `<SITE>/family` as mom. Main footage for cuts 3 to 8, in sync. |
| Camera B | A phone on a stand, landscape | Cut 1 B-roll (room, TV glowing, empty chair) and the HDMI plug-in shot for cut 9. |

If you use Phone G for grandma's side, start its recording at the same moment as Screen A and clap once in front of both for sync.

Hide the dock and notifications (Do Not Disturb). Close other tabs.

## Before the first take

0. Sign-in: the app now has family sign-in and device pairing. For recording, open grandma's side as `<SITE>/?demo=1` and mom's side as `<SITE>/family?demo=1` (or `<SITE>/admin?demo=1`). For Phone G, pair it properly: sign in to `<SITE>/admin` as the demo account, open the Device tab, tap "Connect grandma's phone" and scan the QR with Phone G, then "Add to Home Screen". The `curl` fallbacks below carry `?demo=1` so they pass the sign-in check.
1. Integration session restarts the server so the activity log starts empty (`/family` shows "Nothing yet...").
2. Open both windows. On `/family` the three big buttons are visible without scrolling.
3. Test the mic on `/` once with a throwaway line, then restart the server again to clear it.
4. Start the recordings.

## Cuts

### Cut 1. Problem (0:00 to 0:08)
- Record: Camera B, 10 seconds of the room with the TV on and an empty chair. No faces, no address, no family photos in frame.
- Edit: four title cards over it, narration recorded separately.

### Cut 2. One icon (0:08 to 0:17)
- Record: Phone G screen recording.
1. Start on the home screen with `[NAME]` placed next to the phone app.
2. Tap the icon once. The particle blooms and greets: "Good morning, grandma. Did you sleep well?"
3. Hold 3 seconds on the rippling particle.
- Edit: clock overlay 7:50 AM. Narration: "No buttons. No menus. One icon, like the call button she already knows."

### Cut 3. Pills and weather (0:17 to 0:27)
- Screen A (or Phone G for grandma's side).
1. Let the agent finish the pills and weather line (it continues from the greeting).
2. Start talking (gesture from the check above). Grandma: "Yes, I just took them."
3. Hold until mom's window turns green: "No need to call today." and "Pills: Taken".
- Fallback if it does not turn green within 5 seconds:

```bash
curl -s -X POST '<SITE>/api/events?demo=1' -H 'content-type: application/json' -d '{"kind":"memory","text":"Health record: took her morning pills","visibility":"family"}'
```

### Cut 4. Hospital taxi (0:27 to 0:39)
1. Grandma: "I have a doctor's appointment today. Can you call me a taxi?"
2. If the agent asks where or when: "Dr. Kim's clinic, right now."
3. Hold 3 seconds on the plate number on grandma's side and the "Taxi" card on mom's side.
- Edit: clock overlay 9:40 AM, lower third about mom booking the ride this morning, label "ride service mocked".

### Cut 5. Grandma teaches (0:39 to 0:50)
1. Grandma: "Let me teach you something. My daughter comes every third day and stays the night. On those days, dinner is for two."
2. Hold on the thank-you line and the lesson counter.
- The counter is real: it is the number of `category: "lesson"` facts in memory (GBrain), shown with a "demo count" tag. Whatever it shows is what we film.
- If `/` does not show the counter: open `<SITE>/tv?noqr` on the second window, press `L` (the TV fetches the lesson count from `GET /api/agent/memory`, shows the big counter card and thanks her out loud), and cut that in. The card closes after about 4.5 seconds, so press `L` right after you start recording. If the memory API is down the TV falls back to a placeholder number; do not use that take.
- Edit: clock overlay 1:10 PM.

### Cut 6. "Don't tell my daughter" (0:50 to 0:56)
1. Right after cut 5. Grandma: "Don't tell my daughter. I'm knitting her a scarf for her birthday."
2. Scroll mom's window to the bottom of the feed: only "N private conversations not shown. They're grandma's." changes. Hold 2 seconds.

### Cut 7. Mom's message, grandma's answer (0:56 to 1:08)
1. In mom's window, scroll to the top and tap "I'll be there at 7 tonight".
2. Within about 3 seconds grandma's side reads it out.
3. Grandma: "Good. Tell her to drive safe, and to take some kimchi home. It's ready."
4. Hold until mom's reply card fills: "Grandma's reply ...".
- Fallback if no reply within 10 seconds:

```bash
curl -s -X POST '<SITE>/api/events?demo=1' -H 'content-type: application/json' -d '{"kind":"family","text":"Grandma'"'"'s reply: 7 is fine. Take the kimchi home.","visibility":"family"}'
```

- Edit: clock overlay 5:30 PM.

### Cut 8. The rest of her day in 10 seconds (1:08 to 1:18)
Record each as a 3 second clip; the edit keeps about 2 seconds each. Label "demo data" on all.
1. Groceries: grandma, "Can you order tofu, zucchini and eggs?" If it is over the $30 limit, tap "Approve" in mom's admin, Allowance tab (or on the "Order" card in Today).
2. Temple: grandma, "Tomorrow is my temple day. Remind me in the morning."
3. Her show: grandma, "When is my favorite singer on?"
4. Evening pills: title card in the edit ("Time for your evening pills").
5. Safety: run the command below and film mom's window.

```bash
curl -s -X POST '<SITE>/api/events?demo=1' -H 'content-type: application/json' -d '{"kind":"alert","text":"[warn] Grandma has not talked at her usual time","visibility":"family"}'
```

### Cut 9. Phone today, her TV next (1:18 to 1:30)
1. Camera B: a hand plugs an HDMI stick (or the laptop's HDMI cable) into a TV. On the laptop, open `<SITE>/tv?boot&noqr` just before plugging in: `?boot` forces the 3 second "connected" boot screen even if this browser has seen it before, then the agent appears on the big screen. To film it again, reload the same URL.
2. Screen A: two QR codes side by side, "Be grandma" (`<SITE>/?demo=1`) and "Be her daughter" (`<SITE>/family?demo=1`). Use the printed card for the judging table or the `/tv` QR overlay (`Q`) if it already points to `/`.
- Edit: the five-step strip (0 Phone icon today, 1 HDMI stick, 2 Android and Google TV app, 3 Pass-through box, 4 The TV itself), narration, end card with `[NAME]`, GitHub URL and "Built in 5 hours at c0mpiled-17 Seoul on open source: Kokoro, Silero VAD, three.js, GBrain, gstack".

## Edit checklist

- [ ] Total 1:30 or less in the exported file.
- [ ] Captions on every spoken line (English).
- [ ] Clock overlays per cut.
- [ ] Labels: "ride service mocked" (cut 4), "demo count" (cut 5), "demo data" (cut 8).
- [ ] No real names, addresses, phone numbers or faces. Blur the address bar if it shows anything personal.
- [ ] Narration only in cuts 1, 2 and 9.
- [ ] Export 1080p H.264, upload to YouTube as Unlisted, open the link logged out to check.

## If something breaks mid-take

- Mic not working: use the typed fallback on `/` (see the check above).
- Agent slow or erroring: wait 5 seconds, then say the same line again. Do not restart the server mid-take (it wipes the feed).
- Mom's window stops updating: reload it; the feed comes back from the server.
- Tunnel down: record on `http://localhost:3000` (Screen A only; Phone G needs the tunnel), film cut 2 later on the new tunnel.
