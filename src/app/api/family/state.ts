// Family-side state that is not part of the shared store contract.
// Kept on globalThis so Next.js dev reloads do not wipe it.
type FamilyState = {
  approvedIds: string[]; // event ids of requests mom approved
};

const g = globalThis as unknown as { __hyodoFamily?: FamilyState };

export const familyState: FamilyState = g.__hyodoFamily ?? (g.__hyodoFamily = { approvedIds: [] });

export const FAMILY_SENDER = "엄마";
