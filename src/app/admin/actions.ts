"use server";

import { syncShared } from "@/lib/shared-state";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { familyState, type Routine } from "@/app/api/family/state";
import { T } from "@/components/family/strings";
import { pairTicket } from "@/lib/auth/session";
import { requireGuardian } from "@/lib/auth/server";
import { getMemory } from "@/lib/memory";
import { logEvent, store } from "@/lib/store";
import { confirmStripeTopUp, decide, setLimit, startTopUp, type TopUpResult } from "./wallet";

// Every action checks the guardian session itself; the proxy is only the first gate.

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

// A short-lived QR link that signs grandma's phone in for good.
export async function createPairLink(): Promise<{ url: string; exp: number }> {
  await syncShared();
  await requireGuardian();
  const { token, exp } = pairTicket();
  return { url: `${await origin()}/?pair=${encodeURIComponent(token)}`, exp };
}

const KINDS: Routine["kind"][] = ["pills", "outing", "doctor"];

export async function addRoutine(input: { kind: string; label: string; time: string; days: string }): Promise<{ ok: boolean }> {
  await syncShared();
  const g = await requireGuardian();
  const kind = KINDS.find((k) => k === input.kind);
  const label = input.label.trim().slice(0, 60);
  const time = input.time.trim().slice(0, 10);
  const days = input.days.trim().slice(0, 40);
  if (!kind || !label || !/^\d{1,2}:\d{2}$/.test(time) || !days) return { ok: false };

  const routine: Routine = { id: randomUUID(), kind, label, time, days, at: new Date().toISOString() };
  familyState.routines.push(routine);

  // The agent learns it as a routine fact, so it can remind her and plan around it.
  const memory = await getMemory();
  await memory
    .remember({
      text: `${label}: ${time}, ${days}`,
      category: "routine",
      source: "family",
      // The memory store reads the source from this prefix ("family: ...").
      provenance: `family: set by ${g.name} in the admin, ${routine.at}`,
    })
    .catch((err) => console.warn("[admin] routine not saved to memory:", err));
  logEvent("scheduled", `${label} · ${time} · ${days}`, routine.at, { visibility: "family" });
  return { ok: true };
}

export async function removeRoutine(id: string): Promise<{ ok: boolean }> {
  await syncShared();
  await requireGuardian();
  const i = familyState.routines.findIndex((r) => r.id === id);
  if (i < 0) return { ok: false };
  familyState.routines.splice(i, 1);
  return { ok: true };
}

export async function topUp(amount: number): Promise<TopUpResult> {
  await syncShared();
  await requireGuardian();
  return startTopUp(amount, await origin());
}

export async function confirmTopUp(sessionId: string): Promise<{ ok: boolean }> {
  await syncShared();
  await requireGuardian();
  return { ok: await confirmStripeTopUp(sessionId) };
}

export async function updateLimit(limit: number): Promise<{ ok: boolean }> {
  await syncShared();
  await requireGuardian();
  return { ok: setLimit(limit) };
}

// Approve or decline a spend over the limit; grandma hears the answer on her phone.
export async function decideSpend(id: string, approve: boolean): Promise<{ ok: boolean; message?: string }> {
  await syncShared();
  const g = await requireGuardian();
  const r = decide(id, approve);
  if (!r.ok) return r;
  const text = approve ? `${g.name} approved: ${r.label}` : `${g.name} said not this time: ${r.label}`;
  store.tvInbox.push({ id: randomUUID(), at: new Date().toISOString(), from: T.mom, text });
  logEvent("family", `${g.name}: ${approve ? "Approved" : "Declined"} ${r.label}`, undefined, { visibility: "family" });
  return { ok: true };
}
