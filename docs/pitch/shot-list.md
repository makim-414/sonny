# Sonny: shot list for the 90 second video

Follow this at the recording slot (13:00 to 13:30). Each cut says what to record, on what device, and what to press or say. Lines are in `docs/pitch/demo-script.md`; this file is only the how.

- `<SITE>` is the on-site tunnel address from the integration session. It changes on every tunnel restart; look it up right before recording.
- Grandma's screen is `/`. Mom's screen is `/family` (feed only) or `/admin` (feed plus tabs). `/tv` appears only in the roadmap.
- Language is English (`APP_LANG = "en"`). Say grandma's lines word for word.
- Never script a lesson count. Film whatever the real counter shows.

## Gear and layout

| Role | Device | What it records |
|---|---|---|
| Phone G (grandma) | An Android phone with every app icon hidden or moved off the first home screen, and one Sonny icon (Chrome menu, Add to Home screen). Paired from the admin. Screen recording on. | Cut 2 (icon tap, Start) and grandma's side of cuts 4 to 7. |
| Screen A | Laptop, macOS screen recording (`Cmd+Shift+5`) | Two browser windows at phone size (DevTools device mode, 390 x 844): left `<SITE>/?demo=1` as grandma, right `<SITE>/admin?demo=1` as mom. Main footage if Phone G is not used. |
| Phone M (mom, optional) | A second phone on `<SITE>/admin`, screen recording on | The "Sonny is calling" screen in cut 5 looks best on a real phone. |
| Camera B | Phone on a stand | Cut 1 B-roll (room, TV on, empty chair) and the TV dongle shot in cut 9. |

Start all recordings together and clap once in front of every device for sync.

## Grandma's screen keys (`/`, from `src/components/orb/OrbApp.tsx`)

| Key or gesture | What it does |
|---|---|
| Tap the screen, `Enter` or `Space` | Start (first time), then interrupt Sonny and listen |
| `P` | Sonny speaks first (morning check-in) |
| `N` | Jump to the next morning 8:00 and run the morning check-in |
| `F` | Clock +30 minutes |
| `T` | Typed input (fallback when the mic fails) |
| `E` | Captions on or off |

## Before the first take

1. Integration session restarts the server so the feed, wallet ($80, $30 limit) and calls start clean.
2. Pair Phone G: on a laptop sign in to `<SITE>/admin` (demo account `mom@sonny.demo` / `grandma-demo`), Device tab, "Connect grandma's phone", scan the QR with Phone G, then Chrome menu, Add to Home screen. Hide every other app from that home screen.
3. Open mom's side at `<SITE>/admin?demo=1`. Check the three big buttons and the Allowance tab load.
4. Test grandma's mic once with a throwaway line; then restart the server again.

## Cuts

### Cut 1. Mom is already grandma's agent (0:00 to 0:08)
- Camera B: 6 seconds of the room. No faces, no address, no family photos.
- Edit: narration and a staged call log card labelled "demo data".

