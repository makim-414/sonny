"""Local speech-to-text server for hyodo-tv.

Fallback for browsers where Web Speech is unavailable (e.g. iPhone home-screen web apps).
Loads faster-whisper `small.en` once and keeps it in memory.

Run:
  /Users/makim/.claude/skills/faster-whisper/.venv/bin/python scripts/stt-server.py

Endpoints (127.0.0.1:3201):
  GET  /health      -> {"ok": true, "model": "..."}
  POST /transcribe  -> raw audio body (wav, webm, mp4/m4a, ogg) -> {"text": "...", "ms": 123}
"""

import json
import os
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from faster_whisper import WhisperModel

HOST = "127.0.0.1"
PORT = int(os.environ.get("STT_PORT", "3201"))
MODEL_NAME = os.environ.get("STT_MODEL", "small.en")
MAX_BYTES = 10 * 1024 * 1024  # 10 MB is far more than one spoken turn

SUFFIX_BY_TYPE = {
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "audio/m4a": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/mpeg": ".mp3",
}

print(f"[stt] loading faster-whisper {MODEL_NAME} ...", flush=True)
_t0 = time.perf_counter()
MODEL = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
print(f"[stt] model ready in {(time.perf_counter() - _t0):.1f}s", flush=True)
# CTranslate2 models are not safe to call from many threads at once on CPU; serialize.
LOCK = threading.Lock()


def transcribe(path: str) -> str:
    with LOCK:
        segments, _info = MODEL.transcribe(
            path,
            language="en",
            beam_size=1,
            vad_filter=True,
            condition_on_previous_text=False,
        )
        return " ".join(s.text.strip() for s in segments).strip()


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._json(200, {"ok": True, "model": MODEL_NAME})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/transcribe":
            self._json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            self._json(400, {"error": "empty body"})
            return
        if length > MAX_BYTES:
            self._json(413, {"error": "audio too large"})
            return
        data = self.rfile.read(length)
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        suffix = SUFFIX_BY_TYPE.get(ctype, ".bin")
        started = time.perf_counter()
        fd, path = tempfile.mkstemp(suffix=suffix, prefix="stt-")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(data)
            text = transcribe(path)
        except Exception as exc:  # decode or model failure
            self._json(422, {"error": f"could not transcribe: {exc}"})
            return
        finally:
            try:
                os.remove(path)
            except OSError:
                pass
        ms = round((time.perf_counter() - started) * 1000)
        self._json(200, {"text": text, "ms": ms})

    def log_message(self, fmt: str, *args) -> None:
        print(f"[stt] {self.address_string()} {fmt % args}", flush=True)


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[stt] listening on http://{HOST}:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
