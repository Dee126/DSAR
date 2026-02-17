import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import {
  canExportGovernanceReport,
  exportReportAsCSV,
  exportReportAsJSON,
  buildReportSummary,
} from "@/lib/copilot/governance-report";
import { getActivityLogEntries } from "@/lib/copilot/activity-log-store";

/**
 * GET /api/governance/report-export?format=csv|json
 * Export governance report. Only DPO/Admin.
 * All identifiers are pre-masked.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (!canExportGovernanceReport(user.role)) {
      return NextResponse.json(
        { error: "Only DPO/Admin can export governance reports.", code: "REPORT_EXPORT_FORBIDDEN" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";

    if (format !== "csv" && format !== "json") {
      return NextResponse.json(
        { error: "Invalid format. Must be 'csv' or 'json'.", code: "INVALID_FORMAT" },
        { status: 400 },
      );
    }

    const entries = getActivityLogEntries();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const summary = buildReportSummary(entries, thirtyDaysAgo, now);

    // Audit log the export
    const clientInfo = getClientInfo(request);
    await logAudit({
      action: "GOVERNANCE_REPORT_EXPORTED",
      actorUserId: user.id,
      tenantId: user.tenantId,
      entityType: "GovernanceReport",
      details: {
        format,
        entryCount: entries.length,
        exportedBy: user.name,
        role: user.role,
      },
      ...clientInfo,
    });

    if (format === "csv") {
      const csv = exportReportAsCSV(entries);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="governance-report-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    const json = exportReportAsJSON(entries, summary);
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="governance-report-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
