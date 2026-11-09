import { cookies } from "next/headers";
import { DEVICE_COOKIE, GUARDIAN_COOKIE, authOff, readDevice, readGuardian, type GuardianSession } from "./session";
import { DEMO_GUARDIAN } from "./users";

// Checks inside server functions and route handlers. The proxy is only the first gate.
export async function currentGuardian(): Promise<GuardianSession | null> {
  const jar = await cookies();
  const g = readGuardian(jar.get(GUARDIAN_COOKIE)?.value);
  if (g) return g;
  if (authOff()) return { role: "guardian", email: DEMO_GUARDIAN.email, name: DEMO_GUARDIAN.name, exp: 0 };
  return null;
}

export async function requireGuardian(): Promise<GuardianSession> {
  const g = await currentGuardian();
  if (!g) throw new Error("Not signed in");
  return g;
}

export async function hasDeviceOrGuardian(): Promise<boolean> {
  if (authOff()) return true;
  const jar = await cookies();
  return Boolean(readDevice(jar.get(DEVICE_COOKIE)?.value) || readGuardian(jar.get(GUARDIAN_COOKIE)?.value));
}
