export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";

/* -- GET — Generate and return evidence index export ----------------------- */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "read");
    checkPermission(user.role, "export", "read");

    const { id: caseId, runId } = await params;

    // Verify case exists in tenant
    const dsarCase = await prisma.dSARCase.findFirst({
      where: {
        id: caseId,
        tenantId: user.tenantId,
        deletedAt: null,
      },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    // Load the copilot run with full includes for export
    const run = await prisma.copilotRun.findFirst({
      where: {
        id: runId,
        caseId,
        tenantId: user.tenantId,
      },
      include: {
        queries: {
          include: {
            integration: {
              select: { id: true, name: true, provider: true },
            },
          },
        },
        evidenceItems: {
          include: {
            detectorResults: true,
          },
        },
        findings: true,
        summaries: {
          orderBy: { createdAt: "desc" },
        },
        exports: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!run) {
      throw new ApiError(404, "Copilot run not found");
    }

    // Legal gate: if special category data detected and not approved, block export
    if (
      run.containsSpecialCategory &&
      run.legalApprovalStatus !== "APPROVED" &&
      run.legalApprovalStatus !== "NOT_REQUIRED"
    ) {
      throw new ApiError(
        403,
        "Legal approval is required before exporting this run. " +
          "Special category data (Art. 9) was detected and the legal gate " +
          `status is currently "${run.legalApprovalStatus}". ` +
          "A DPO or legal counsel must approve the run before export is permitted."
      );
    }

    // Build the evidence index export structure
    const exportData = {
      exportedAt: new Date().toISOString(),
      caseId,
      caseNumber: dsarCase.caseNumber,
      runId,
      status: run.status,
      justification: run.justification,
      scopeSummary: run.scopeSummary,
      resultSummary: run.resultSummary,
      totalFindings: run.totalFindings,
      totalEvidenceItems: run.totalEvidenceItems,
      containsSpecialCategory: run.containsSpecialCategory,
      legalApprovalStatus: run.legalApprovalStatus,
      queries: run.queries.map((q) => ({
        id: q.id,
        queryText: q.queryText,
        queryIntent: q.queryIntent,
        provider: q.provider,
        integration: q.integration?.name ?? null,
        status: q.status,
        recordsFound: q.recordsFound,
        executionMs: q.executionMs,
        errorMessage: q.errorMessage,
      })),
      evidenceItems: run.evidenceItems.map((e) => ({
        id: e.id,
        provider: e.provider,
        workload: e.workload,
        itemType: e.itemType,
        location: e.location,
        title: e.title,
        contentHandling: e.contentHandling,
        sensitivityScore: e.sensitivityScore,
        detectorResults: e.detectorResults.map((d) => ({
          detectorType: d.detectorType,
          detectedElements: d.detectedElements,
          detectedCategories: d.detectedCategories,
          containsSpecialCategorySuspected: d.containsSpecialCategorySuspected,
        })),
      })),
      findings: run.findings.map((f) => ({
        id: f.id,
        dataCategory: f.dataCategory,
        severity: f.severity,
        confidence: f.confidence,
        summary: f.summary,
        evidenceItemIds: f.evidenceItemIds,
        containsSpecialCategory: f.containsSpecialCategory,
        containsThirdPartyDataSuspected: f.containsThirdPartyDataSuspected,
        requiresLegalReview: f.requiresLegalReview,
      })),
      summaries: run.summaries.map((s) => ({
        id: s.id,
        summaryType: s.summaryType,
        content: s.content,
        createdAt: s.createdAt.toISOString(),
      })),
    };

    // Log audit
    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "copilot_export.generated",
      entityType: "CopilotRun",
      entityId: runId,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId,
        caseNumber: dsarCase.caseNumber,
        findingCount: run.findings.length,
        evidenceItemCount: run.evidenceItems.length,
      },
    });

    const body = JSON.stringify(exportData, null, 2);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${dsarCase.caseNumber}-copilot-${runId}.json"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
