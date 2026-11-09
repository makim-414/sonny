"use client";

import { useEffect, useRef } from "react";
import { BuddyLook } from "@/components/orb/BuddyLook";
import type { OrbSignal } from "@/components/orb/ParticleOrb";
import type { AvatarMood } from "./Avatar";

// The same 3D buddy as grandma's phone, sized for the TV caption and boot screen.
// The TV speaks with the browser voice, so the buddy uses its built-in talking rhythm.
export function TvBuddy({ mood, className }: { mood: AvatarMood; className?: string }) {
  const signal = useRef<OrbSignal>({ mode: mood, pulse: 0 });
  useEffect(() => {
    signal.current.mode = mood;
  }, [mood]);
  return (
    <div className={`tv-buddy ${className ?? ""}`} aria-hidden>
      <BuddyLook signal={signal} />
    </div>
  );
}
