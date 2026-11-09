"use client";

// Two retro faces for the owner to compare, drawn from scratch in SVG. They borrow only a
// period style older people know, never a real character:
//   ?look=smiley   1970s "have a nice day" button: flat yellow, two oval eyes, a thin smile
//                  that opens like a mouth with the real voice level.
//   ?look=classic  1930s rubber-hose cartoon style: pie-cut eyes, one small shine,
//                  squash and stretch while talking. No ears, gloves or tails.
// Same signal as the orb (state, mic pulse, voice level, joy). Colors are theme tokens.

import { useEffect, useRef } from "react";
import { speechEnvelope, type OrbSignal } from "./ParticleOrb";

export type FaceLookName = "smiley" | "classic";

// Point on an ellipse at an angle (degrees, 0 = right, clockwise in SVG space).
function at(cx: number, cy: number, rx: number, ry: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return `${(cx + rx * Math.cos(a)).toFixed(1)} ${(cy + ry * Math.sin(a)).toFixed(1)}`;
}

// A filled oval with a pie slice cut out between two angles (the classic cartoon eye).
function pieEye(cx: number, cy: number, rx: number, ry: number, from: number, to: number) {
  return `M${cx} ${cy} L${at(cx, cy, rx, ry, to)} A${rx} ${ry} 0 1 1 ${at(cx, cy, rx, ry, from)} Z`;
}

export function FaceLook({ look, signal }: { look: FaceLookName; signal: React.RefObject<OrbSignal> }) {
  const body = useRef<SVGGElement | null>(null);
  const eyes = useRef<SVGGElement | null>(null);
  const mouth = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let voice = 0;
    let wide = 0; // listening: eyes open a little wider
    let look_up = 0; // thinking: eyes glance up
    let nextBlink = performance.now() + 3000 + Math.random() * 2000;
    let blinkUntil = 0;
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      const s = signal.current;
      const ease = 1 - Math.exp(-dt * 6);
      const raw = s.mode === "speaking" ? s.level?.() ?? speechEnvelope(t) : 0;
      voice += (raw - voice) * (1 - Math.exp(-dt * (raw > voice ? 30 : 12)));
      wide += ((s.mode === "listening" ? 1 : 0) - wide) * ease;
      look_up += ((s.mode === "thinking" ? 1 : 0) - look_up) * ease;
      s.pulse = Math.max(0, s.pulse - dt * 1.6);
      s.joy = Math.max(0, (s.joy ?? 0) - dt * 0.9);
      const joy = s.joy ?? 0;
      const hop = Math.sin((1 - joy) * Math.PI) * joy;
      const motion = reduced ? 0.3 : 1;

      // Blink every 3 to 5 seconds.
      if (now > nextBlink) {
        blinkUntil = now + 130;
        nextBlink = now + 3000 + Math.random() * 2000;
      }
      const blink = now < blinkUntil ? 0.1 : 1;

      // Body: breathe when idle, sway when thinking, squash and stretch with the voice.
      const breath = s.mode === "idle" ? Math.sin(t * 1.4) * 0.015 * motion : 0;
      const bounce = look === "classic" ? voice * 0.12 * Math.sin(t * 14) * motion : voice * 0.03;
      const sx = 1 + breath - bounce * 0.6;
      const sy = 1 + breath + bounce;
      const sway = s.mode === "thinking" ? Math.sin(t * 1.6) * 5 * motion : s.mode === "listening" ? -4 * wide : 0;
      body.current?.setAttribute(
        "transform",
        `translate(100 ${100 - hop * 22 * motion}) rotate(${sway.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(-100 -100)`,
      );
      const eyeScale = (1 + wide * 0.18) * blink;
      eyes.current?.setAttribute(
        "transform",
        `translate(0 ${(-7 * look_up).toFixed(2)}) translate(100 82) scale(${(1 + wide * 0.18).toFixed(3)} ${eyeScale.toFixed(3)}) translate(-100 -82)`,
      );

      // Mouth: a thin smile that opens with the voice.
      const open = Math.min(1, voice * 1.4);
      const m = mouth.current;
      if (m) {
        if (open > 0.04) {
          // The top lip keeps the smile's curve; the bottom drops with the voice.
          const top = 138 - open * 8;
          const bottom = 146 + open * (look === "classic" ? 36 : 30);
          m.setAttribute("d", `M58 124 Q100 ${top} 142 124 Q100 ${bottom} 58 124 Z`);
          m.setAttribute("class", "face-mouth is-open");
        } else {
          m.setAttribute("d", look === "classic" ? "M60 122 Q100 158 140 122" : "M56 120 Q100 156 144 120");
          m.setAttribute("class", "face-mouth");
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [look, signal]);

  return (
    <svg className={`face-look is-${look}`} viewBox="0 0 200 200" aria-hidden>
      <g ref={body}>
        <circle className="face-skin" cx="100" cy="100" r="90" />
        {look === "classic" && <ellipse className="face-shine" cx="62" cy="58" rx="11" ry="7" transform="rotate(-30 62 58)" />}
        <g ref={eyes}>
          {look === "smiley" ? (
            <>
              <ellipse className="face-ink" cx="72" cy="82" rx="8" ry="14" />
              <ellipse className="face-ink" cx="128" cy="82" rx="8" ry="14" />
            </>
          ) : (
            <>
              <ellipse className="face-white" cx="74" cy="80" rx="15" ry="22" />
              <ellipse className="face-white" cx="126" cy="80" rx="15" ry="22" />
              <path className="face-ink" d={pieEye(76, 86, 9, 14, -70, -25)} />
              <path className="face-ink" d={pieEye(128, 86, 9, 14, -70, -25)} />
            </>
          )}
        </g>
        <path ref={mouth} className="face-mouth" d="M56 120 Q100 156 144 120" />
      </g>
    </svg>
  );
}
