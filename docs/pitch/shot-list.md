# Sonny: shot list for the 90 second video (v4)

Follow this in the recording slot. Scenes and lines: `docs/pitch/demo-script.md` (v4) and the source of truth `/Users/makim/_sessions/c0mpiled-17/video/DEMO-V4.md`. This file is only the how.

- `<SITE>` is the on-site tunnel address from the integration session; it changes on every tunnel restart.
- Grandma's screen is `/`. Mom's screen is `/admin/today` (or `/family`). `/tv` appears only in scene 10.
- English, captions always on. Never script the lesson counter; film whatever it shows.
- Motif: every Sonny moment opens as a ringing phone. Keep the ring sound on both phones.

## Gear and layout

| Role | Device | Records |
|---|---|---|
| Phone G (grandma, June) | Android, home screen with only the Sonny icon (Chrome menu, Add to Home screen), paired from the admin | Scenes 3 to 7, screen recording on |
| Phone M (mom, Sarah) | Second phone on `<SITE>/admin/today`, signed in as the demo account | Scenes 4 to 8 and the last shot, screen recording on |
| Screen A (fallback) | Laptop, two 390 x 844 browser windows: `<SITE>/?demo=1` and `<SITE>/admin/today?demo=1` | Everything if the phones fail |
| Camera B | Phone on a stand | Scene 1 (founder and grandma's back), scene 8 B-roll (a daughter smiling), scene 10 last shot (both phones ringing) |

Clap once in front of every device at the start for sync.

## Grandma's screen keys (`/`)

Tap, `Enter` or `Space`: start, then interrupt and listen. `P`: Sonny speaks first. `N`: next morning 8:00. `F`: clock +30 min. `T`: type instead of talk. `E`: captions.

## Before the first take

1. Integration session restarts the server (clean feed, wallet $80, limit $30, no calls). Restart again after any change to `src/proxy.ts`.
2. Pair Phone G: sign in on Phone M or a laptop at `<SITE>/admin` (`mom@sonny.demo` / `grandma-demo`), Device page, "Connect grandma's phone", scan with Phone G, then Add to Home screen.
3. Open Phone M at `<SITE>/admin/today` at least 30 seconds before scene 4, so Sonny's voice is warm. (If the voice takes longer than 5 seconds, mom's phone reads the call in the browser voice instead.)

## Scenes (v4)

### 1. The founder (0:00 to 0:07)
Seedance live action 1 (made by the owner in Higgsfield). Fallback: a title card with the line "This morning, I saw my mom calling a taxi for my grandmother, to the hospital."

### 2. The receipt (0:07 to 0:10)
Edit only: `docs/pitch/assets/taxi-receipt-blurred.jpg` (never the original), zoom to 8:04.

### 3. The numbers (0:10 to 0:16)
Edit only: "63 million Americans care for family. 1 in 4 adults." then "27 hours a week." One per screen, source small (NAC and AARP, 2025).

### 4. One icon (0:16 to 0:19)
Phone G home screen with the single Sonny icon; Sonny calls ("Sonny is calling").

### 5. Sunday groceries (0:19 to 0:32)
1. Before recording, teach the routine once on Phone G: "Let me teach you how I do my Sunday groceries. Milk, eggs, the small tofu, and bananas that aren't too ripe. From Kim's market, under twenty dollars."
2. Move the demo clock to a Sunday morning (`N` repeatedly, or start the page with `?t=08:00` on a Sunday).
3. Record: Sonny calls, June: "Do my Sunday groceries." Sonny reads back her list and pays from the allowance. Phone M shows the order.
- Fallback if Sonny does not reuse the routine: type it with `T` ("Do my Sunday groceries: milk, eggs, small tofu, bananas not too ripe, Kim's market").

### 6. Hesitating hand (0:32 to 0:37)
Seedance live action 2 (B-roll A). Cut if it does not arrive.

### 7. Stuck (0:37 to 0:50)
1. June: "Call me a taxi to the... the doctor, the one near the bank."
2. Phone M rings: "Grandma needs a hand". Answer, let the voice read it, tap "Book it for her". Phone G shows the taxi card.
- Fallback within 10 seconds:

```bash
curl -s -X POST '<SITE>/api/family/calls/demo?demo=1' -H 'content-type: application/json' -d '{"reason":"struggle"}'
```

### 8. Sarah leaves the meeting (0:50 to 0:54)
Seedance live action 3 (B-roll B). Cut if it does not arrive.

### 9. The goal (0:54 to 1:00)
Edit only: "Sonny handles the errands, so family can just be family."

### 10. Going to market (1:00 to 1:12)
1. Phone G real screen for "Today".
2. 2 seconds of `<SITE>/tv?boot&noqr&demo=1` for "Next: a Sonny app on her TV", with "Seniors 75+ watch 4.4 hours of TV a day" (BLS 2025) and "61% of U.S. internet households stream mainly on a smart TV" (Parks Associates 2026), one per screen. Optional: "Samsung's Tizen is 23% of U.S. connected-TV use" (Parks, reported April 2026). No combined percentages.
3. "Then: our own Sonny device, plugged in by the family" card.

### 11. The vision (1:12 to 1:22)
Edit only: "The easiest first step into AI for the oldest generation. Then health check-ins, then the rest of their daily life."

### 12. Both phones ring (1:22 to 1:30)
Camera B: Phone G and Phone M side by side. Press `P` on Phone G and ring Phone M with any demo call at the same moment. End card "Sonny. The grandkid who's always home." github.com/makim-414/sonny.

## Edit checklist

- [ ] 1:30 or less in the exported file; music lands on the last beat.
- [ ] Captions on every line; center emphasis 2 to 4 words.
- [ ] "ride service mocked" (scene 7), "demo data" on staged data. No gambling or betting anywhere.
- [ ] Only the blurred receipt; no real names, faces of the family, addresses, plates or card numbers. On screen she is June, mom is Sarah.
- [ ] At least 60% real product on screen.
- [ ] Export 1080p H.264, YouTube Unlisted, open logged out to check.
