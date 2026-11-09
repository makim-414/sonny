# Shot list for the 90 second video

Follow this at the 13:30 fallback recording and again for the final take. Each cut says what to record, on what device, and the exact keys to press. Lines and subtitles are in `docs/pitch/demo-script.md`; this file is only the how.

`[NAME]` is the product name from `src/lib/brand.ts`. `<SITE>` is the on-site tunnel address the integration session gives you (it changes on every tunnel restart, so look it up right before recording).

## Gear and layout

| Role | Device | What it records |
|---|---|---|
| Screen A | Laptop, macOS screen recording (`Cmd+Shift+5`, "Record Entire Screen", mic on if the presenter voices grandma live) | TV window and phone window side by side, in sync. This is the main footage. |
| Camera B | A phone on a stand, 4K or 1080p, landscape | Cut 2 (hand plugging the HDMI stick into a real TV) and the B-roll for cut 1 (room, TV glowing, empty chair). |
| Phone C (optional) | A real phone opening `<SITE>/family`, iOS screen recording | Swap in for the phone window in cuts 3 to 7 if a real phone looks better. Start it at the same moment as Screen A and clap once on camera for sync. |

Screen A layout (one recording, so TV and phone stay in sync):
- Left, about two thirds: browser window with `<SITE>/tv?t=07:50&en&noqr` in full-screen-like size (or the TV itself over HDMI, recorded with the Camera B phone if you want a real TV in shot).
- Right, one third: a second browser window, DevTools device mode at 390 x 844, with `<SITE>/family`.
- Hide the dock and notifications (Do Not Disturb on). Close other tabs.

## TV keys (from `src/components/tv/TvApp.tsx`)

| Key | What it does |
|---|---|
| `M` | Start listening (press, then speak; it stops by itself after you finish) |
| `T` | Open the text box (fallback when the mic fails). Type, then `Enter`. `Esc` closes it |
| `P` | The TV speaks first: morning check-in |
| `N` | Jump to the next morning 08:00 and run the morning check-in |
| `F` | Fast-forward the demo clock by 30 minutes |
| `E` | English captions on or off |
| `Q` | QR codes on or off |
| `ArrowUp` / `ArrowDown` | Channel up or down |
| `Enter` | OK (closes a card, or shows the channel banner) |
| `Esc` | Close the card |

URL flags: `?t=HH:MM` starts the demo clock at that time, `&en` starts with English captions, `&noqr` hides the QR codes.

Important: after every page load, click once on the TV page (or press any key) before the first line. The browser blocks speech until there is a user gesture.

## Before the first take

1. Integration session restarts the server so the activity log starts empty (`/family` should show "아직 기록이 없어요").
2. Open both windows as above. Phone window: confirm the three big buttons are visible without scrolling.
3. Test the mic once with `M` and a throwaway line, then restart the server again to clear it.
4. Start Screen A recording. Start Phone C recording if used.

## Cuts

### Cut 1. Problem (0:00 to 0:09)
- Record: Camera B B-roll, 10 seconds of the room with the TV on and an empty chair. No faces, no address, no family photos in frame.
- Edit: four title cards over it (text in the demo script). Narration recorded separately.

