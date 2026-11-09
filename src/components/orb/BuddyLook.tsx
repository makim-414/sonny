"use client";

// Sonny's default look (owner, 11/9): the round yellow character in real 3D, floating,
// raw WebGL, written from scratch.
// One fullscreen fragment shader traces a single squashable sphere (analytic ray-ellipsoid
// hit, no meshes, no three.js) with the gold-to-amber sheen of the flat character, a rim
// light, and a warm light pool on the floor that shrinks as it floats up. Dot eyes, light
// blush and a small mouth (smile, a pea-sized o with the voice, a little D when tapped)
// are drawn in the head's own coordinates so they turn with it.
// Interaction: the head and eyes follow the finger or cursor, a tap squashes it and makes
// happy ^ ^ eyes, a drag tilts it like it is about to roll. States come from the same
// signal as the orb (idle, listening, thinking, speaking with the real voice level, joy).
// Falls back to the 2D smiley face when WebGL is missing.

import { useEffect, useRef, useState } from "react";
import { speechEnvelope, type OrbSignal } from "./ParticleOrb";
import { FaceLook } from "./FaceLook";

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

const FRAG = `
precision mediump float;
uniform vec2 R;
uniform vec3 C, K, Q, A, P; // brand, light gold, ink, amber, blush
uniform float Y, X, T, S, B, Bl, W, H, M, L, D, Z; // yaw pitch roll squash height blink wide happy mouth look-up drag grow
mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
float soft(float d,float w){return 1.-smoothstep(-w,w,d);}
// Dot eye; happy turns it into a small upside-down U (^).
float eye(vec2 q, vec2 c){
  float r=.075*(1.+W*.3);
  float dotE=soft(length((q-c)/vec2(1.,max(1.-Bl,.1)))-r,.008);
  float x=(q.x-c.x)/.085, arc=c.y+.045*(1.-x*x);
  float hap=soft(abs(q.y-arc)-.012,.006)*step(abs(x),1.);
  return mix(dotE,hap,H);
}
// Small mouth: idle smile, a pea-sized o with the voice, a little D when happy.
float mouth(vec2 q){
  vec2 m=q-vec2(0.,-.06);
  float x=m.x/.15;
  float smile=soft(abs(m.y-(-.03+.035*x*x))-.011,.005)*step(abs(x),1.);
  float o=soft(length(m/vec2(.75,1.))-.045*M,.006)*step(.05,M);
  float dTop=step(m.y,0.)*step(abs(m.x),.07);
  float dShape=soft(length(m)-.07,.006)*dTop;
  float idle=smile*(1.-step(.05,M));
  return mix(max(idle,o),dShape,H);
}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*R)/min(R.x,R.y);
  vec3 ro=vec3(0.,0.,3.6), rd=normalize(vec3(uv,-.95));
  vec3 sc=vec3(1.+S*.45,1.-S,1.+S*.45)*(1.+Z);        // squash and stretch, grow with the voice
  vec3 c=vec3(D*.25,.18+B,0.);                        // floating above the floor
  vec3 o=(ro-c)/sc, d=rd/sc;
  float a=dot(d,d), b=dot(o,d), k=dot(o,o)-1., h=b*b-a*k;
  vec4 col=vec4(0.);
  // Warm gold light pool on the floor: smaller and fainter the higher the ball floats.
  float gy=-1.25, tg=(gy-ro.y)/rd.y;
  if(tg>0.){
    float lift=clamp((c.y+.1)/.8,0.,1.);
    vec3 g=ro+rd*tg; vec2 e=(g.xz-c.xz)/(vec2(1.25,.5)*(1.-lift*.35));
    float pool=(1.-smoothstep(0.,1.,length(e)))*(.3-lift*.15);
    col=vec4(C*.9,pool);
  }
  if(h>0.){
    float t=(-b-sqrt(h))/a; vec3 lp=o+d*t;
    vec3 n=normalize(lp/sc);
    vec3 q=rz(-T)*rx(-X)*ry(-Y)*lp;                    // face coordinates follow the head
    vec3 l=normalize(vec3(-.45,.75,.6));
    float ndl=dot(n,l);
    vec3 base=mix(A,C,smoothstep(-.35,.55,ndl));        // amber shadow side to brand gold
    base=mix(base,K,smoothstep(.75,1.,ndl)*.8);          // light gold sheen up top
    float rim=pow(1.-max(dot(n,-rd),0.),3.);
    base+=K*rim*.35+pow(max(dot(reflect(-l,n),-rd),0.),30.)*.25;
    float face=step(0.,q.z);
    vec2 f=q.xy+vec2(0.,-L*.07);
    float blush=soft(length((f-vec2(-.4,0.))/vec2(1.,.6))-.07,.04)+soft(length((f-vec2(.4,0.))/vec2(1.,.6))-.07,.04);
    base=mix(base,P,blush*.35*face);
    float ink=max(max(eye(f,vec2(-.24,.14)),eye(f,vec2(.24,.14))),mouth(f))*face;
    col=vec4(mix(base,Q,ink*.94),1.);
  }
  gl_FragColor=vec4(col.rgb*col.a,col.a);
}`;

