import { weeklyReport } from "@/lib/agent/wellness";
import { currentGuardian } from "@/lib/auth/server";

// GET /api/agent/health-report : this week's readings and memory checks (guardian only).
export async function GET() {
  if (!(await currentGuardian())) return Response.json({ error: "guardian only" }, { status: 403 });
  return Response.json(weeklyReport());
}
