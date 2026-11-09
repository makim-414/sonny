import type { ActivityEvent, TvAction } from "./types";

// In-memory state for the demo. One grandma, one TV, one process.
// Kept on globalThis so Next.js dev reloads do not wipe it.
type Store = {
  events: ActivityEvent[];
  pending: { at: string; action: TvAction; label: string }[];
  currentChannel: number | null;
};

const g = globalThis as unknown as { __hyodoStore?: Store };

export const store: Store =
  g.__hyodoStore ?? (g.__hyodoStore = { events: [], pending: [], currentChannel: null });

export function logEvent(kind: ActivityEvent["kind"], text: string, at = new Date().toISOString()) {
  const event: ActivityEvent = { id: crypto.randomUUID(), at, kind, text };
  store.events.push(event);
  return event;
}
