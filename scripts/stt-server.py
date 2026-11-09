"""Local speech-to-text server for hyodo-tv.

Fallback for browsers where Web Speech is unavailable (e.g. iPhone home-screen web apps).
Loads faster-whisper `small.en` once and keeps it in memory.

Run:
  /Users/makim/.claude/skills/faster-whisper/.venv/bin/python scripts/stt-server.py

Endpoints (127.0.0.1:3201):
  GET  /health      -> {"ok": true, "model": "..."}
  POST /transcribe  -> raw audio body (wav, webm, mp4/m4a, ogg) -> {"text": "...", "ms": 123}
  POST /turn        -> recent audio of the current turn (up to 8 s used)
                       -> {"complete": true, "prob": 0.93, "ms": 40}

/turn uses pipecat-ai/smart-turn v3.2 (BSD-2, int8 ONNX, Whisper Tiny backbone) to judge from
the audio itself whether the speaker has finished, so long pauses ("um... so...") are not cut.
Preprocessing follows smart-turn inference.py: keep the last 8 s, zero-pad at the start,
zero-mean unit-variance normalize, Whisper log-mel (80 x 800).
"""

import json
import os
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import onnxruntime as ort
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio
from faster_whisper.feature_extractor import FeatureExtractor
from huggingface_hub import hf_hub_download

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
TURN_REPO = "pipecat-ai/smart-turn-v3"
TURN_FILE = os.environ.get("TURN_MODEL_FILE", "smart-turn-v3.2-cpu.onnx")
TURN_THRESHOLD = float(os.environ.get("TURN_THRESHOLD", "0.5"))
SR = 16000
TURN_SAMPLES = 8 * SR

_t0 = time.perf_counter()
_turn_path = hf_hub_download(TURN_REPO, TURN_FILE)  # cached after the first run
_so = ort.SessionOptions()
_so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
_so.inter_op_num_threads = 1
_so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
TURN_SESSION = ort.InferenceSession(_turn_path, sess_options=_so)
# Same Slaney mel filters as Whisper / transformers WhisperFeatureExtractor (80 bins, n_fft 400).
MEL_FILTERS = FeatureExtractor(feature_size=80, chunk_length=8).mel_filters  # (80, 201)
# Periodic Hann window, as in transformers window_function(400, "hann").
WINDOW = (0.5 - 0.5 * np.cos(2 * np.pi * np.arange(400) / 400)).astype(np.float32)
TURN_LOCK = threading.Lock()
print(f"[stt] smart-turn {TURN_FILE} ready in {(time.perf_counter() - _t0):.1f}s", flush=True)


def turn_features(audio: np.ndarray) -> np.ndarray:
    """Replicates transformers WhisperFeatureExtractor(chunk_length=8, do_normalize=True)."""
    audio = audio.astype(np.float32)
    if len(audio) > TURN_SAMPLES:
        audio = audio[-TURN_SAMPLES:]
    elif len(audio) < TURN_SAMPLES:
        audio = np.pad(audio, (TURN_SAMPLES - len(audio), 0))
    audio = (audio - audio.mean()) / np.sqrt(audio.var() + 1e-7)
    padded = np.pad(audio, (200, 200), mode="reflect")  # center=True
    n_frames = 1 + (len(padded) - 400) // 160
    frames = np.lib.stride_tricks.as_strided(
        padded, (n_frames, 400), (padded.strides[0] * 160, padded.strides[0])
    )
    power = np.abs(np.fft.rfft(frames * WINDOW, n=400, axis=-1)) ** 2  # (frames, 201)
    mel = MEL_FILTERS @ power.T  # (80, frames)
    log_spec = np.log10(np.maximum(mel, 1e-10))[:, :-1]  # drop last frame -> 800
    log_spec = np.maximum(log_spec, log_spec.max() - 8.0)
    return ((log_spec + 4.0) / 4.0).astype(np.float32)[None, :, :]


def predict_turn(audio: np.ndarray) -> float:
    with TURN_LOCK:
        out = TURN_SESSION.run(None, {"input_features": turn_features(audio)})
    value = float(np.asarray(out[0]).reshape(-1)[0])
    if not 0.0 <= value <= 1.0:  # guard in case a model build returns raw logits
        value = 1.0 / (1.0 + np.exp(-value))
    return value


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
        if self.path not in ("/transcribe", "/turn"):
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
            if self.path == "/turn":
                audio = decode_audio(path, sampling_rate=SR)
                if len(audio) < SR // 4:
                    raise ValueError("need at least 0.25 s of audio")
                prob = predict_turn(audio)
                ms = round((time.perf_counter() - started) * 1000)
                self._json(200, {"complete": prob > TURN_THRESHOLD, "prob": round(prob, 4), "ms": ms})
                return
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
