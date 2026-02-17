export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { calculateMaturityScores } from "@/lib/kpi-service";
import { getMaturityTrends } from "@/lib/trend-service";

/**
 * GET /api/executive/maturity — Get maturity scores
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EXEC_DASHBOARD_VIEW");

    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "current"; // current | trends

    if (type === "trends") {
      const months = parseInt(url.searchParams.get("months") ?? "12", 10);
      const trends = await getMaturityTrends(user.tenantId, months);
      return NextResponse.json(trends);
    }

    const scores = await calculateMaturityScores(user.tenantId);
    return NextResponse.json(scores);
  } catch (error) {
    return handleApiError(error);
  }
}
