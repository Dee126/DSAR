import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { exportKpiData, listExportRuns } from "@/lib/export-service";

/**
 * GET /api/executive/exports — List export runs
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EXEC_REPORT_EXPORT");

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);

    const runs = await listExportRuns(user.tenantId, limit);
    return NextResponse.json(runs);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/executive/exports — Create a new KPI data export
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EXEC_REPORT_EXPORT");

    const body = await request.json();
    const format = body.format ?? "CSV";
    const months = body.months ?? 12;

    const result = await exportKpiData(user.tenantId, user.id, {
      format,
      months,
      includeForecasts: body.includeForecasts ?? false,
      includeTrends: body.includeTrends ?? false,
      includeAutomation: body.includeAutomation ?? false,
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "KPI_DATA_EXPORTED",
      entityType: "BoardExportRun",
      entityId: result.exportRunId,
      ip,
      userAgent,
      details: { format, months },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
