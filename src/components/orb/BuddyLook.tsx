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
uniform float Y, X, T, S, B, Bl, W, H, M, L, D, Z, G, N, V, Tm; // yaw pitch roll squash height blink wide happy mouth look-up drag grow glasses-lift glasses-on parrot time
mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
float soft(float d,float w){return 1.-smoothstep(-w,w,d);}
// Dot eye; happy turns it into a small upside-down U (^).
float eye(vec2 q, vec2 c){
  float r=.055*(1.+W*.3);                       // about 5.5% of the diameter
  float dotE=soft(length((q-c)/vec2(1.,max(1.-Bl,.1)))-r,.006);
  float x=(q.x-c.x)/.06, arc=c.y+.032*(1.-x*x);
  float hap=soft(abs(q.y-arc)-.009,.005)*step(abs(x),1.);
  return mix(dotE,hap,H);
}
// Small mouth: idle smile, a pea-sized o with the voice, a little D when happy.
float mouth(vec2 q){
  vec2 m=q-vec2(0.,-.065);                       // just under the eyes
  float x=m.x/.065;                              // narrower than the eye spacing
  float smile=soft(abs(m.y-(-.012+.018*x*x))-.007,.004)*step(abs(x),1.);
  float o=soft(length(m/vec2(.8,1.))-.028*M,.005)*step(.05,M);
  float dTop=step(m.y,0.)*step(abs(m.x),.045);
  float dShape=soft(length(m)-.045,.005)*dTop;
  float idle=smile*(1.-step(.05,M));
  return mix(max(idle,o),dShape,H);
}
// Parrot beak: small amber hook under the eyes; upper and lower halves part with the voice.
float beak(vec2 q){
  vec2 b=q-vec2(0.,-.04);
  float gap=max(M,H)*.035;
  float upper=soft(length((b-vec2(0.,.005))/vec2(1.,.85))-.05,.004)*step(-.012,b.y);
  float hook=soft(length(b-vec2(0.,-.03))-.018,.004);
  float lower=soft(length((b-vec2(0.,-.03-gap))/vec2(1.,.7))-.035,.004)*step(b.y,-.02-gap);
  return max(max(upper,hook*step(gap,.01)),lower);
}
// Cockatiel crest: three tapered feathers rising from the top of the head and curling back.
float crest(vec2 p, vec2 top, vec2 up, float r, float erect, float wig){
  vec2 side=vec2(up.y,-up.x);
  float a=0.;
  for(int i=0;i<3;i++){
    float fi=float(i);
    vec2 base=top+side*r*(-.1+fi*.1);
    float len=r*(.55+.2*fi-.1*fi*fi)*(.85+.3*erect);
    float bend=(.45-.25*erect+wig*sin(Tm*18.+fi*1.7))*(1.+.2*fi);
    vec2 d=p-base;
    float t=clamp(dot(d,up)/len,0.,1.);
    float off=dot(d,side)-bend*t*t*len;
    float w=r*(.075*(1.-t)+.012);
    a=max(a,soft(abs(off)-w,.004)*step(0.,dot(d,up))*step(dot(d,up),len*1.02));
  }
  return a;
}
// Round reading glasses: two thin gold rims around the eyes and a bridge. Returns rim, shine.
vec2 glasses(vec2 q){
  vec2 g=q-vec2(0.,G);
  float r=.1, w=.011;
  float rims=max(soft(abs(length(g-vec2(-.15,.05))-r)-w,.005),soft(abs(length(g-vec2(.15,.05))-r)-w,.005));
  float bridge=soft(abs(g.y-(.07-.25*g.x*g.x))-w*.8,.005)*step(abs(g.x),.05);
  vec2 s1=g-vec2(-.19,.1), s2=g-vec2(.11,.1);
  float shine=soft(abs(length(s1)-.055)-.006,.004)*step(s1.x,0.)*step(0.,s1.y)
             +soft(abs(length(s2)-.055)-.006,.004)*step(s2.x,0.)*step(0.,s2.y);
  return vec2(max(rims,bridge),shine)*N;
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
  if(V>.5){
    // project the head's top into the screen; the crest grows from there along the head's up
    vec3 upv=rz(T)*rx(X)*ry(Y)*vec3(0.,1.,0.);
    float k2=.95/(ro.z-c.z);
    vec2 cen=(c.xy-ro.xy)*k2, up2=normalize(upv.xy+1e-4);
    float r2=sc.y*k2;
    vec2 top=cen+up2*r2*.82;
    float cr=crest(uv,top,up2,r2,W,(M+H)*.25);
    if(cr>0.) col=vec4(mix(C,K,.45)*(.9+.1*cr),cr);
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
    float blush=soft(length((f-vec2(-.3,-.05))/vec2(1.,.6))-.055,.035)+soft(length((f-vec2(.3,-.05))/vec2(1.,.6))-.055,.035);
    base=mix(base,P,blush*.35*face*(1.-V));
    // parrot: round orange cheek patches
    float patch=soft(length(f-vec2(-.3,-.06))-.075,.01)+soft(length(f-vec2(.3,-.06))-.075,.01);
    base=mix(base,A,min(1.,patch)*.85*face*V);
    // eyes close together (spacing 15% of the diameter), a little above the middle
    float ink=max(max(eye(f,vec2(-.15,.05)),eye(f,vec2(.15,.05))),mouth(f)*(1.-V))*face;
    vec3 shade=mix(base,Q,ink*.94);
    shade=mix(shade,mix(A,Q,.2),beak(f)*face*V);           // amber beak
    vec2 gl=glasses(f)*face;
    float drop=glasses(f+vec2(-.012,.018)).x*face*(1.-gl.x); // soft shadow: the frame floats off the skin
    shade=mix(shade,A*.7,drop*.35);
    // metal frame: dark gold, with a bright line where the rim faces the light
    float metal=smoothstep(.2,.9,dot(normalize(vec2(abs(f.x)-.15,f.y-.05)+1e-4),vec2(-.6,.8)));
    vec3 rimCol=mix(mix(A,Q,.45),K,metal*.85);
    shade=mix(shade,rimCol,gl.x);
    shade=mix(shade,K,gl.y*.5);                            // glassy lens shine
    col=vec4(shade,1.);
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

export function BuddyLook({
  signal,
  ringing = false,
  parrot = false,
}: {
  signal: React.RefObject<OrbSignal>;
  ringing?: boolean;
  parrot?: boolean; // ?look=parrot: cockatiel crest, beak and orange cheeks, no glasses
}) {
  const parrotRef = useRef(parrot);
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  // The 2D face shows at once and gives way when the first 3D frame is drawn.
  const [ready, setReady] = useState(false);
  const ringRef = useRef(ringing);
  useEffect(() => {
    ringRef.current = ringing;
  }, [ringing]);

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
    for (const n of ["R", "C", "K", "Q", "A", "P", "Y", "X", "T", "S", "B", "Bl", "W", "H", "M", "L", "D", "Z", "G", "N", "V", "Tm"]) U[n] = gl.getUniformLocation(prog, n);
    gl.uniform1f(U.V, parrotRef.current ? 1 : 0);
    // Reading glasses are part of the default look (owner, 11/9); ?acc=none takes them off.
    gl.uniform1f(U.N, parrotRef.current || new URLSearchParams(window.location.search).get("acc") === "none" ? 0 : 1);
    gl.uniform3fv(U.C, rgb(canvas, "--brand"));
    gl.uniform3fv(U.K, rgb(canvas, "--chart-1"));
    gl.uniform3fv(U.Q, rgb(canvas, "--dark"));
    gl.uniform3fv(U.A, rgb(canvas, "--chart-7"));
    gl.uniform3fv(U.P, rgb(canvas, "--chart-14"));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const resize = () => {
      // Every pixel runs the shader, so cap the density: 1.5x is sharp enough for a soft ball.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
    let drawn = false;
    let learnAt = -1e9; // when Sonny last learned something (push up the glasses)
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
      // Ringing: shake side to side in bursts, like a phone on vibrate.
      const burst = ringRef.current && (t % 1.2) < 0.7 ? 1 : 0;
      const shake = burst * Math.sin(t * 34) * 0.16;
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
      gl.uniform1f(U.T, st.roll + shake);
      gl.uniform1f(U.S, Math.max(-0.25, Math.min(0.35, sq * 0.06)));
      gl.uniform1f(U.B, st.bounce + burst * Math.abs(Math.sin(t * 9)) * 0.06);
      gl.uniform1f(U.Z, st.voice * 0.06);
      if ((s.learn ?? 0) > 0) {
        s.learn = 0;
        learnAt = now;
      }
      const lp = (now - learnAt) / 200; // 200 ms push up and back
      gl.uniform1f(U.G, lp >= 0 && lp <= 1 ? Math.sin(lp * Math.PI) * 0.03 : 0);
      gl.uniform1f(U.Bl, now < blinkUntil ? 1 : 0);
      gl.uniform1f(U.W, Math.min(1.4, st.wide + st.voice * 0.6)); // eyes open with the voice
      gl.uniform1f(U.H, Math.min(1, happy * 1.4));
      gl.uniform1f(U.M, Math.min(1, st.voice * 1.4));
      gl.uniform1f(U.L, st.look);
      gl.uniform1f(U.Tm, t);
      gl.uniform1f(U.D, drag);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!drawn) {
        drawn = true;
        setReady(true);
      }
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
  return (
    <>
      {!ready && <FaceLook look="smiley" signal={signal} />}
      <canvas ref={ref} className="orb-canvas buddy-canvas" aria-label="Sonny" />
    </>
  );
}
