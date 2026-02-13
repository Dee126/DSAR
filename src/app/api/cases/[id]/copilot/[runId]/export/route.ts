import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";

interface RouteParams {
  params: { id: string; runId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "read");
    checkPermission(user.role, "export", "read");

    // Verify case exists in tenant
    const dsarCase = await prisma.dSARCase.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
        deletedAt: null,
      },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    // Load the copilot run with full includes
    const run = await prisma.copilotRun.findFirst({
      where: {
        id: params.runId,
        caseId: params.id,
        tenantId: user.tenantId,
      },
      include: {
        queries: {
          include: {
            integration: true,
          },
        },
        findings: {
          include: {
            detectorResults: true,
          },
        },
      },
    });

    if (!run) {
      throw new ApiError(404, "Copilot run not found");
    }

    // Art. 9 Gate
    if (run.art9Flagged && run.art9ReviewStatus !== "APPROVED") {
      throw new ApiError(403, "Art. 9 review required before export");
    }

    // Build the export structure
    const exportData = {
      exportedAt: new Date().toISOString(),
      caseId: params.id,
      runId: params.runId,
      status: run.status,
      summary: run.summary,
      identityGraph: run.identityGraph,
      totalFindings: run.totalFindings,
      art9Flagged: run.art9Flagged,
      art9ReviewStatus: run.art9ReviewStatus,
      queries: run.queries.map((q) => ({
        id: q.id,
        provider: q.provider,
        integration: q.integration?.name,
        status: q.status,
        recordsFound: q.recordsFound,
        executionMs: q.executionMs,
      })),
      findings: run.findings.map((f) => ({
        id: f.id,
        source: f.source,
        location: f.location,
        title: f.title,
        description: f.description,
        dataCategories: f.dataCategories,
        severity: f.severity,
        isArt9: f.isArt9,
        art9Categories: f.art9Categories,
        recordCount: f.recordCount,
        redacted: f.redacted,
        detectors: f.detectorResults.map((d) => ({
          type: d.detectorType,
          pattern: d.patternName,
          matchCount: d.matchCount,
          sample: d.sampleMatch,
          confidence: d.confidence,
        })),
      })),
      responseDraft: run.responseDraft,
    };

    // Log audit
    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "COPILOT_EXPORT_GENERATED",
      entityType: "CopilotRun",
      entityId: params.runId,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: params.id,
        findingCount: run.findings.length,
      },
    });

    const body = JSON.stringify(exportData, null, 2);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${dsarCase.caseNumber}-copilot-${params.runId}.json"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