function rgb(el: HTMLElement, name: string): [number, number, number] {
  const c = document.createElement("canvas").getContext("2d");
  if (!c) return [1, 1, 1];
  c.fillStyle = getComputedStyle(el).getPropertyValue(name).trim() || "white";
  c.fillRect(0, 0, 1, 1);
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

export function BuddyLook({ signal }: { signal: React.RefObject<OrbSignal> }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext("webgl", { premultipliedAlpha: true, antialias: true });
    if (!canvas || !gl) {
      setFailed(true);
      return;
    }
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = sh(gl.VERTEX_SHADER, VERT);
    const fs = sh(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) {
      setFailed(true);
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, "p");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setFailed(true);
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const U: Record<string, WebGLUniformLocation | null> = {};
    for (const n of ["R", "C", "K", "Q", "A", "P", "Y", "X", "T", "S", "B", "Bl", "W", "H", "M", "L", "D", "Z"]) U[n] = gl.getUniformLocation(prog, n);
    gl.uniform3fv(U.C, rgb(canvas, "--brand"));
    gl.uniform3fv(U.K, rgb(canvas, "--chart-1"));
    gl.uniform3fv(U.Q, rgb(canvas, "--dark"));
    gl.uniform3fv(U.A, rgb(canvas, "--chart-7"));
    gl.uniform3fv(U.P, rgb(canvas, "--chart-14"));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.R, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    // Pointer: follow, tap to squash, drag to tilt.
    const aim = { x: 0, y: 0, active: false };
    let downAt = 0;
    let downX = 0;
    let dragging = false;
    let drag = 0; // -1..1 sideways drag
    let sq = 0; // squash amount (spring)
    let sqV = 0;
    let happy = 0;
    const toAim = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      aim.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      aim.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
      aim.active = true;
    };
    const onMove = (e: PointerEvent) => {
      toAim(e);
      if (dragging) drag = Math.max(-1, Math.min(1, (e.clientX - downX) / (canvas.clientWidth * 0.35)));
    };
    const onDown = (e: PointerEvent) => {
      e.stopPropagation(); // playing with the buddy does not cut Sonny off
      toAim(e);
      downAt = performance.now();
      downX = e.clientX;
      dragging = true;
    };
    const onUp = () => {
      if (dragging && performance.now() - downAt < 300 && Math.abs(drag) < 0.08) {
        sqV += 5.5; // tap: squash, then bounce back
        happy = 1;
      }
      dragging = false;
      aim.active = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    const st = { yaw: 0, pitch: 0, roll: 0, wide: 0, look: 0, voice: 0, bounce: 0 };
    let nextBlink = performance.now() + 3000 + Math.random() * 2000;
    let blinkUntil = 0;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      raf = 0;
      if (document.hidden) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      const s = signal.current;
      const e = (rate: number) => 1 - Math.exp(-dt * rate);
      const tYaw = aim.active ? aim.x * 0.6 : 0;
      const tPitch = aim.active ? aim.y * 0.4 : 0;
      st.yaw += (tYaw - st.yaw) * e(aim.active ? 10 : 2);
      st.pitch += (tPitch - st.pitch) * e(aim.active ? 10 : 2);
      if (!dragging) drag += (0 - drag) * e(4);
      const listening = s.mode === "listening" ? 1 : 0;
      st.roll += (drag * 0.5 + listening * 0.14 - st.roll) * e(6);
      st.wide += (listening - st.wide) * e(6);
      st.look += ((s.mode === "thinking" ? 1 : 0) - st.look) * e(5);
      const raw = s.mode === "speaking" ? s.level?.() ?? speechEnvelope(t) : 0;
      st.voice += (raw - st.voice) * e(raw > st.voice ? 30 : 12);
      s.joy = Math.max(0, (s.joy ?? 0) - dt * 0.9);
      if ((s.joy ?? 0) > 0.95) happy = 1;
      happy = Math.max(0, happy - dt * 0.7);
      // spring for squash and stretch
      sqV += (-sq * 120 - sqV * 9) * dt;
      sq += sqV * dt;
      const float = Math.sin(t * 0.9) * 0.09; // always drifting gently up and down
      st.bounce += (float + st.voice * 0.18 - st.bounce) * e(14);
      if (now > nextBlink) {
        blinkUntil = now + 140;
        nextBlink = now + 3000 + Math.random() * 2000;
      }
      gl.uniform1f(U.Y, st.yaw);
      gl.uniform1f(U.X, st.pitch);
      gl.uniform1f(U.T, st.roll);
      gl.uniform1f(U.S, Math.max(-0.25, Math.min(0.35, sq * 0.06)));
      gl.uniform1f(U.B, st.bounce);
      gl.uniform1f(U.Z, st.voice * 0.06);
      gl.uniform1f(U.Bl, now < blinkUntil ? 1 : 0);
      gl.uniform1f(U.W, Math.min(1.4, st.wide + st.voice * 0.6)); // eyes open with the voice
      gl.uniform1f(U.H, Math.min(1, happy * 1.4));
      gl.uniform1f(U.M, Math.min(1, st.voice * 1.4));
      gl.uniform1f(U.L, st.look);
      gl.uniform1f(U.D, drag);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    kick();
    document.addEventListener("visibilitychange", kick);
    const lost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("visibilitychange", kick);
      canvas.removeEventListener("webglcontextlost", lost);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, [signal]);

  if (failed) return <FaceLook look="smiley" signal={signal} />;
  return <canvas ref={ref} className="orb-canvas buddy-canvas" aria-label="Sonny" />;
}
