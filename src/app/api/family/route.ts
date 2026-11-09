import { connection } from "next/server";
import { logEvent, store } from "@/lib/store";
import { requestKind, summarize } from "@/components/family/derive";
import { T } from "@/components/family/strings";
import { currentGuardian } from "@/lib/auth/server";
import { FAMILY_MEMBERS, memberByEmail } from "@/lib/auth/members";
import { FAMILY_SENDER, familyState } from "./state";
import { familyView } from "./view";

// GET /api/family -> everything mom's phone needs in one poll.
// The summary is computed from the raw log on the server, so it can say "약 드셨어요"
// without sending grandma's own words to the phone.
export async function GET() {
  await connection();
  const me = memberByEmail((await currentGuardian())?.email);
  const view = familyView(store.events);
  return Response.json({
    events: view.events,
    hiddenCount: view.hiddenCount,
    summary: summarize(store.events, store.currentChannel),
    approvedIds: familyState.approvedIds,
    inboxWaiting: store.tvInbox.length,
    me: me ? { name: me.name, relation: me.relation, role: me.role, email: me.email, card: me.card } : null,
    members: FAMILY_MEMBERS.map(({ email, name, relation, role }) => ({ email, name, relation, role })),
    wallet: {
      currency: store.wallet.currency,
      balance: store.wallet.balance,
      perSpendLimit: store.wallet.perSpendLimit,
      spentThisWeek: store.wallet.ledger
        .filter((e) => e.status === "done" && e.amount < 0 && Date.now() - Date.parse(e.at) < 7 * 24 * 3600 * 1000)
        .reduce((sum, e) => sum - e.amount, 0),
    },
  });
}

type FamilyPost = {
  text?: string; // a message or a request for grandma's TV
  approve?: string; // event id of a taxi or order request mom approves
  from?: string;
};

// POST /api/family
//   { text }               -> mom's message or request goes to the TV inbox
//   { approve, text? }     -> mom approves a pending request; the TV is told to go ahead
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as FamilyPost | null;
  // Whoever is signed in sends it; the feed and Sonny see their name ("Sarah: ...").
  const g = await currentGuardian();
  const from = memberByEmail(g?.email)?.name || g?.name || body?.from?.trim() || FAMILY_SENDER;

  if (body?.approve) {
    const target = store.events.find((e) => e.id === body.approve);
    if (!target) return Response.json({ error: "unknown event id" }, { status: 404 });
    // A second tap on Approve must not send the TV the same go-ahead twice.
    if (familyState.approvedIds.includes(target.id)) return Response.json({ ok: true, duplicate: true });
    familyState.approvedIds.push(target.id);
    const text = body.text?.trim() || T.approveInbox(from, target.text);
    const item = { id: crypto.randomUUID(), at: new Date().toISOString(), from, text };
    store.tvInbox.push(item);
    const event = logEvent("family", `${from}: ${T.approvedLog(requestKind(target) ?? "other")}`);
    return Response.json({ ok: true, item, event }, { status: 201 });
  }

  const text = body?.text?.trim();
  if (!text) return Response.json({ error: "need { text } or { approve }" }, { status: 400 });
  if (text.length > 500) return Response.json({ error: "text is too long" }, { status: 400 });

  const item = { id: crypto.randomUUID(), at: new Date().toISOString(), from, text };
  store.tvInbox.push(item);
  const event = logEvent("family", `${from}: ${text}`);
  return Response.json({ ok: true, item, event }, { status: 201 });
}
