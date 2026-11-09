import { connection } from "next/server";
import { logEvent, store } from "@/lib/store";
import { FAMILY_SENDER, familyState } from "./state";

// GET /api/family -> what the family app needs besides the event feed.
export async function GET() {
  await connection();
  return Response.json({
    approvedIds: familyState.approvedIds,
    currentChannel: store.currentChannel,
    inboxWaiting: store.tvInbox.length,
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
  const from = body?.from?.trim() || FAMILY_SENDER;

  if (body?.approve) {
    const target = store.events.find((e) => e.id === body.approve);
    if (!target) return Response.json({ error: "unknown event id" }, { status: 404 });
    if (!familyState.approvedIds.includes(target.id)) familyState.approvedIds.push(target.id);
    const text = body.text?.trim() || `${from}가 승인했어요. 진행해 주세요: ${target.text}`;
    const item = { id: crypto.randomUUID(), at: new Date().toISOString(), from, text };
    store.tvInbox.push(item);
    const what = /택시|카카오|차량|배차/.test(target.text) ? "택시 요청을" : /주문|장보기|배달|구매|마트/.test(target.text) ? "주문을" : "요청을";
    const event = logEvent("family", `${from}: ${what} 승인했어요`);
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
