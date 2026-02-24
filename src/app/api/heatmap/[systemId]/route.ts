import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { resolveHeatmapScope } from "@/lib/resolve-heatmap-scope";

export const dynamic = "force-dynamic";

/**
 * GET /api/heatmap/[systemId]
 *
 * Legacy endpoint — returns findings for a specific system.
 * Uses sensitivityScore for risk band filtering.
 * Query params: ?color=red|yellow|green &status=OPEN|ACCEPTED|MITIGATED &category=IDENTIFICATION|...
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { systemId: string } }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "data_inventory", "read");

    const { systemId } = params;
    const url = new URL(request.url);
    const color = url.searchParams.get("color");
    const status = url.searchParams.get("status");
    const category = url.searchParams.get("category");

    // Verify system belongs to tenant
    const system = await prisma.system.findFirst({
      where: { id: systemId, tenantId: user.tenantId },
      select: {
        id: true,
        name: true,
        connectorType: true,
        description: true,
        criticality: true,
        containsSpecialCategories: true,
      },
    });

    if (!system) {
      throw new ApiError(404, "System not found");
    }

    // Resolve optional caseId / runId with fallback to newest
    const { caseId, runId } = await resolveHeatmapScope(
      user.tenantId,
      url.searchParams.get("caseId"),
      url.searchParams.get("runId")
    );

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      systemId,
      ...(caseId ? { caseId } : {}),
      ...(runId ? { runId } : {}),
    };

    console.log(
      `[heatmap/${systemId}] tenantId=${user.tenantId} caseId=${caseId ?? "(auto-none)"} runId=${runId ?? "(auto-none)"} where=${JSON.stringify(where)}`
    );

    if (color === "green") {
      where.sensitivityScore = { lt: 40 };
    } else if (color === "yellow") {
      where.sensitivityScore = { gte: 40, lt: 70 };
    } else if (color === "red") {
      where.sensitivityScore = { gte: 70 };
    }

    if (status) {
      where.status = status;
    }

    if (category) {
      where.dataCategory = category;
    }

    const findings = await prisma.finding.findMany({
      where,
      select: {
        id: true,
        sensitivityScore: true,
        riskScore: true,
        severity: true,
        status: true,
        dataCategory: true,
        summary: true,
        piiCategory: true,
        snippetPreview: true,
        confidence: true,
        containsSpecialCategory: true,
        dataAssetLocation: true,
        statusComment: true,
        mitigationDueDate: true,
        createdAt: true,
        statusChangedAt: true,
        run: {
          select: {
            id: true,
            case: {
              select: { id: true, caseNumber: true },
            },
          },
        },
      },
      orderBy: [{ sensitivityScore: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      system: {
        id: system.id,
        name: system.name,
        type: system.connectorType,
        description: system.description,
        criticality: system.criticality,
        containsSpecialCategories: system.containsSpecialCategories,
      },
      findings,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
