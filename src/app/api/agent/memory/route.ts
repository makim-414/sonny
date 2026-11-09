import { syncShared } from "@/lib/shared-state";
import { getMemory } from "@/lib/memory";

// GET /api/agent/memory : everything the TV knows about grandma (family app, demo).
export async function GET() {
  await syncShared();
  const memory = await getMemory();
  return Response.json({ backend: memory.backend, facts: await memory.all() });
}
