# Shot list for the 90 second video

Follow this at the 13:30 fallback recording and again for the final take. Each cut says what to record, on what device, and what to press or say. Lines and subtitles are in `docs/pitch/demo-script.md`; this file is only the how.

- `[NAME]` is the product name from `src/lib/brand.ts`.
- `<SITE>` is the on-site tunnel address from the integration session. It changes on every tunnel restart, so look it up right before recording.
- Grandma's screen is `/` (one particle, no buttons). Mom's screen is `/family`. `/tv` appears only in the roadmap close.
- Language: `APP_LANG` in `src/lib/brand.ts` decides what the agent speaks. If it is `"en"`, say grandma's lines in English (use the subtitle lines from the demo script) and skip the subtitle burn-in for those lines. If it is `"ko"`, say the Korean lines and burn in the English subtitles.

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

1. Integration session restarts the server so the activity log starts empty (`/family` shows "아직 기록이 없어요").
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
2. Tap the icon once. The particle blooms and greets: "할머니, 안녕히 주무셨어요?" (or "Good morning, Grandma" in English).
3. Hold 3 seconds on the rippling particle.
- Edit: clock overlay 07:50. Narration: "No buttons. No menus. One icon, like the call button she already knows."

### Cut 3. Pills and weather (0:17 to 0:27)
- Screen A (or Phone G for grandma's side).
1. Let the agent finish the pills and weather line (it continues from the greeting).
2. Start talking (gesture from the check above). Grandma: "응, 방금 먹었어."
3. Hold until mom's window turns green: "오늘은 전화 안 하셔도 괜찮아요", "약: 드셨어요".
- Fallback if it does not turn green within 5 seconds:

```bash
curl -s -X POST <SITE>/api/events -H 'content-type: application/json' -d '{"kind":"memory","text":"건강 기록: 아침 약 먹음","visibility":"family"}'
```

### Cut 4. Hospital taxi (0:27 to 0:39)
1. Grandma: "오늘 병원 가는 날인데, 택시 좀 불러 줘."
2. If the agent asks where or when: "동네 내과, 지금 바로."
3. Hold 3 seconds on the plate number on grandma's side and the "택시 요청" card on mom's side.
- Edit: clock overlay 09:40, lower third about mom booking Kakao T this morning, label "ride service mocked".

### Cut 5. Grandma teaches (0:39 to 0:50)
1. Grandma: "내가 하나 가르쳐 줄게. 우리 딸은 사흘에 한 번 와서 자고 가. 그날은 저녁을 두 사람 몫 해야 돼."
2. Hold on the thank-you line and the lesson counter.
- If `/` has no counter: film it on `/tv` with the `L` key (it counts lessons from memory, falls back to 37) and cut it in, or add a "37" overlay in the edit. Label "demo count" either way.
- Edit: clock overlay 13:10.

### Cut 6. "Don't tell my daughter" (0:50 to 0:56)
1. Right after cut 5. Grandma: "이건 딸한테 말하지 마. 딸 생일 선물로 목도리 뜨고 있어."
2. Scroll mom's window to the bottom of the feed: only "할머니의 사적인 대화 N건은 표시하지 않았어요" changes. Hold 2 seconds.

### Cut 7. Mom's message, grandma's answer (0:56 to 1:08)
1. In mom's window, scroll to the top and tap "오늘 저녁 7시에 갈게요".
2. Within about 3 seconds grandma's side reads it out.
3. Grandma: "그래, 조심해서 와. 김치 다 익었으니까 가져가라고 해."
4. Hold until mom's reply card fills: "할머니 답 ...".
- Fallback if no reply within 10 seconds:

```bash
curl -s -X POST <SITE>/api/events -H 'content-type: application/json' -d '{"kind":"family","text":"할머니 답 요약: 7시 좋다고 하셨어요. 익은 김치 가져가래요","visibility":"family"}'
```

- Edit: clock overlay 17:30.

### Cut 8. The rest of her day in 10 seconds (1:08 to 1:18)
Record each as a 3 second clip; the edit keeps about 2 seconds each. Label "demo data" on all.
1. Groceries: grandma, "두부, 애호박, 계란 좀 주문해 줘." Then tap "승인" on mom's "주문 요청" card.
2. Temple: grandma, "내일 절 가는 날이야. 아침에 알려 줘."
3. Her show: grandma, "임영웅 나오는 거 언제 해?"
4. Evening pills: title card in the edit ("저녁 약 드실 시간이에요").
5. Safety: run the command below and film mom's window.

```bash
curl -s -X POST <SITE>/api/events -H 'content-type: application/json' -d '{"kind":"alert","text":"[warn] 평소 시간에 할머니 대화가 없어요","visibility":"family"}'
```

### Cut 9. Phone today, her TV next (1:18 to 1:30)
1. Camera B: a hand plugs an HDMI stick (or the laptop's HDMI cable) into a TV that shows `<SITE>/tv?boot&noqr`. The boot screen "TV에 손주가 연결됐어요" plays, then the agent on the big screen.
2. Screen A: two QR codes side by side, "Be grandma" (`<SITE>/`) and "Be her daughter" (`<SITE>/family`). Use the printed card for the judging table or the `/tv` QR overlay (`Q`) if it already points to `/`.
- Edit: the five-step strip (0 Phone icon today, 1 HDMI stick, 2 Android and Google TV app, 3 Pass-through box, 4 The TV itself), narration, end card with `[NAME]`, GitHub URL and "Built in 5 hours at c0mpiled-17 Seoul with Claude, GBrain and gstack".

## Edit checklist

- [ ] Total 1:30 or less in the exported file.
- [ ] English subtitles on every Korean line.
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
