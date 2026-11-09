import { timingSafeEqual } from "node:crypto";

// Demo guardian accounts. Test values only, listed in the README under "Demo accounts".
// A real deployment would store hashed passwords; this demo has no database.
type Guardian = { email: string; password: string; name: string };

const GUARDIANS: Guardian[] = [{ email: "mom@sonny.demo", password: "grandma-demo", name: "Mom" }];

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
