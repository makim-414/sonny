"use server";

import { cookies, headers } from "next/headers";
import { requireGuardian } from "@/lib/auth/server";
import { GUARDIAN_COOKIE, GUARDIAN_TTL, cookieOptions, guardianToken } from "@/lib/auth/session";
import { memberByEmail } from "@/lib/auth/members";

// Demo only: switch between the demo family members on one phone (Sarah, Mike).
// A real deployment signs each member in on their own phone.
export async function switchMember(email: string): Promise<boolean> {
  await requireGuardian();
  const m = memberByEmail(email);
  if (!m) return false;
  const jar = await cookies();
  const secure = (await headers()).get("x-forwarded-proto") === "https";
  jar.set(GUARDIAN_COOKIE, guardianToken(m.email, m.name), cookieOptions(GUARDIAN_TTL, secure));
  return true;
}
