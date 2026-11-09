# Server speech-to-text (STT) fallback

Why: in an iPhone home-screen web app, browser speech recognition (Web Speech) can be unavailable. The screen then records a spoken turn and posts it to `/api/stt`, which transcribes it on this Mac with faster-whisper.

## Run

```bash
/Users/makim/.claude/skills/faster-whisper/.venv/bin/python scripts/stt-server.py
```

Starts on `127.0.0.1:3201`, loads `Systran/faster-whisper-small.en` from the local Hugging Face cache once (about 1 s) and keeps it in memory. Add `HF_HUB_OFFLINE=1` in front to avoid any network check on slow Wi-Fi.

## API

`POST /api/stt` with the raw audio as the body and its type in `Content-Type` (`audio/wav`, `audio/webm`, `audio/mp4`, `audio/ogg`).

| Case | Status | Body |
|---|---|---|
| OK | 200 | `{ "text": "...", "ms": 1270 }` (ms = round trip seen by the app) |
| Empty body | 400 | `{ "error": "empty audio" }` |
| Over 10 MB | 413 | `{ "error": "audio too large" }` |
| STT server not running | 503 | `{ "error": "stt server unavailable", "reason": "..." }` |
| Audio not decodable | 422 | `{ "error": "could not transcribe: ..." }` |

The STT server itself: `GET /health`, `POST /transcribe` (same body, returns `{ text, ms }`). Override with `STT_URL`, `STT_PORT`, `STT_MODEL`.

## Measured (2026-11-09, this Mac, CPU int8)

Test clip: 3.0 s English sentence, "Remind me to take my pills at eight tomorrow morning." (macOS `say`, 16 kHz mono).

| Path | Format | Result | Time |
|---|---|---|---|
| `scripts/stt-server.py` direct, 3 runs | wav | exact text ("at 8") | 1237 to 1374 ms |
| `scripts/stt-server.py` direct | webm (opus) | exact text | 1453 ms |
| `/api/stt` via Next dev, 3 runs | wav, webm, wav | exact text | 1168 to 1483 ms |
| `/api/stt` with STT server stopped | wav | 503 with reason | immediate |

Expect about 1.2 to 1.5 s per short turn. Real speech from an older speaker in a noisy room is not measured yet.
