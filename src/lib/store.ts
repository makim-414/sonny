import type { ActivityEvent, GuardianCall, TvAction, Wallet } from "./types";

// In-memory state for the demo. One grandma, one TV, one process.
// Kept on globalThis so Next.js dev reloads do not wipe it.
type Store = {
  events: ActivityEvent[];
  pending: { at: string; action: TvAction; label: string }[];
  currentChannel: number | null;
  // Messages or commands from the family app, waiting for the TV to pick up.
  tvInbox: { id: string; at: string; from: string; text: string }[];
  wallet: Wallet;
  calls: GuardianCall[];
};

// Demo seed: $80 allowance, anything over $30 needs the family's OK.
const seedWallet = (): Wallet => ({
  currency: "usd",
  balance: 8000,
  perSpendLimit: 3000,
  ledger: [
    {
      id: "seed-topup",
      at: new Date().toISOString(),
      amount: 8000,
      label: "Weekly allowance from Mom (demo data)",
      status: "done",
      by: "family",
    },
  ],
});

const g = globalThis as unknown as { __hyodoStore?: Store };

export const store: Store =
  g.__hyodoStore ?? (g.__hyodoStore = { events: [], pending: [], currentChannel: null, tvInbox: [], wallet: seedWallet(), calls: [] });

// Older hot-reloaded stores may predate the wallet.
store.wallet ??= seedWallet();
store.calls ??= [];

export function logEvent(
  kind: ActivityEvent["kind"],
  text: string,
  at = new Date().toISOString(),
  opts: Pick<ActivityEvent, "visibility" | "familyText"> = {},
) {
  const event: ActivityEvent = { id: crypto.randomUUID(), at, kind, text, ...opts };
  store.events.push(event);
  return event;
}
