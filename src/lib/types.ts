// Shared contracts between the TV screen, the agent brain and the family app.
// Owned by the integration session. Change only by agreement.

export type Channel = {
  number: number;
  name: string;
};

export type Program = {
  channel: number;
  title: string;
  people: string[];
  start: string; // ISO time
  end: string; // ISO time
};

// What the agent asks the TV to do.
export type TvAction =
  | { type: "tune"; channel: number; reason?: string }
  | { type: "showCard"; title: string; body?: string; imageUrl?: string }
  | { type: "schedule"; at: string; action: TvAction; label: string }
  | { type: "notifyFamily"; message: string; level: "info" | "warn" | "urgent" };

// Request from the TV to the agent.
export type AgentRequest = {
  text: string; // what grandma said, or a system trigger
  source: "voice" | "proactive" | "family";
  now?: string; // ISO time, lets the demo fast-forward the clock
};

// Reply from the agent to the TV.
export type AgentReply = {
  say: string; // spoken out loud on the TV, Korean
  sayEn?: string; // English subtitle for the judges (E key on the TV)
  heardEn?: string; // English translation of what grandma said
  private?: boolean; // true when this turn was kept from the family (TV shows a lock)
  actions: TvAction[];
};

// One line in the shared activity log the family app reads.
export type ActivityEvent = {
  id: string;
  at: string; // ISO time
  kind: "heard" | "said" | "tuned" | "scheduled" | "alert" | "memory" | "family" | "task";
  text: string;
  // Who may see this line. "family": tasks and safety (orders, rides, medicine, alerts)
  // shown to mom as-is. "summary": mom sees only `familyText`, never the raw words.
  // "private": grandma's own talk and personal lessons, never shown to the family.
  visibility?: "family" | "summary" | "private";
  familyText?: string;
};
