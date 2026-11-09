"use client";

import { useEffect, useRef } from "react";
import { BuddyLook } from "@/components/orb/BuddyLook";
import type { OrbSignal } from "@/components/orb/ParticleOrb";
import type { AvatarMood } from "./Avatar";

// The same 3D character as grandma's phone. On the TV it lives in the bottom-right corner
// (and on the boot screen). Look follows the URL: parrot by default, ?look=buddy for the
// glasses buddy. The TV speaks with the browser voice, so it uses its built-in talking rhythm.
export function TvBuddy({ mood, className }: { mood: AvatarMood; className?: string }) {
  const signal = useRef<OrbSignal>({ mode: mood, pulse: 0 });
  useEffect(() => {
    signal.current.mode = mood;
  }, [mood]);
  return (
    <div className={`tv-buddy ${className ?? ""}`} aria-hidden>
      <BuddyLook signal={signal} parrot={typeof window === "undefined" || new URLSearchParams(window.location.search).get("look") !== "buddy"} />
    </div>
  );
}
