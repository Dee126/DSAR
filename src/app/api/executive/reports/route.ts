export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { generateBoardReport, listReportRuns } from "@/lib/board-report-service";
import { generateReportSchema } from "@/lib/validation";

/**
 * GET /api/executive/reports — List report runs
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EXEC_DASHBOARD_VIEW");

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);

    const runs = await listReportRuns(user.tenantId, limit);
    return NextResponse.json(runs);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/executive/reports — Generate a new board report
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EXEC_REPORT_GENERATE");

    const body = await request.json();
    const parsed = generateReportSchema.parse(body);

    const { reportRunId, report } = await generateBoardReport(
      user.tenantId,
      user.id,
      {
        title: parsed.title,
        format: parsed.format,
        sections: parsed.sections,
        startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
        endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
      },
    );

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "BOARD_REPORT_GENERATED",
      entityType: "ExecutiveReportRun",
      entityId: reportRunId,
      ip,
      userAgent,
      details: { format: parsed.format, sections: parsed.sections },
    });

    return NextResponse.json({ reportRunId, report }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
