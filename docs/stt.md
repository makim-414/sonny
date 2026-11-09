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

# Turn end detection (smart-turn)

Why: older speakers pause mid-sentence ("I want to... um..."). A loudness-only VAD ends the turn at that pause. `/api/turn` asks a small audio model whether the speaker has actually finished, so the screen can keep listening.

Model: [pipecat-ai/smart-turn](https://github.com/pipecat-ai/smart-turn) v3.2, CPU int8 ONNX (`pipecat-ai/smart-turn-v3` on Hugging Face, file `smart-turn-v3.2-cpu.onnx`, 8.7 MB, BSD-2). Downloaded once by `hf_hub_download` into the local HF cache, then loaded by the same `scripts/stt-server.py` (no extra process). Preprocessing follows smart-turn `inference.py`: last 8 s of 16 kHz mono, zero-pad at the start, zero-mean unit-variance normalize, Whisper log-mel 80 x 800. The mel step is reimplemented in numpy (same Slaney filters as Whisper) so `transformers` is not needed.

## API

`POST /api/turn` with the current turn's audio as the body (`audio/wav` or `audio/webm`, 16 kHz preferred, any length; the last 8 s are used, minimum 0.25 s).

| Case | Status | Body |
|---|---|---|
| OK | 200 | `{ "complete": true, "prob": 0.98, "ms": 63 }` (complete = prob > 0.5, ms = round trip) |
| Empty body | 400 | `{ "error": "empty audio" }` |
| STT server not running | 503 | `{ "error": "turn server unavailable", "reason": "..." }` |
| Too short or undecodable | 422 | `{ "error": "..." }` |

Threshold override: `TURN_THRESHOLD` (default 0.5). Model override: `TURN_MODEL_FILE`.

Screen side (TV session): when the VAD hears about 0.7 s of silence, post the whole turn so far to `/api/turn`; if `complete` is false keep listening up to 4 s more, then re-ask with the longer audio.

## Measured (2026-11-09, this Mac, CPU)

Test clips: macOS `say` (Samantha), 16 kHz mono. "Incomplete" clips end with a 0.9 s silence after the filler.

| Clip | Format | complete | prob | Time |
|---|---|---|---|---|
| "I can't seem to find the return label for my package." | wav | true | 0.9801 | 63 ms (server), 57 to 82 ms via `/api/turn` |
| "What is the weather like today?" | wav | true | 0.9619 | 56 ms |
| "Remind me to take my pills at eight tomorrow morning." | wav | true | 0.9836 | 69 ms |
| "I can't seem to, um..." | wav | false | 0.0059 | 67 ms |
| "I want to... um..." | wav | false | 0.0064 | 72 ms (server), 62 ms via `/api/turn` |
| "I want to... um..." | webm (opus) | false | 0.0075 | 64 ms via `/api/turn` |
| STT server stopped | wav | 503 with reason | | immediate |

All clips were synthetic speech. Real older speakers, Korean, and room noise are not measured yet.
