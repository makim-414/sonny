# Phone orb app, TV screen and phone remote

## Phone app `/` (PWA, the main screen)
- One particle orb on a dark screen (`src/components/orb/`). Tap once ('눌러서 시작') if the browser needs a gesture; then the agent greets first (`proactive` / `morning-checkin`) and the page keeps listening, thinking and speaking with no buttons.
- Orb states: idle breathes, listening gathers and shrinks (trembles on interim speech), thinking spins, speaking spreads and ripples on a fake speech rhythm.
- A tap while it talks stops the voice and goes back to listening; a tap also closes a card.
- Captions: only the last sentence, small and faint at the bottom. E or `?en` adds the English line.
- `showCard` floats over the orb (6 s, learned-count cards 4.5 s with the big number). `tune` becomes a 3 s '채널을 바꿨어요' card. `notifyFamily` and `private` show a small top toast.
- If the mic is blocked or speech recognition is missing (possible in an iOS home-screen app), a small '말 대신 글로 적기' line appears.
- Desktop demo keys: Enter or Space (tap), E, T (text line), P (greet again), N (next morning 08:00 + greeting), F (+30 min).
- It also polls `/api/family/inbox`. Only one screen should consume the inbox: open the other with `?noinbox` (orb) when `/tv` is the one showing family messages.
- Voice (APP_LANG en): Kokoro 82M via `POST /api/tts {text}` -> 16-bit WAV, voice af_heart, about 1.3 to 1.6 s per sentence on the M-series laptop; the next sentence is fetched while one plays. Model cache `~/.cache/hyodo-tts` (96 MB, `TTS_CACHE_DIR` to move it); the page calls `GET /api/tts` on open to preload. `next.config.ts` must keep `serverExternalPackages: ["kokoro-js"]`. Hangul lines and failed clips use the browser voice.
- The orb's speaking ripple follows the real voice level from a WebAudio analyser (0 to about 0.7 measured). Browser-voice fallback uses a fake rhythm.
- Turn taking: Silero VAD (`@ricky0123/vad-web`) runs with Web Speech `en-US`; 0.7 s of silence ends the turn. VAD and recognition pause while the assistant thinks or speaks. Model, worklet and onnxruntime wasm come from `/api/tts/vad/<file>` (served from node_modules, no CDN). `?novad` turns VAD off.
- Particles stay canvas 2D (smooth at 1000 to 1400 particles); three.js was not needed.
- PWA: `src/app/manifest.ts` serves `/manifest.webmanifest` (name from `src/lib/brand.ts`, standalone, dark colors). Icons in `public/icons/` (192, 512, maskable 512, apple-touch 180), generated from `public/icons/orb-icon.svg` with ImageMagick. `public/sw.js` only exists so the app can be installed. The Claude browser pane blocks service workers; real Chrome registers it.



## Keys on /tv
- Up / Down: channel. Enter: OK (closes card, else shows channel banner). Esc: close card.
- M or the big mic button: listen (ko-KR). Pressing M while the TV talks interrupts it.
- T: hidden text input (mic backup). Opens by itself if the mic fails.
- P: proactive call, `{ source: "proactive", text: "morning-checkin" }`.
- F: demo clock +30 min. `schedule` timers run on this clock.
- N: next morning. Clock jumps to 08:00 next day, shows a 'next morning' screen, then calls morning-checkin. Old timers before that time are dropped.
- E: English line under captions (`sayEn`, `heardEn`). Start with it on: `/tv?en`.
- Boot screen: the first visit on a browser shows 'TV에 손주가 연결됐어요' for 3 s, then the broadcast. Force it again with `/tv?boot`.
- Learned counter: a `showCard` whose title has 배운 or 가르쳐 and a number (for example '이번 달 배운 것 12개') gets the big-number style. It shows '할머니가 가르쳐 주신 것', is tagged 'demo count', and closes after 4.5 s.
- L: the same card from `GET /api/agent/memory` (count of `category: "lesson"` facts), and the TV thanks her out loud. Falls back to 37 only if the memory API is unreachable.
- Q: hide or show the two QR codes (phone remote `/remote`, family app `/family`, both from window.location.origin). Start hidden: `/tv?noqr`. They also hide while a caption is up.
- While listening, thinking or speaking the broadcast dims and shrinks and 'TV 소리 줄였어요' shows (no real broadcast audio exists).

## Phone remote `/remote`
- Big speak button (Web Speech, KO/EN toggle; phone needs https, so use the tunnel URL), up / OK / down, and a type box.
- Posts to `POST /remote/api { text }` (TV-session route): pushes `{ from: "remote", text }` into `store.tvInbox` without logging to the family feed, since grandma's words are private. Falls back to `POST /api/family` with `from: "remote"`.
- Keys travel as `key:up`, `key:down`, `key:ok`. TV now polls the inbox every 1 s so the remote feels live.
- English input goes to the agent as normal `source: "voice"` text.

## Channels
- Source of truth is the agent guide `GET /api/agent/epg?now=ISO`. The TV fetches it at start and whenever the demo clock moves more than 10 minutes, and shows the channel name and the show on now (or the latest one in a gap). Tagged 'demo data' on screen.
- Picture style comes from title keywords (`src/components/tv/epg-client.ts`): 임영웅·가요·트로트 -> stage lights, 뉴스 -> news desk, 법문·사찰 -> temple, 건강·체조 -> exercise, 기행·다큐 -> nature, else drama.
- Up / down walks the guide's channels that have shows, in number order.
- If the guide is missing, the local fallback lineup in `src/components/tv/channels.ts` is used.

## Contract assumptions the other sessions should know
- `POST /api/agent`: 404 or network error or bad shape -> TV uses `src/components/tv/mock-agent.ts`. 404 is cached 20 s.
- `AgentReply.private: true` -> lock toast '딸에게는 안 알려요'. While waiting for a voice reply the caption shows grandma's words plus '잠깐만요, 생각하고 있어요'.
- `GET /api/family/inbox`: TV accepts a bare array or `{ items | inbox | messages: [...] }` of `{ id?, from?, text }`.
  Sends each to the agent as `{ source: "family", text: "<from>: <text>" }` (just `<text>` when `from` is missing).
- `schedule.at` must be an ISO time on the demo clock (`AgentRequest.now` is that clock). When due, the TV runs the inner action and speaks `label` (plus the card body for `showCard`).
- `notifyFamily`: TV only shows the corner toast "가족에게 알렸어요" (red when `level: "urgent"`). Logging and delivery to mom are server-side.
- `say` is split into sentences; each sentence is one big caption while it is spoken.

## Integration check (2026-11-09 10:30, tv + agent-brain + family-pitch)
- Remote text '임영웅 나오는 거 틀어줘' -> real agent tuned 18 TV조선 임영웅 콘서트 and spoke. English 'Please turn on the news' -> tuned 20 YTN.
- N -> 11월 10일 08:00, real agent morning check-in spoke. 0 JS console errors.
- Agent replies did not include `sayEn` yet, so the English line stayed empty.

## Not verified
- Real mic and speaker on a physical machine (headless browser only). Chrome needs one key press or click before it will speak.
