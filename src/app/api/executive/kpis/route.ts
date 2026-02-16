import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce, has } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { calculateKPIs, storeKpiSnapshot } from "@/lib/kpi-service";
import { kpiDateRangeSchema } from "@/lib/validation";

/**
 * GET /api/executive/kpis — Calculate current KPIs
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EXEC_DASHBOARD_VIEW");

    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const kpi = await calculateKPIs(
      user.tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    // Mask financial metrics if user lacks permission
    if (!has(user.role, "EXEC_FINANCIAL_VIEW")) {
      kpi.estimatedCostPerDsar = null;
      kpi.estimatedTimeSavedPerDsar = null;
      kpi.totalTimeSavedMonthly = null;
    }

    return NextResponse.json(kpi);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/executive/kpis — Store a KPI snapshot
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EXEC_KPI_CONFIG");

    const body = await request.json();
    const { period, snapshotDate } = kpiDateRangeSchema.parse(body);

    const snapshot = await storeKpiSnapshot(
      user.tenantId,
      period ?? "MONTHLY",
      snapshotDate ? new Date(snapshotDate) : undefined,
    );

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "KPI_SNAPSHOT_STORED",
      entityType: "PrivacyKpiSnapshot",
      entityId: snapshot.id,
      ip,
      userAgent,
      details: { period },
    });

    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
