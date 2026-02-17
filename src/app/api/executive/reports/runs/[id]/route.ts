export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { downloadReportRun } from "@/lib/board-report-service";

/**
 * GET /api/executive/reports/runs/[id] — Download a report run file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EXEC_REPORT_EXPORT");

    const { id } = await params;
    const result = await downloadReportRun(user.tenantId, id);

    if (!result) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "BOARD_REPORT_DOWNLOADED",
      entityType: "ExecutiveReportRun",
      entityId: id,
      ip,
      userAgent,
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": String(result.buffer.length),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
