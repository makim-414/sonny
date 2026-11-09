"use client";

import { useCallback, useState } from "react";
import { ParticleOrb, type OrbSignal } from "./ParticleOrb";
import { WebGLOrb, canUseWebGL } from "./WebGLOrb";

// Picks the WebGL orb, or the canvas 2D orb when WebGL is missing, the context is lost,
// the user asks for less motion, or ?orb=2d is set.
function wantWebGL(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("orb") === "2d") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return canUseWebGL();
}

export function Orb({ signal }: { signal: React.RefObject<OrbSignal> }) {
  const [webgl, setWebgl] = useState(wantWebGL);
  const fallBack = useCallback(() => setWebgl(false), []);
  return webgl ? <WebGLOrb signal={signal} onFail={fallBack} /> : <ParticleOrb signal={signal} />;
}
