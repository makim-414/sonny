import { T } from "@/components/family/strings";

// Family-side state that is not part of the shared store contract.
// Kept on globalThis so Next.js dev reloads do not wipe it.
export type Device = { id: string; pairedAt: string; label: string };
export type Routine = {
  id: string;
  kind: "pills" | "outing" | "doctor";
  label: string; // "Morning pills", "Temple", "Dr. Kim"
  time: string; // "08:00"
  days: string; // "Every day", "Tue, Fri", "Nov 12"
  at: string; // ISO time it was added
};

type FamilyState = {
  approvedIds: string[]; // event ids of requests mom approved
  devices: Device[];
  routines: Routine[];
};

const g = globalThis as unknown as { __hyodoFamily?: FamilyState };

export const familyState: FamilyState = g.__hyodoFamily ?? (g.__hyodoFamily = { approvedIds: [], devices: [], routines: [] });
familyState.devices ??= [];
familyState.routines ??= [];

export const FAMILY_SENDER = T.mom;
