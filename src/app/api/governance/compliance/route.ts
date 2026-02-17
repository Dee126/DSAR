/**
 * API: /api/governance/compliance
 *
 * Module 9.8 — Compliance Evidence Pack
 *
 * GET  — List frameworks, runs, findings
 * POST — Run assessment, generate export
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import {
  getFrameworks,
  getComplianceRuns,
  getRunFindings,
  runComplianceAssessment,
} from "@/lib/compliance-engine";
import {
  buildExportData,
  exportToJson,
  exportToHtmlReport,
} from "@/lib/compliance-export";

/**
 * GET /api/governance/compliance
 * Query: ?view=frameworks | runs | findings&runId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "GOVERNANCE_VIEW");

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "frameworks";

    switch (view) {
      case "frameworks": {
        const frameworks = await getFrameworks();
        return NextResponse.json({ frameworks });
      }

      case "runs": {
        const runs = await getComplianceRuns(user.tenantId);
        return NextResponse.json({ runs });
      }

      case "findings": {
        const runId = searchParams.get("runId");
        if (!runId) throw new ApiError(400, "runId required for findings view");
        const findings = await getRunFindings(user.tenantId, runId);
        return NextResponse.json({ findings });
      }

      default:
        throw new ApiError(400, `Unknown view: ${view}`);
    }
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/governance/compliance
 * Body: { action: "run_assessment" | "export_json" | "export_html", frameworkId, runId? }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const action = body.action as string;
    const { ip, userAgent } = getClientInfo(request);

    switch (action) {
      case "run_assessment": {
        enforce(user.role, "GOVERNANCE_EXPORT_REPORT");
        const { frameworkId } = body;
        if (!frameworkId) throw new ApiError(400, "frameworkId required");

        const { runId, result } = await runComplianceAssessment(
          user.tenantId,
          frameworkId,
          user.id,
        );

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "COMPLIANCE_ASSESSMENT_RUN",
          entityType: "ComplianceEvidenceRun",
          entityId: runId,
          ip,
          userAgent,
          details: { frameworkId, score: result.summary.score },
        });

        return NextResponse.json({ runId, result }, { status: 201 });
      }

      case "export_json": {
        enforce(user.role, "GOVERNANCE_EXPORT_REPORT");
        const { runId } = body;
        if (!runId) throw new ApiError(400, "runId required");

        const data = await buildExportData(user.tenantId, runId);
        const json = exportToJson(data);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "COMPLIANCE_EXPORT_JSON",
          entityType: "ComplianceEvidenceRun",
          entityId: runId,
          ip,
          userAgent,
        });

        return new NextResponse(json, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="compliance_${runId.slice(0, 8)}.json"`,
          },
        });
      }

      case "export_html": {
        enforce(user.role, "GOVERNANCE_EXPORT_REPORT");
        const { runId } = body;
        if (!runId) throw new ApiError(400, "runId required");

        const data = await buildExportData(user.tenantId, runId);
        const html = exportToHtmlReport(data);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "COMPLIANCE_EXPORT_HTML",
          entityType: "ComplianceEvidenceRun",
          entityId: runId,
          ip,
          userAgent,
        });

        return new NextResponse(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `attachment; filename="compliance_report_${runId.slice(0, 8)}.html"`,
          },
        });
      }

      default:
        throw new ApiError(400, `Unknown action: ${action}`);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
