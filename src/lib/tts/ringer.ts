"use client";

// Phone ringtone for "Sonny is calling": the classic 440 + 480 Hz pair, 2 s on, 4 s off,
// plus vibration where the phone allows it. Needs the earlier Start tap to have unlocked audio.

const ON_MS = 2000;
const CYCLE_MS = 6000;
const LEVEL = 0.12;

let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
let oscs: OscillatorNode[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

function burst() {
  if (!ctx || !gain) return;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(LEVEL, t + 0.05);
  gain.gain.setValueAtTime(LEVEL, t + ON_MS / 1000 - 0.05);
  gain.gain.linearRampToValueAtTime(0, t + ON_MS / 1000);
  navigator.vibrate?.([800, 300, 800]);
}

export function startRing() {
  stopRing();
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      ctx = new AC();
      gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      oscs = [440, 480].map((f) => {
        const o = ctx!.createOscillator();
        o.frequency.value = f;
        o.connect(gain!);
        o.start();
        return o;
      });
      if (ctx.state === "suspended") void ctx.resume();
    }
  } catch {
    // no sound: vibration and the screen still ring
  }
  burst();
  timer = setInterval(burst, CYCLE_MS);
}

export function stopRing() {
  if (timer) clearInterval(timer);
  timer = null;
  navigator.vibrate?.(0);
  for (const o of oscs) {
    try {
      o.stop();
    } catch {
      // already stopped
    }
  }
  oscs = [];
  void ctx?.close().catch(() => {});
  ctx = null;
  gain = null;
}
