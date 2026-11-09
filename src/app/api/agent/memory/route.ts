import { getMemory } from "@/lib/memory";

// GET /api/agent/memory : everything the TV knows about grandma (family app, demo).
export async function GET() {
  const memory = await getMemory();
  return Response.json({ backend: memory.backend, facts: await memory.all() });
}
