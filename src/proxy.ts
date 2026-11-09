import { NextResponse, type NextRequest } from "next/server";
import {
  DEVICE_COOKIE,
  DEVICE_TTL,
  GUARDIAN_COOKIE,
  GUARDIAN_TTL,
  authOff,
  cookieOptions,
  deviceToken,
  guardianToken,
  readDevice,
  readGuardian,
} from "@/lib/auth/session";
import { DEMO_DEVICE_ID, DEMO_GUARDIAN } from "@/lib/auth/users";

// First gate for every page and API. Server functions and route handlers check again.
//   guardian: the family admin and its data
//   device:   grandma's phone or TV (paired once from the admin), or a signed-in guardian
//   ?demo=1:  judges' QR codes; signs in as the demo guardian or demo device on the spot
//   ?pair=T:  grandma's phone opening the pairing QR

type Need = "guardian" | "device" | "public";

function need(path: string): Need {
  if (path.startsWith("/_next/") || path.startsWith("/__nextjs")) return "public";
  if (path === "/login" || path.startsWith("/login/")) return "public";
  if (path === "/api/family/inbox") return "device";
  if (path === "/admin" || path.startsWith("/admin/")) return "guardian";
  if (path === "/family" || path.startsWith("/family/")) return "guardian";
  if (path.startsWith("/api/family") || path.startsWith("/api/events")) return "guardian";
  if (path === "/" || path === "/tv" || path.startsWith("/tv/") || path.startsWith("/remote")) return "device";
  if (path.startsWith("/api/")) return "device";
  return "public";
}

export function proxy(request: NextRequest) {
  if (authOff()) return NextResponse.next();

  const url = request.nextUrl;
  const path = url.pathname;
  const secure = url.protocol === "https:";

  // Pairing link from the admin QR: /?pair=<token>
  const pair = url.searchParams.get("pair");
  if (pair) {
    const to = new URL("/login/pair", url);
    to.searchParams.set("token", pair);
    return NextResponse.redirect(to);
  }

  const required = need(path);
  if (required === "public") return NextResponse.next();

  const guardian = readGuardian(request.cookies.get(GUARDIAN_COOKIE)?.value);
  const device = readDevice(request.cookies.get(DEVICE_COOKIE)?.value);
  const isApi = path.startsWith("/api/") || path === "/remote/api" || path === "/admin/data";

  // Judges' QR codes: sign in as the demo account and continue, no form.
  if (url.searchParams.get("demo") === "1") {
    const clean = new URL(url);
    clean.searchParams.delete("demo");
    const res = isApi ? NextResponse.next() : NextResponse.redirect(clean);
    if (required === "guardian" && !guardian) {
      res.cookies.set(GUARDIAN_COOKIE, guardianToken(DEMO_GUARDIAN.email, DEMO_GUARDIAN.name), cookieOptions(GUARDIAN_TTL, secure));
    }
    if (required === "device" && !device && !guardian) {
      res.cookies.set(DEVICE_COOKIE, deviceToken(DEMO_DEVICE_ID), cookieOptions(DEVICE_TTL, secure));
    }
    return res;
  }

  const ok = required === "guardian" ? Boolean(guardian) : Boolean(device || guardian);
  if (ok) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: required === "guardian" ? "sign in as family" : "device not connected" }, { status: 401 });

  if (required === "guardian") {
    const to = new URL("/login", url);
    to.searchParams.set("next", path + url.search);
    return NextResponse.redirect(to);
  }
  return NextResponse.redirect(new URL("/login/device", url));
}

export const config = {
  // Skip every Next internal (static files, images, the dev HMR socket) and public files
  // (icons, manifest, service worker). Running on /_next/webpack-hmr breaks hot reload.
  matcher: ["/((?!_next/|__nextjs|favicon\\.ico|icons/|.*\\.(?:png|jpg|jpeg|svg|ico|webmanifest|js|json|txt|map|woff2?)$).*)"],
};
