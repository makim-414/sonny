import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

// Signed cookie sessions for the demo. No database, no external service.
// A token is base64url(JSON payload) + "." + HMAC-SHA256 of it.
// Set AUTH_SECRET in production; the fallback is for local development only.
const SECRET = process.env.AUTH_SECRET || "sonju-dev-only-secret-not-for-production";

export const GUARDIAN_COOKIE = "sonju_guardian";
export const DEVICE_COOKIE = "sonju_device";

export type GuardianSession = { role: "guardian"; email: string; name: string; exp: number };
export type DeviceSession = { role: "device"; deviceId: string; exp: number };
export type PairTicket = { role: "pair"; nonce: string; exp: number };
type Payload = GuardianSession | DeviceSession | PairTicket;

const DAY = 24 * 60 * 60;
export const GUARDIAN_TTL = 30 * DAY;
export const DEVICE_TTL = 365 * DAY; // grandma's phone stays signed in
export const PAIR_TTL = 15 * 60;

const nowSec = () => Math.floor(Date.now() / 1000);

function mac(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("base64url");
}

export function sign(payload: Payload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function verify(token: string | undefined | null): Payload | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const got = Buffer.from(token.slice(dot + 1));
  const want = Buffer.from(mac(body));
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    return payload.exp > nowSec() ? payload : null;
  } catch {
    return null;
  }
}

export function guardianToken(email: string, name: string): string {
  return sign({ role: "guardian", email, name, exp: nowSec() + GUARDIAN_TTL });
}

export function deviceToken(deviceId: string = randomUUID()): string {
  return sign({ role: "device", deviceId, exp: nowSec() + DEVICE_TTL });
}

export function pairTicket(): { token: string; exp: number } {
  const exp = nowSec() + PAIR_TTL;
  return { token: sign({ role: "pair", nonce: randomUUID(), exp }), exp };
}

export function readGuardian(token: string | undefined): GuardianSession | null {
  const p = verify(token);
  return p?.role === "guardian" ? p : null;
}

export function readDevice(token: string | undefined): DeviceSession | null {
  const p = verify(token);
  return p?.role === "device" ? p : null;
}

export function readPair(token: string | undefined | null): PairTicket | null {
  const p = verify(token);
  return p?.role === "pair" ? p : null;
}

export function cookieOptions(maxAge: number, secure: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge };
}

// AUTH_MODE=off turns every check off (escape hatch if auth ever blocks the live demo).
export const authOff = () => process.env.AUTH_MODE === "off";
