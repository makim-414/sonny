import { setPlan, wellness } from "@/lib/agent/wellness";
import { currentGuardian } from "@/lib/auth/server";
import type { HealthPlan } from "@/lib/types";

// GET/POST /api/agent/health-plan : which wellness checks Sonny runs (guardian only).
export async function GET() {
  if (!(await currentGuardian())) return Response.json({ error: "guardian only" }, { status: 403 });
  return Response.json({ plan: wellness.plan });
}

export async function POST(request: Request) {
  if (!(await currentGuardian())) return Response.json({ error: "guardian only" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as Partial<HealthPlan> | null;
  if (!body) return Response.json({ error: "need { bp?, mind? }" }, { status: 400 });
  return Response.json({ plan: setPlan(body) });
}
