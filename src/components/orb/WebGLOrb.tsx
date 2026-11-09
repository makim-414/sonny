"use client";

// The particle orb drawn with raw WebGL (no three.js), written from scratch for this repo.
// Technique: the points sit on a Fibonacci sphere computed once at start; all motion
// (spin, breathing, wobble, the speaking ripple, the listening tremble) happens in the
// vertex shader with a few cheap sines; one additive draw call per frame, no float render
// targets. Same signal API as the canvas 2D ParticleOrb so the two swap freely.

import { useEffect, useRef } from "react";
import { TARGETS, speechEnvelope, type OrbSignal, type Target } from "./ParticleOrb";

const COUNT_DESKTOP = 1500;
const COUNT_PHONE = 1100;

const VERT = `
attribute vec3 a_pos;
attribute float a_seed;
uniform float u_time, u_angle, u_tilt, u_scale, u_wobble, u_wave, u_tremble, u_dot, u_aspect, u_lift;
varying float v_depth;
void main() {
  vec3 p = a_pos;
  float ca = cos(u_angle), sa = sin(u_angle);
  p = vec3(p.x * ca - p.z * sa, p.y, p.x * sa + p.z * ca);
  float ct = cos(u_tilt), st = sin(u_tilt);
  p = vec3(p.x, p.y * ct - p.z * st, p.y * st + p.z * ct);
  // Cheap noise: a couple of sines keyed by each point's seed and position.
  float r = 1.0
    + u_wobble * sin(u_time * 1.3 + a_seed)
    + u_wave * sin(a_seed * 3.0 + u_time * 6.0 + p.y * 4.0)
    + u_tremble * sin(u_time * 40.0 + a_seed * 7.0);
  p *= r;
  float persp = 1.0 / (1.9 - p.z * 0.6);
  v_depth = (p.z + 1.0) * 0.5;
  gl_Position = vec4(p.x * u_scale * persp / u_aspect, p.y * u_scale * persp + u_lift, 0.0, 1.0);
  gl_PointSize = u_dot * (0.7 + v_depth * 1.1);
}`;

const FRAG = `
precision mediump float;
uniform vec3 u_core, u_edge;
uniform float u_glow;
varying float v_depth;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = min(1.0, smoothstep(0.5, 0.1, d) * (0.18 + v_depth * 0.8) * u_glow);
  gl_FragColor = vec4(mix(u_edge, u_core, smoothstep(0.3, 0.6, v_depth)) * a, a);
}`;

// Any CSS color (hex, oklch, color-mix) to linear-ish RGB floats via a 1x1 canvas.
function cssColor(el: HTMLElement, name: string): [number, number, number] {
  const c = document.createElement("canvas").getContext("2d");
  if (!c) return [1, 1, 1];
  c.fillStyle = getComputedStyle(el).getPropertyValue(name).trim() || "white";
  c.fillRect(0, 0, 1, 1);
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
}

// True when this browser can run the orb shaders.
export function canUseWebGL(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    return !!gl && !!compile(gl, gl.VERTEX_SHADER, VERT) && !!compile(gl, gl.FRAGMENT_SHADER, FRAG);
  } catch {
    return false;
  }
}

export function WebGLOrb({ signal, onFail }: { signal: React.RefObject<OrbSignal>; onFail: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: true });
    if (!canvas || !gl) {
      onFail();
      return;
    }
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) {
      onFail();
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      onFail();
      return;
    }
    gl.useProgram(prog);

    // Points on a Fibonacci sphere, computed once. 4 floats each: x, y, z, seed.
    const phone = Math.min(window.innerWidth, window.innerHeight) < 600;
    const n = phone ? COUNT_PHONE : COUNT_DESKTOP;
    const data = new Float32Array(n * 4);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      data[i * 4] = Math.cos(golden * i) * r;
      data[i * 4 + 1] = y;
      data[i * 4 + 2] = Math.sin(golden * i) * r;
      data[i * 4 + 3] = Math.random() * Math.PI * 2;
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    const aSeed = gl.getAttribLocation(prog, "a_seed");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aSeed);
    gl.vertexAttribPointer(aSeed, 1, gl.FLOAT, false, 16, 12);

    const u = (name: string) => gl.getUniformLocation(prog, name);
    const U = {
      time: u("u_time"), angle: u("u_angle"), tilt: u("u_tilt"), scale: u("u_scale"), wobble: u("u_wobble"),
      wave: u("u_wave"), tremble: u("u_tremble"), dot: u("u_dot"), aspect: u("u_aspect"), core: u("u_core"), edge: u("u_edge"),
      lift: u("u_lift"), glow: u("u_glow"),
    };
    // Core is the brand gold lifted toward white; the far side takes the cool chart-2.
    const brand = cssColor(canvas, "--brand");
    gl.uniform3f(U.core, ...(brand.map((c) => c + (1 - c) * 0.45) as [number, number, number]));
    gl.uniform3fv(U.edge, cssColor(canvas, "--chart-2"));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // additive glow on the dark screen
    gl.clearColor(0, 0, 0, 0);

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(U.aspect, w / Math.max(1, h));
      gl.uniform1f(U.dot, Math.max(1.6, Math.min(w, h) / 300) * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const cur: Target = { ...TARGETS.idle };
    let angle = 0;
    let voice = 0;
    let last = performance.now();
    let raf = 0;
    let visible = true;

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return; // resumes on visibility change
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
      const hop = Math.sin((1 - joy) * Math.PI) * joy; // one hop up over the impulse
      angle += cur.spin * dt;
      if (s.mode === "speaking") {
        const raw = s.level?.() ?? speechEnvelope(t);
        voice += (raw - voice) * (1 - Math.exp(-dt * (raw > voice ? 30 : 10)));
      } else voice *= 0.9;
      const breath = s.mode === "idle" ? Math.sin(t * 0.9) * 0.04 : 0;
      // Same size as the 2D orb: 0.3 of the short side, times the perspective boost.
      const short = Math.min(w, h * 0.8); // leave room for the Start button on wide screens
      const scale = ((short * 0.3 * (cur.radius + breath + voice * 0.12)) / (h / 2)) * 1.6;

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(U.time, t);
      gl.uniform1f(U.angle, angle);
      gl.uniform1f(U.scale, scale);
      gl.uniform1f(U.wobble, cur.wobble);
      gl.uniform1f(U.wave, cur.spread * voice * 0.28);
      gl.uniform1f(U.tremble, s.mode === "listening" ? s.pulse * 0.12 : 0);
      gl.uniform1f(U.tilt, 0.35 + cur.lean); // listening leans in toward her
      gl.uniform1f(U.lift, hop * 0.24);
      gl.uniform1f(U.glow, 1 + joy * 0.6);
      gl.drawArrays(gl.POINTS, 0, n);
      raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    kick();

    // Stop drawing when the tab is hidden or the orb is off screen.
    const onVis = () => kick();
    document.addEventListener("visibilitychange", onVis);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      kick();
    });
    io.observe(canvas);

    const onLost = (e: Event) => {
      e.preventDefault();
      onFail(); // fall back to the 2D orb
    };
    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      io.disconnect();
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, [signal, onFail]);

  return <canvas ref={canvasRef} className="orb-canvas orb-glow" aria-hidden />;
}
