// Demo family members (public data, safe for the browser). Passwords live in users.ts.
export type FamilyMember = { email: string; name: string; relation: string; role: "admin" | "member"; card: string };

export const FAMILY_MEMBERS: FamilyMember[] = [
  { email: "mom@sonny.demo", name: "Sarah", relation: "Daughter", role: "admin", card: "4242" },
  { email: "mike@sonny.demo", name: "Mike", relation: "Son", role: "member", card: "1881" },
];

// Sessions signed before the rename still carry the old demo address.
const LEGACY: Record<string, string> = { "mom@sonju.demo": "mom@sonny.demo" };

export function memberByEmail(email: string | undefined): FamilyMember | null {
  const e = email ? (LEGACY[email] ?? email) : email;
  return FAMILY_MEMBERS.find((m) => m.email === e) ?? null;
}