### Cut 2. Plug it in (0:09 to 0:15)
- Record: Camera B, close-up of a hand plugging an HDMI stick (or the laptop's HDMI cable) into the back of a TV, then the TV screen waking with `/tv` on it.
- Keys: on the laptop, `<SITE>/tv?t=07:50&en&noqr` already open full screen before plugging in.
- Edit: narration line from the script.

### Cut 3. Morning, the TV speaks first (0:15 to 0:27)
- Screen A. TV at 07:50.
1. Click once on the TV page.
2. Press `P`. The TV greets her, asks about pills, reads the weather.
3. Press `M`, grandma says: "응, 방금 먹었어."
4. Wait until the phone window shows green "오늘은 전화 안 하셔도 괜찮아요" and "약: 드셨어요" (up to 2 seconds after the TV answers).
- If the summary does not turn green: the agent did not log the medicine. Fallback, then continue:

```bash
curl -s -X POST <SITE>/api/events -H 'content-type: application/json' -d '{"kind":"memory","text":"건강 기록: 아침 약 먹음","visibility":"family"}'
```

### Cut 4. Hospital taxi (0:27 to 0:39)
- Screen A.
1. Press `F` four times (clock about 09:50).
2. Press `M`, grandma says: "오늘 병원 가는 날인데, 택시 좀 불러 줘."
3. If the TV asks where or when, press `M` and answer: "동네 내과, 지금 바로."
4. Hold on the big taxi card (plate number) for 3 seconds. Phone window shows the "택시 요청" card.
- Edit: lower third about mom booking Kakao T this morning, corner label "ride service mocked".

### Cut 5. Grandma teaches (0:39 to 0:50)
- Screen A.
1. Press `F` seven times (clock about 13:20).
2. Press `M`, grandma says: "내가 하나 가르쳐 줄게. 우리 딸은 사흘에 한 번 와서 자고 가. 그날은 저녁을 두 사람 몫 해야 돼."
3. Hold on the TV's thank-you line.
- Lesson counter "이번 달 배운 것 37": the TV does not draw this yet. Add it in the edit as an overlay with a "demo count" label, unless the TV session adds it before 12:30.

### Cut 6. "Don't tell my daughter" (0:50 to 0:56)
- Screen A, right after cut 5.
1. Press `M`, grandma says: "이건 딸한테 말하지 마. 딸 생일 선물로 목도리 뜨고 있어."
2. The TV shows the lock toast "딸에게는 안 알려요".
3. Scroll the phone window to the bottom of the feed: only "할머니의 사적인 대화 N건은 표시하지 않았어요" changes, nothing else appears. Hold 2 seconds.

### Cut 7. Mom's message, grandma's answer (0:56 to 1:08)
- Screen A.
1. Press `F` eight times (clock about 17:20).
2. In the phone window, scroll to the top and tap "오늘 저녁 7시에 갈게요".
3. Within about 3 seconds the TV shows and reads the message.
4. Press `M`, grandma says: "그래, 조심해서 와. 김치 다 익었으니까 가져가라고 해."
5. Wait for the phone window's reply card to fill: "할머니 답 ...". Hold 2 seconds.
- If the reply does not come back within 10 seconds, seed it and keep rolling:

```bash
curl -s -X POST <SITE>/api/events -H 'content-type: application/json' -d '{"kind":"family","text":"할머니 답 요약: 7시 좋다고 하셨어요. 익은 김치 가져가래요","visibility":"family"}'
```

### Cut 8. The rest of her day in 10 seconds (1:08 to 1:18)
Record each card as a 3 second clip; the edit keeps about 2 seconds each. Corner label "demo data" on all.
1. Groceries: press `M`, "두부, 애호박, 계란 좀 주문해 줘." Then tap "승인" on the phone window's "주문 요청" card.
2. Temple: press `T`, type "내일 절 가는 날이야. 아침에 알려 줘", `Enter`.
3. Her show: press `F` until about 19:55, press `M`, "임영웅 나오는 거 틀어 줘." Wait for the channel switch.
4. Evening pills: press `F` until about 21:00 (the reminder fires if it was scheduled; otherwise a title card in the edit).
5. Safety: run the command below, film the phone window's alert.

```bash
curl -s -X POST <SITE>/api/events -H 'content-type: application/json' -d '{"kind":"alert","text":"[warn] 평소보다 TV가 늦게 켜졌어요","visibility":"family"}'
```

### Cut 9. Close (1:18 to 1:30)
- Screen A: press `Q` so the TV shows the QR codes. Hold 4 seconds on the `/family` QR.
- Edit: the four-step strip (HDMI stick, Android and Google TV app, pass-through box, the TV itself), the narration from the script, end card with `[NAME]`, the GitHub URL and "Built in 5 hours at c0mpiled-17 Seoul with Claude, GBrain and gstack".

## Edit checklist

- [ ] Total 1:30 or less in the exported file.
- [ ] English subtitles on every Korean line (text in the demo script).
- [ ] Labels: "ride service mocked" (cut 4), "demo count" (cut 5), "demo data" (cut 8), "TV guide: seed data from a real Korean listing" (cut 8, show).
- [ ] No real names, addresses, phone numbers or faces. Blur the browser address bar if it shows a personal path.
- [ ] Narration only in cuts 1, 2 and 9.
- [ ] Export 1080p H.264, upload to YouTube as Unlisted, open the link logged out to check.

## If something breaks mid-take

- Mic not working: use `T` and type the same line.
- Agent slow or erroring: wait 5 seconds, then press `M` again with the same line. Do not restart the server mid-take (it wipes the feed).
- Phone window stops updating: reload it; the feed comes back from the server.
- Tunnel down: record on `http://localhost:3000` instead (same keys), the QR in cut 9 then shows localhost, so film cut 9 later on the new tunnel.
