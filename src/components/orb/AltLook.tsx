"use client";

// Extra looks for the owner to compare (?look=wave | bars | glow). Written from scratch for
// this repo, inspired by common voice-agent visuals (a soft waveform, rounded level bars,
// a breathing gradient orb); no outside code. Same signal as the particle orb: state, mic
// pulse and the real voice level. Colors come from theme-sonny.css tokens.

import { useEffect, useRef } from "react";
import { speechEnvelope, type OrbMode, type OrbSignal } from "./ParticleOrb";

export type AltLookName = "wave" | "bars" | "glow";

function token(el: HTMLElement, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || "white";
}

// Smoothly eased state values shared by the three looks.
type Live = { energy: number; spin: number; size: number; voice: number };
const GOAL: Record<OrbMode, Omit<Live, "voice">> = {
  idle: { energy: 0.25, spin: 0.25, size: 1 },
  listening: { energy: 0.45, spin: 0.4, size: 0.8 },
  thinking: { energy: 0.3, spin: 1.6, size: 0.85 },
  speaking: { energy: 0.6, spin: 0.6, size: 1.05 },
};

export function AltLook({ look, signal }: { look: AltLookName; signal: React.RefObject<OrbSignal> }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const c = {
      brand: token(canvas, "--brand"),
      light: token(canvas, "--chart-1"),
      amber: token(canvas, "--chart-7"),
      rose: token(canvas, "--chart-14"),
      cool: token(canvas, "--chart-2"),
    };
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const live: Live = { ...GOAL.idle, voice: 0 };
    let phase = 0;
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      const s = signal.current;
      const goal = GOAL[s.mode];
      const ease = 1 - Math.exp(-dt * 4);
      live.energy += (goal.energy - live.energy) * ease;
      live.spin += (goal.spin - live.spin) * ease;
      live.size += (goal.size - live.size) * ease;
      s.pulse = Math.max(0, s.pulse - dt * 1.6);
      const raw = s.mode === "speaking" ? s.level?.() ?? speechEnvelope(t) : s.mode === "listening" ? s.pulse * 0.6 : 0;
      live.voice += (raw - live.voice) * (1 - Math.exp(-dt * (raw > live.voice ? 25 : 8)));
      const motion = reduced ? 0.3 : 1;
      phase += live.spin * dt * motion;

      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const unit = Math.min(w, h);

      if (look === "wave") {
        // Three soft bands across the middle; amplitude follows the voice, thinking scrolls.
        const span = unit * 0.8 * live.size;
        const bands: [string, number, number][] = [
          [c.brand, 1, 0],
          [c.amber, 0.7, 1.3],
          [c.light, 0.45, 2.6],
        ];
        ctx.lineCap = "round";
        for (const [color, weight, offset] of bands) {
          const amp = unit * (0.02 + live.energy * 0.04 + live.voice * 0.16) * weight;
          ctx.beginPath();
          for (let i = 0; i <= 120; i++) {
            const u = i / 120;
            const x = cx - span / 2 + u * span;
            const env = Math.sin(Math.PI * u) ** 2; // taper at both ends
            const y = cy + Math.sin(u * Math.PI * 3 + phase * 3 + offset) * amp * env;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.35 + 0.5 * weight;
          ctx.lineWidth = Math.max(2, unit * 0.012 * weight);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (look === "bars") {
        // Five rounded bars; thinking runs a slow sweep, speaking and listening follow the level.
        const n = 5;
        const bw = unit * 0.075;
        const gap = bw * 0.7;
        const maxH = unit * 0.42 * live.size;
        const shape = [0.55, 0.8, 1, 0.8, 0.55];
        ctx.fillStyle = c.brand;
        for (let i = 0; i < n; i++) {
          let k: number;
          if (s.mode === "thinking") k = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(phase * 3 - i * 0.9));
          else if (s.mode === "idle") k = 0.18 + 0.06 * Math.sin(t * 1.4 + i * 0.6) * motion;
          else k = 0.18 + live.voice * shape[i] * (0.85 + 0.15 * Math.sin(t * 9 + i * 1.7));
          const bh = Math.max(bw, maxH * Math.min(1, k));
          const x = cx + (i - (n - 1) / 2) * (bw + gap) - bw / 2;
          ctx.globalAlpha = s.mode === "idle" ? 0.7 : 1;
          ctx.beginPath();
          ctx.roundRect(x, cy - bh / 2, bw, bh, bw / 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        // A soft gradient sphere that breathes; its warm colors drift around the center.
        const breath = s.mode === "idle" ? Math.sin(t * 0.9) * 0.03 * motion : 0;
        const r = unit * 0.26 * (live.size + breath + live.voice * 0.18);
        const a = phase * 1.4;
        const hx = cx + Math.cos(a) * r * 0.35;
        const hy = cy + Math.sin(a) * r * 0.35;
        const g = ctx.createRadialGradient(hx, hy, r * 0.05, cx, cy, r);
        g.addColorStop(0, c.light);
        g.addColorStop(0.45, c.brand);
        g.addColorStop(0.8, s.mode === "listening" ? c.cool : c.amber);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        const g2 = ctx.createRadialGradient(cx - (hx - cx), cy - (hy - cy), 0, cx, cy, r);
        g2.addColorStop(0, c.rose);
        g2.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [look, signal]);

  return <canvas ref={ref} className="orb-canvas" aria-hidden />;
}
