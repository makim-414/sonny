import { logEvent } from "@/lib/store";
import type { ServiceConnection } from "@/lib/types";

// Accounts the guardian connected for grandma's skills (demo, masked, nothing secret).
const g = globalThis as unknown as { __sonnyConnections?: ServiceConnection[] };
export const connections: ServiceConnection[] = g.__sonnyConnections ?? (g.__sonnyConnections = []);

export const SERVICE_LABEL: Record<ServiceConnection["service"], string> = { ride: "ride", pharmacy: "pharmacy", grocery: "grocery" };

export function connectionFor(service: ServiceConnection["service"]) {
  return connections.find((c) => c.service === service);
}

/** Ask the guardian to connect an account once. Returns the (possibly existing) record. */
export function requestConnection(service: ServiceConnection["service"], skillName: string, at: string): ServiceConnection {
  const have = connectionFor(service);
  if (have) return have;
  const c: ServiceConnection = { id: crypto.randomUUID(), service, skillName, status: "requested", requestedAt: at, demo: true };
  connections.push(c);
  // kind task so mom's feed shows a button; the family app's approve sends it back through the inbox.
  logEvent("task", `Grandma taught Sonny a new skill: ${skillName}. Connect her ${SERVICE_LABEL[service]} account? (connection ${c.id})`, at, {
    visibility: "family",
    familyText: `Grandma taught Sonny a new skill: ${skillName}. Connect her ${SERVICE_LABEL[service]} account?`,
  });
  return c;
}

/** The guardian pressed Connect (demo: masked placeholders, payments use the allowance). */
export function connect(id: string, by: string, at = new Date().toISOString()): ServiceConnection | null {
  const c = connections.find((x) => x.id === id) ?? null;
  if (!c) return null;
  c.status = "connected";
  c.connectedAt = at;
  c.account = `${by.toLowerCase().split(/\s+/)[0] || "mom"}•••@demo`;
  c.card = "•••• 4242";
  logEvent("family", `${by} connected Grandma's ${SERVICE_LABEL[c.service]} account for "${c.skillName}" (demo)`, at, { visibility: "family" });
  return c;
}

export function resetConnections() {
  connections.length = 0;
}
