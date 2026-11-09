# Phone orb app, TV screen and phone remote

## Phone app `/` (PWA, the main screen)
- One particle orb on a dark screen (`src/components/orb/`). Tap once ('눌러서 시작') if the browser needs a gesture; then the agent greets first (`proactive` / `morning-checkin`) and the page keeps listening, thinking and speaking with no buttons.
- Orb states: idle breathes, listening gathers and shrinks (trembles on interim speech), thinking spins, speaking spreads and ripples on a fake speech rhythm.
- A tap while it talks stops the voice and goes back to listening; a tap also closes a card.
- Captions: only the last sentence, small and faint at the bottom. E or `?en` adds the English line.
- `showCard` floats over the orb (6 s, learned-count cards 4.5 s with the big number). `tune` becomes a 3 s '채널을 바꿨어요' card. `notifyFamily` and `private` show a small top toast.
- If the mic is blocked or speech recognition is missing (possible in an iOS home-screen app), a small '말 대신 글로 적기' line appears.
- Always-on (phone on its charger): after Start the screen stays on with the Screen Wake Lock API (asked again whenever the page becomes visible). With no talk for 45 s (`?rest=` seconds) the orb dims to 30 % and drifts slowly against burn-in.
- Sonny speaks first on a schedule: `routine:<name>` (`source: "proactive"`) when the demo clock passes 8:00 (`routine:morning`), 19:00 (`routine:evening`), or a time found in a `routine` or `health` memory fact ("8 am", "7:30 pm", "19:00", "저녁 7시"). F jumps count. A routine that comes due during a turn waits until the turn ends.
- Idle check-in: 3 h without her words (`?idle=` seconds) sends `idle-checkin`; still no answer after min(idle, 10 min) sends `idle-checkin:2`. Nothing more from the screen; the agent decides on the family alert. I key sends `idle-checkin` now.
- Web Push for a closed app was not built (it needs VAPID keys stored in the keychain and new API routes); roadmap line: Sonny calls her phone.
- Hidden setup: hold the invisible 64x64 top-left corner, or the remote's Menu or S key, for 2 s to open `/setup`. Short taps do nothing there.
- Family settings (localStorage, written by `/setup`): `sonny.rate`, `sonny.waitMs`, `sonny.textScale` (normal/large/xlarge or 1/1.25/1.5), `sonny.captions` (on/off), `sonny.volume` (0..1), `sonny.lang` (en/ko). URL `?rate=` and `?wait=` win. Read in `src/components/orb/settings.ts`.
- Desktop demo keys: Enter or Space (tap), E, T (text line), P (greet again), N (next morning 08:00 + greeting), F (+30 min).
- It also polls `/api/family/inbox`. Only one screen should consume the inbox: open the other with `?noinbox` (orb) when `/tv` is the one showing family messages.
- Voice (APP_LANG en): Kokoro 82M via `POST /api/tts {text}` -> 16-bit WAV, voice af_heart, about 1.3 to 1.6 s per sentence on the M-series laptop; the next sentence is fetched while one plays. Model cache `~/.cache/hyodo-tts` (96 MB, `TTS_CACHE_DIR` to move it); the page calls `GET /api/tts` on open to preload. `next.config.ts` must keep `serverExternalPackages: ["kokoro-js"]`. Hangul lines and failed clips use the browser voice.
- The orb's speaking ripple follows the real voice level from a WebAudio analyser (0 to about 0.7 measured). Browser-voice fallback uses a fake rhythm.
- Turn taking: Silero VAD (`@ricky0123/vad-web`) runs with Web Speech `en-US` (kept open through pauses). After 0.7 s of silence the last 8 s go to `POST /api/turn` (smart-turn): complete ends the turn, otherwise it waits up to 4 s more and cancels if she keeps talking. Without `/api/turn` it uses a fixed 2 s silence (`?wait=2.5` seconds sets it and forces fixed; `?noturn` forces fixed at 2 s).
- Voice speed 0.85 for Kokoro and the browser voice, 250 ms between sentences (`?rate=0.9`).
- First screen: one round Start button (about 100 px) under the orb; it disappears once the talk begins. VAD and recognition pause while the assistant thinks or speaks. Model, worklet and onnxruntime wasm come from `/api/tts/vad/<file>` (served from node_modules, no CDN). `?novad` turns VAD off.
- No Web Speech (iPhone home-screen app, `service-not-allowed`, `network`): the VAD's utterance (16 kHz) goes to `POST /api/stt` as WAV and the transcript starts the turn. `?stt` forces this path. If `/api/stt` answers 503 the type line appears.
- TV remotes: OK / Enter starts, or stops the voice and listens. Back (Escape, Backspace, webOS 461, Tizen 10009) closes a card and never leaves the app.
- Particles: `src/components/orb/WebGLOrb.tsx` is a raw WebGL orb written from scratch for this repo (no three.js, no client code reused): Fibonacci sphere computed once, all motion from a few sines in the vertex shader, one additive `drawArrays(POINTS)` per frame, no float render targets. 1100 points on phones, 1500 on desktop. Core color is `--brand` lifted toward white, far side `--chart-2`; the soft glow is a CSS gradient behind the canvas. It stops drawing when the tab is hidden or the orb is off screen.
- `Orb.tsx` picks it, and falls back to the canvas 2D `ParticleOrb.tsx` when WebGL or the shaders fail, on `webglcontextlost`, with `prefers-reduced-motion`, or with `?orb=2d`. Both read the same signal (state, pulse, real voice level).
- Size (esbuild 0.25 minify, measured 11/9): WebGLOrb 5.1 KB min / 2.5 KB gzip; WebGLOrb + ParticleOrb + Orb 8.5 KB min / 3.7 KB gzip (target 15 KB).
- Dev server only: if a client drops while `/api/tts` requests are queued behind Kokoro, `next dev` exits (ECONNRESET in the router process). `next start` survived the same test (4 parallel requests aborted at 1.5 s and 3 s). Demo on `pnpm start`.
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
- Q: hide or show the two QR codes (grandma's phone app `/?demo=1`, family app `/family?demo=1`, both from window.location.origin). Start hidden: `/tv?noqr`. They also hide while a caption is up.
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

## Design tokens
- All Sonny screens read the DS core (`src/styles/tokens.css`) plus `src/styles/theme-sonny.css`, which only overrides `--brand` and `--chart-*` for product colors (orb gold, channel pictures, the character). Shades and transparency come from `color-mix()`. The theme is scoped to `.tv-root`, `.orb-root`, `.rm-root` and imported by those pages, so the family app keeps the plain core.
- Check: `grep -rnoE '#[0-9a-fA-F]{3,8}\b|rgba?\(' src/app/tv src/components/orb src/app/remote` gives 0. Hex lives only in `theme-sonny.css` and `src/app/manifest.ts` (`THEME_COLOR`, manifest needs hex).
- Contrast on the orb (390 px, measured): Start 15.4:1, faint caption 6.4:1, grandma's words 7.2:1.
