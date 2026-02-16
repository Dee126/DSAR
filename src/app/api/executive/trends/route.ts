import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { getKpiTrends, getMaturityTrends, comparePeriods } from "@/lib/trend-service";

/**
 * GET /api/executive/trends — Get KPI trend data
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EXEC_DASHBOARD_VIEW");

    const url = new URL(request.url);
    const months = parseInt(url.searchParams.get("months") ?? "12", 10);
    const type = url.searchParams.get("type") ?? "kpi"; // kpi | maturity | compare

    if (type === "maturity") {
      const maturity = await getMaturityTrends(user.tenantId, months);
      return NextResponse.json(maturity);
    }

    if (type === "compare") {
      const metric = url.searchParams.get("metric") ?? "totalDsars";
      const p1Start = url.searchParams.get("p1Start");
      const p1End = url.searchParams.get("p1End");
      const p2Start = url.searchParams.get("p2Start");
      const p2End = url.searchParams.get("p2End");

      if (!p1Start || !p1End || !p2Start || !p2End) {
        return NextResponse.json(
          { error: "Period comparison requires p1Start, p1End, p2Start, p2End" },
          { status: 400 },
        );
      }

      const comparison = await comparePeriods(
        user.tenantId,
        metric,
        new Date(p1Start),
        new Date(p1End),
        new Date(p2Start),
        new Date(p2End),
      );
      return NextResponse.json(comparison);
    }

    const trends = await getKpiTrends(user.tenantId, months);
    return NextResponse.json(trends);
  } catch (error) {
    return handleApiError(error);
  }
}
