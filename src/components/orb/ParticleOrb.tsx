"use client";

import { useEffect, useRef } from "react";

export type OrbMode = "idle" | "listening" | "thinking" | "speaking";

// Live inputs the canvas reads every frame without React re-renders.
export type OrbSignal = {
  mode: OrbMode;
  // 0..1, bumped by speech activity (interim results while listening); decays by itself.
  pulse: number;
  // Real loudness of the assistant's voice (WebAudio analyser), or null when unknown.
  level?: () => number | null;
  // 0..1 impulse for a happy moment (thanks, something learned); decays by itself.
  joy?: number;
};

// lean: extra forward tilt (radians) so listening reads as "leaning in".
export type Target = { radius: number; spin: number; wobble: number; spread: number; lean: number };

// How each state looks. The canvas eases toward these so changes are smooth.
export const TARGETS: Record<OrbMode, Target> = {
  idle: { radius: 1.0, spin: 0.1, wobble: 0.035, spread: 0, lean: 0 },
  listening: { radius: 0.56, spin: 0.12, wobble: 0.015, spread: 0, lean: 0.45 },
  thinking: { radius: 0.6, spin: 0.7, wobble: 0.01, spread: 0, lean: 0 },
  speaking: { radius: 1.08, spin: 0.28, wobble: 0.05, spread: 1, lean: 0 },
};

const COUNT_DESKTOP = 1400;
const GLOW_ALPHA = 0.16;
const COUNT_PHONE = 1000;

// Colors live as CSS tokens in orb.css; the canvas reads them once.
function readColor(el: HTMLElement, name: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || "white";
}

// Browser speechSynthesis gives no volume, so this rhythm is only the fallback.
export function speechEnvelope(t: number) {
  const syllables = Math.abs(Math.sin(t * 7.1) * Math.sin(t * 2.3 + 0.7));
  const phrase = 0.6 + 0.4 * Math.sin(t * 0.9);
  return 0.25 + 0.75 * syllables * phrase;
}

export function ParticleOrb({ signal }: { signal: React.RefObject<OrbSignal> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phone = Math.min(window.innerWidth, window.innerHeight) < 600;
    const n = phone ? COUNT_PHONE : COUNT_DESKTOP;
    const core = readColor(canvas, "--orb-core");
    const edge = readColor(canvas, "--orb-edge");
    const glow = readColor(canvas, "--orb-glow");

    // Points on a sphere (Fibonacci lattice) plus a per-particle phase.
    const px = new Float32Array(n);
    const py = new Float32Array(n);
    const pz = new Float32Array(n);
    const phase = new Float32Array(n);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      px[i] = Math.cos(th) * r;
      py[i] = y;
      pz[i] = Math.sin(th) * r;
      phase[i] = Math.random() * Math.PI * 2;
    }

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const cur: Target = { ...TARGETS.idle };
    let angle = 0;
    let voice = 0; // smoothed voice loudness
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      const s = signal.current;
      const goal = TARGETS[s.mode];
      const ease = 1 - Math.exp(-dt * 4);
      cur.radius += (goal.radius - cur.radius) * ease;
      cur.spin += (goal.spin - cur.spin) * ease;
      cur.wobble += (goal.wobble - cur.wobble) * ease;
      cur.spread += (goal.spread - cur.spread) * ease;
      cur.lean += (goal.lean - cur.lean) * ease;
      s.pulse = Math.max(0, s.pulse - dt * 1.6);
      s.joy = Math.max(0, (s.joy ?? 0) - dt * 0.9);
      const joy = s.joy ?? 0;
      // Joy: one hop up (half a sine over the impulse) and a brighter orb.
      const hop = Math.sin((1 - joy) * Math.PI) * joy;

      const motion = reduced ? 0.25 : 1;
      angle += cur.spin * dt * motion;
      const breath = s.mode === "idle" ? Math.sin(t * 0.9) * 0.04 * motion : 0;
      let talk = 0;
      if (s.mode === "speaking") {
        const real = s.level?.() ?? null;
        const raw = real ?? speechEnvelope(t);
        voice += (raw - voice) * (1 - Math.exp(-dt * (raw > voice ? 30 : 10)));
        talk = voice;
      } else {
        voice *= 0.9;
      }
      const tremble = s.mode === "listening" ? s.pulse * 0.12 : 0;

      const base = Math.min(w, h) * 0.3 * (cur.radius + breath + talk * 0.12 * motion);
      const cx = w / 2;
      const cy = h / 2 - hop * Math.min(w, h) * 0.12 * motion;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const tilt = 0.35 + cur.lean;
      const cosT = Math.cos(tilt);
      const sinT = Math.sin(tilt);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Soft glow behind the orb (brand color, faded here so the token stays a plain color).
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 1.9);
      g.addColorStop(0, glow);
      g.addColorStop(1, "transparent");
      ctx.globalAlpha = GLOW_ALPHA;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;

      const dot = Math.max(1.2, Math.min(w, h) / 420);
      for (let i = 0; i < n; i++) {
        // Rotate around Y, then tilt around X.
        let x = px[i] * cosA - pz[i] * sinA;
        let z = px[i] * sinA + pz[i] * cosA;
        let y = py[i];
        const y2 = y * cosT - z * sinT;
        z = y * sinT + z * cosT;
        y = y2;

        const ph = phase[i];
        const wob = cur.wobble * Math.sin(t * 1.3 + ph) * motion;
        const wave = cur.spread * talk * 0.28 * Math.sin(ph * 3 + t * 6 + y * 4) * motion;
        const jit = tremble * Math.sin(t * 40 + ph * 7) * motion;
        const r = 1 + wob + wave + jit;
        x *= r;
        y *= r;
        z *= r;

        const persp = 1 / (1.9 - z * 0.6);
        const sx = cx + x * base * persp * 1.6;
        const sy = cy + y * base * persp * 1.6;
        const depth = (z + 1) / 2; // 0 back .. 1 front
        ctx.globalAlpha = Math.min(1, (0.18 + depth * 0.8) * (1 + joy * 0.6));
        ctx.fillStyle = depth > 0.45 ? core : edge;
        const size = dot * (0.6 + depth * 0.9);
        ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [signal]);

  return <canvas ref={canvasRef} className="orb-canvas" aria-hidden />;
}
