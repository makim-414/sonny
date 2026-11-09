import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { familyState } from "@/app/api/family/state";
import { DEVICE_COOKIE, DEVICE_TTL, cookieOptions, deviceToken, readPair } from "@/lib/auth/session";

// GET /login/pair?token=... : grandma's phone opened the pairing QR from the admin.
// The phone gets a long-lived device cookie and lands on her one-icon screen.
export async function GET(request: NextRequest) {
  const ticket = readPair(request.nextUrl.searchParams.get("token"));
  if (!ticket) return NextResponse.redirect(new URL("/login/device?expired=1", request.url));

  const id = randomUUID();
  familyState.devices.push({ id, pairedAt: new Date().toISOString(), label: "Grandma's phone" });
  const res = NextResponse.redirect(new URL("/", request.url));
  const secure = request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";
  res.cookies.set(DEVICE_COOKIE, deviceToken(id), cookieOptions(DEVICE_TTL, secure));
  return res;
}