### Cut 2. One icon, Sonny speaks first (0:08 to 0:19)
1. Phone G home screen: tap the Sonny icon.
2. Tap the big Start button. Sonny greets her and asks about pills and weather (if not, press `P` on Screen A's grandma window).
3. Grandma: "Yes, I just took them."
4. Hold until mom's side shows green "No need to call today." and "Pills: Taken".
- Fallback if the summary does not turn green within 5 seconds:

```bash
curl -s -X POST '<SITE>/api/events?demo=1' -H 'content-type: application/json' -d '{"kind":"memory","text":"Health record: took her morning pills","visibility":"family"}'
```

### Cut 3. The real receipt (0:19 to 0:21)
- Edit only: full screen `/Users/makim/_sessions/c0mpiled-17/assets/taxi-receipt-blurred.jpg` (same file in the repo: `docs/pitch/assets/taxi-receipt-blurred.jpg`), 2 seconds, with the caption from the script.
- Never use `taxi-receipt-original.jpeg`. It shows addresses, the plate, the driver and the card.

### Cut 4. "Call me a taxi" (0:21 to 0:31)
1. Press `F` four times on grandma's window (about 9:50 AM).
2. Grandma: "I have a doctor's appointment. Can you call me a taxi?" If Sonny asks where: "Dr. Kim's clinic, right now."
3. Hold 3 seconds on the plate number (grandma) and the Taxi line plus the lower balance (mom, Allowance tab).

### Cut 5. 2,000 hamburgers (0:31 to 0:47)
1. Grandma: "Order two thousand hamburgers for the temple party."
2. Sonny double-checks. Grandma: "Two thousand."
3. Mom's phone rings: "Sonny is calling". Tap Answer. Let Sonny's voice finish.
4. Mom says "No" (or taps Decline). Grandma's side hears the answer.
- Fallback if the agent does not place the call within 10 seconds, ring it yourself:

```bash
curl -s -X POST '<SITE>/api/family/calls/demo?demo=1' -H 'content-type: application/json' -d '{"amount":250000,"label":"2,000 hamburgers","script":"Hi, it is Sonny. Grandma just asked me to order two thousand hamburgers. That seems unusual. Should I go ahead?"}'
```

- The first call loads the Kokoro voice. Mom's page warms it on open; still, open mom's page at least 30 seconds before this cut.

### Cut 6. Grandma teaches, Sonny remembers (0:47 to 1:00)
1. Press `F` until about 1:10 PM.
2. Grandma: "Let me teach you something. My daughter comes every third day and stays the night. On those days, dinner is for two."
3. Hold on the thank-you and the lesson counter (real number, "demo count" tag). If `/` shows no counter: open `<SITE>/tv?demo=1&noqr` and press `L` right after you start recording (the card closes after about 4.5 seconds). If the memory API is down the TV shows a placeholder number; do not use that take.
4. Press `N` (next morning 8:00). Sonny should bring up groceries for two by itself. Grandma: "Yes, please."

### Cut 7. "Don't tell my daughter" (1:00 to 1:07)
1. Grandma: "Don't tell my daughter. I'm knitting her a scarf for her birthday."
2. On mom's side, scroll to the bottom of Today: only "N private conversations not shown" changes. Hold 2 seconds.

### Cut 8. The rest of her day (1:07 to 1:17)
Record each as a 3 second clip; label "demo data".
1. Grandma: "Tomorrow is my temple day. Remind me in the morning."
2. Mom taps "I'll be there at 7 tonight"; grandma answers "Good, drive safe"; mom's reply card fills.
3. Grandma: "When is my favorite singer on?"
4. Evening pills: title card in the edit.
5. Safety alert:

```bash
curl -s -X POST '<SITE>/api/events?demo=1' -H 'content-type: application/json' -d '{"kind":"alert","text":"[warn] Grandma has not talked at her usual time","visibility":"family"}'
```

### Cut 9. Set up once, and what's next (1:17 to 1:30)
1. Screen A: mom's admin, Device tab, "Connect grandma's phone", the QR on screen; Phone G scans it (re-pairing is fine).
2. Camera B: a hand plugs an HDMI dongle into a TV showing `<SITE>/tv?boot&noqr&demo=1` (the 3 second "connected" boot screen, then Sonny on the big screen).
3. Two QR codes: "Be grandma" (`<SITE>/?demo=1`) and "Be her daughter" (`<SITE>/family?demo=1`).
- Edit: roadmap strip, narration, end card with "Sonny", https://github.com/makim-414/sonny and the open source line.

## Edit checklist

- [ ] Total 1:30 or less in the exported file.
- [ ] Captions on every spoken line.
- [ ] Labels: "ride service mocked" (cut 4), "demo count" (cut 6), "demo data" (cuts 1 and 8).
- [ ] Only the blurred receipt. No real names, addresses, plates, card numbers or faces anywhere.
- [ ] Export 1080p H.264, upload to YouTube as Unlisted, open the link logged out to check.

## If something breaks mid-take

- Mic not working: `T` on grandma's screen and type the line.
- Agent slow: wait 5 seconds and say the line again. Do not restart the server mid-take (it wipes the feed and wallet).
- Mom's phone stops updating: reload it; everything comes back from the server.
- The call does not ring: use the `calls/demo` command in cut 5.
