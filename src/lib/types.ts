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

// Grandma's allowance. The family tops it up (Stripe test mode when keys exist),
// grandma spends it by voice. Amounts are in the smallest currency unit (cents).
export type WalletEntry = {
  id: string;
  at: string; // ISO time
  amount: number; // + top-up, - spend
  label: string; // "Top-up from Mom", "Taxi to clinic"
  status: "done" | "pending_approval" | "declined";
  by: "family" | "grandma";
};

export type Wallet = {
  currency: "usd" | "krw";
  balance: number;
  perSpendLimit: number; // above this, the family must approve first
  ledger: WalletEntry[];
};

// When a spend is over the limit (or looks wrong), Sonny "calls" the guardian.
// Demo: the family app shows an incoming call screen and Sonny's voice reads this
// out; the guardian approves or declines by voice or button. Real phone calls are
// the roadmap (telephony agent). The matching ActivityEvent has kind "call".
export type GuardianCall = {
  id: string;
  at: string; // ISO time
  walletEntryId?: string; // the pending_approval entry this call is about (spend calls only)
  script: string; // what Sonny says to the guardian, plain English
  amount: number; // cents
  // "nudge": Sonny calls mom to suggest she checks in on grandma (no money involved).
  // "struggle": grandma has been stuck on a task (for example booking a ride) for a while.
  reason: "over_limit" | "unusual_quantity" | "low_balance" | "nudge" | "struggle";
  status: "ringing" | "approved" | "declined" | "missed" | "done";
};

// One line in the shared activity log the family app reads.
export type ActivityEvent = {
  id: string;
  at: string; // ISO time
  kind: "heard" | "said" | "tuned" | "scheduled" | "alert" | "memory" | "family" | "task" | "call";
  text: string;
  // Who may see this line. "family": tasks and safety (orders, rides, medicine, alerts)
  // shown to mom as-is. "summary": mom sees only `familyText`, never the raw words.
  // "private": grandma's own talk and personal lessons, never shown to the family.
  visibility?: "family" | "summary" | "private";
  familyText?: string;
};

// "Grandma builds by talking": a skill that needs an outside account (ride app, pharmacy,
// grocery) is connected once by the guardian. Grandma is never asked for an id, password
// or card. Demo only: no secret is stored, the screen shows masked values.
export type ServiceConnection = {
  id: string;
  service: "ride" | "pharmacy" | "grocery";
  skillName: string; // the skill that asked for it, e.g. "usual ride to Dr. Lee"
  status: "requested" | "connected";
  requestedAt: string; // ISO time
  connectedAt?: string;
  account?: string; // masked, e.g. "sarah•••@demo"
  card?: string; // masked, e.g. "•••• 4242"; payments still come from the allowance wallet
  demo: true;
};
