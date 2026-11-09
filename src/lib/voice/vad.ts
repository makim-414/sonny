"use client";

// Hands-free turn taking with Silero VAD (@ricky0123/vad-web). It only decides when grandma
// starts and stops talking; the words still come from Web Speech. Assets come from /api/tts/vad/.

const ASSETS = "/api/tts/vad/";

export type Vad = { start(): void; pause(): void; destroy(): void; setSilenceMs(ms: number): void };

export type VadOptions = { redemptionMs: number };

export type VadHandlers = {
  onSpeechStart: () => void;
  // 16 kHz mono samples of the whole utterance.
  onSpeechEnd: (audio: Float32Array) => void;
  onMisfire?: () => void;
  // Mic loudness of each ~30 ms frame, 0..1, for the orb's tremble.
  onLevel?: (level: number) => void;
};

export async function createVad(h: VadHandlers, o: VadOptions): Promise<Vad | null> {
  try {
    const { MicVAD } = await import("@ricky0123/vad-web");
    const vad = await MicVAD.new({
      model: "v5",
      baseAssetPath: ASSETS,
      onnxWASMBasePath: ASSETS,
      startOnLoad: false,
      positiveSpeechThreshold: 0.6,
      negativeSpeechThreshold: 0.45,
      redemptionMs: o.redemptionMs, // silence that ends a turn
      preSpeechPadMs: 200,
      minSpeechMs: 250,
      onSpeechStart: h.onSpeechStart,
      onSpeechEnd: (audio) => h.onSpeechEnd(audio),
      onVADMisfire: () => h.onMisfire?.(),
      onFrameProcessed: (_probs, frame) => {
        if (!h.onLevel) return;
        let sum = 0;
        for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
        h.onLevel(Math.min(1, Math.sqrt(sum / frame.length) * 8));
      },
    });
    return {
      start: () => void vad.start(),
      pause: () => void vad.pause(),
      destroy: () => void vad.destroy(),
      setSilenceMs: (ms) => vad.setOptions({ redemptionMs: ms }),
    };
  } catch (err) {
    console.warn("[vad] unavailable, falling back to Web Speech end-of-turn", err);
    return null;
  }
}
