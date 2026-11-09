"use server";

import { syncShared } from "@/lib/shared-state";

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { familyState } from "@/app/api/family/state";
import { DEVICE_COOKIE, readDevice } from "@/lib/auth/session";

// The family PIN guards the hidden setup screen on grandma's phone.
// FAMILY_PIN in the environment; the demo PIN is 0000 (listed in the README).
const PIN = process.env.FAMILY_PIN || "0000";

export async function checkPin(pin: string): Promise<boolean> {
  await syncShared();
  const a = Buffer.from(String(pin).slice(0, 8));
  const b = Buffer.from(PIN);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Unpair this phone: drop its device cookie and its row in the family's device list.
export async function disconnectDevice(pin: string): Promise<boolean> {
  await syncShared();
  if (!(await checkPin(pin))) return false;
  const jar = await cookies();
  const device = readDevice(jar.get(DEVICE_COOKIE)?.value);
  if (device) {
    const i = familyState.devices.findIndex((d) => d.id === device.deviceId);
    if (i >= 0) familyState.devices.splice(i, 1);
  }
  jar.delete(DEVICE_COOKIE);
  return true;
}
