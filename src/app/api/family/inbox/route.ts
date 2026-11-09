import { connection } from "next/server";
import { store } from "@/lib/store";

// GET /api/family/inbox -> the TV takes everything waiting and the inbox is cleared.
export async function GET() {
  await connection();
  const items = store.tvInbox.splice(0, store.tvInbox.length);
  return Response.json(items);
}
