import { timingSafeEqual } from "node:crypto";

// Demo guardian accounts. Test values only, listed in the README under "Demo accounts".
// A real deployment would store hashed passwords; this demo has no database.
import { FAMILY_MEMBERS } from "./members";

// Family members share grandma's feed and approvals; every action is logged with their name.
// Test passwords only (listed in the README); the public member data is in members.ts.
type Guardian = { email: string; password: string; name: string };

const GUARDIANS: Guardian[] = FAMILY_MEMBERS.map((m) => ({ email: m.email, name: m.name, password: "grandma-demo" }));

export { FAMILY_MEMBERS, memberByEmail } from "./members";
export const DEMO_GUARDIAN = GUARDIANS[0];
export const DEMO_DEVICE_ID = "demo-device";

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkGuardian(email: string, password: string): Guardian | null {
  const e = email.trim().toLowerCase();
  const user = GUARDIANS.find((g) => g.email === e);
  return user && same(user.password, password) ? user : null;
}
