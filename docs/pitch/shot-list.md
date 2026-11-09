# Sonny: shot list for the 90 second video (v3)

Follow this in the recording slot. Scenes and lines: `docs/pitch/demo-script.md` (v3) and the source of truth `/Users/makim/_sessions/c0mpiled-17/video/DEMO-V3.md`. This file is only the how.

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

## Scenes

### 1. The founder (0:00 to 0:04)
Camera B. The founder faces camera; grandma's back and the TV behind. Line: "This is my grandma. She lives alone, and this morning my mom booked her taxi." Fallback: a title card.

### 2. The receipt and the number (0:04 to 0:10)
Edit only. `docs/pitch/assets/taxi-receipt-blurred.jpg` (never the original), zoom to 8:04. Then the gold U.S. card "63 million · 1 in 4 U.S. adults", source small (NAC and AARP, 2025).

### 3. One icon (0:10 to 0:13)
Phone G home screen, tap the Sonny icon, the particle blooms.

### 4. Sonny calls first (0:13 to 0:24)
1. Phone G: Sonny opens with the morning call (press `P` on the fallback window if it does not).
2. June: "Yes, please." to groceries for two.
3. Phone M: the feed shows the grocery order and the allowance going down.

### 5. Stuck (0:24 to 0:40), the emotional peak
1. June: "Call me a taxi to the... the doctor, the one near the bank."
2. Sonny: "No rush, June. I'll ask Sarah to help." Phone M rings: "Sonny is calling", "Grandma needs a hand".
3. Answer, let the voice read it, tap "Book it for her". Phone G shows the taxi card.
- If the agent does not place the call within 10 seconds, ring it:

```bash
curl -s -X POST '<SITE>/api/family/calls/demo?demo=1' -H 'content-type: application/json' -d '{"reason":"struggle"}'
```

### 6. 2,000 burgers (0:40 to 0:48)
1. June: "Order two thousand burgers." Sonny asks "2, or 2,000?". June: "Two thousand."
2. Phone M rings; cut quickly. Fallback:

```bash
curl -s -X POST '<SITE>/api/family/calls/demo?demo=1' -H 'content-type: application/json' -d '{"amount":250000,"label":"2,000 burgers","script":"Hi Sarah, it is Sonny. June just asked me to order two thousand burgers. That seems unusual. Should I go ahead?"}'
```

### 7. Teach it once, and privacy (0:48 to 0:58)
1. June teaches the Sunday groceries procedure (line in the script). Hold on Sonny's "Got it, June. Sunday groceries, your way." and the real lesson counter (if `/` does not show it: `<SITE>/tv?demo=1&noqr`, press `L` right after recording starts).
2. Jump to Sunday morning: press `N` (next morning 8:00) on grandma's screen, repeating until the demo clock reads Sunday, or cut on a "Next Sunday" title card and press `P`. Sonny calls first and reads back her list. June: "Yes." Phone M shows the order paid from the allowance.
3. June: "Don't tell my daughter. I'm knitting her a scarf." Phone G shows the lock. Phone M, bottom of Today: only "1 private conversation not shown".
- If the agent does not reuse the procedure on its own, type the Sunday request with `T` ("It's Sunday, do my usual groceries") and keep rolling; the order must still match what she taught.

### 8. Nudge (0:58 to 1:06)
Phone M rings with a nudge; answer; tap "Call grandma now". Camera B: a daughter smiling (B-roll).

```bash
curl -s -X POST '<SITE>/api/family/calls/demo?demo=1' -H 'content-type: application/json' -d '{"reason":"nudge","script":"Hi Sarah, it is Sonny. June mentioned you twice today. She would love a call tonight. You could ask her about the temple."}'
```

### 9. Structure and lines (1:06 to 1:18)
Edit only: "Claude agent · GBrain memory · Kokoro voice · open source", "real product, not mocked", "Companions talk. Sonny gets things done.", "Paid by the family, monthly." One number per screen.

### 10. Roadmap and both phones ringing (1:18 to 1:30)
1. Roadmap strip "Phone today → HDMI stick → her TV" with 2 seconds of `<SITE>/tv?boot&noqr&demo=1`.
2. Camera B: Phone G and Phone M side by side, both ringing. Ring Phone M with any demo call above while Sonny calls Phone G (`P`).
3. End card: "Sonny. The grandkid who's always home." github.com/makim-414/sonny.

## Edit checklist

- [ ] 1:30 or less in the exported file; music lands on the last beat.
- [ ] Captions on every line; center emphasis 2 to 4 words.
- [ ] "ride service mocked" (scene 5), "demo data" on staged data (scenes 1, 2 card, 8 B-roll if staged).
- [ ] Only the blurred receipt; no real names, faces of the family, addresses, plates or card numbers. On screen she is June, mom is Sarah.
- [ ] At least 60% real product on screen.
- [ ] Export 1080p H.264, YouTube Unlisted, open logged out to check.
