import { connection } from "next/server";
import { familyView } from "@/app/api/family/view";
import { familyState } from "@/app/api/family/state";
import { summarize } from "@/components/family/derive";
import { currentGuardian } from "@/lib/auth/server";
import { getMemory, isLesson } from "@/lib/memory";
import { store } from "@/lib/store";
import { stripeEnabled } from "../wallet";

// GET /admin/data : everything the admin tabs need besides the Today feed (/api/family).
export async function GET() {
  await connection();
  const guardian = await currentGuardian();
  if (!guardian) return Response.json({ error: "sign in as family" }, { status: 401 });

  let lessons: { id: string; text: string; at: string; provenance?: string }[] = [];
  let personalCount = 0;
  let memoryBackend = "unavailable";
  try {
    const memory = await getMemory();
    memoryBackend = memory.backend;
    const facts = await memory.all();
    lessons = facts.filter(isLesson).map(({ id, text, at, provenance }) => ({ id, text, at, provenance }));
    personalCount = facts.filter((f) => !isLesson(f) && f.source !== "family").length;
  } catch (err) {
    console.warn("[admin] memory unavailable:", err);
  }

  const view = familyView(store.events);
  const summaryOnly = view.events.filter((e) => e.visibility === "summary").length;

  return Response.json({
    guardian: { name: guardian.name, email: guardian.email },
    taught: { lessons: lessons.reverse(), personalCount, memoryBackend },
    routines: familyState.routines,
    wallet: { ...store.wallet, ledger: [...store.wallet.ledger].reverse().slice(0, 30), stripe: stripeEnabled() },
    privacy: { shown: view.events.length - summaryOnly, summaryOnly, hidden: view.hiddenCount },
    device: { paired: familyState.devices, lastTalk: summarize(store.events, store.currentChannel).lastTalk },
  });
}
