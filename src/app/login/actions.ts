"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { GUARDIAN_COOKIE, GUARDIAN_TTL, cookieOptions, guardianToken } from "@/lib/auth/session";
import { checkGuardian } from "@/lib/auth/users";

export type LoginState = { error: string | null; email: string };

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  // Only same-site paths, never "//evil.example".
  return n.startsWith("/") && !n.startsWith("//") ? n : "/admin";
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const user = checkGuardian(email, password);
  if (!user) return { error: "wrong", email };
  const jar = await cookies();
  const secure = (await headers()).get("x-forwarded-proto") === "https";
  jar.set(GUARDIAN_COOKIE, guardianToken(user.email, user.name), cookieOptions(GUARDIAN_TTL, secure));
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  const jar = await cookies();
  jar.delete(GUARDIAN_COOKIE);
  redirect("/login");
}
