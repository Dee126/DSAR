import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import {
  computeAutomationMetrics,
  getAutomationHistory,
  computeAutomationROI,
} from "@/lib/automation-metric-service";

/**
 * GET /api/executive/automation — Get automation metrics
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EXEC_DASHBOARD_VIEW");

    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "current"; // current | history | roi

    if (type === "history") {
      const months = parseInt(url.searchParams.get("months") ?? "12", 10);
      const history = await getAutomationHistory(user.tenantId, months);
      return NextResponse.json(history);
    }

    if (type === "roi") {
      enforce(user.role, "EXEC_FINANCIAL_VIEW");
      const roi = await computeAutomationROI(user.tenantId);
      return NextResponse.json(roi);
    }

    const current = await computeAutomationMetrics(user.tenantId);
    return NextResponse.json(current);
  } catch (error) {
    return handleApiError(error);
  }
}
