import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/heatmap/[systemId]
 *
 * Returns all findings for a specific system, with filtering support.
 * Query params: ?color=red|yellow|green &status=NEW|ACCEPTED|MITIGATED &category=IDENTIFICATION|...
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { systemId: string } }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "read");

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
        description: true,
        criticality: true,
        containsSpecialCategories: true,
      },
    });

    if (!system) {
      throw new ApiError(404, "System not found");
    }

    // Build filter conditions
    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      systemId,
    };

    if (color === "green") {
      where.riskScore = { lt: 40 };
    } else if (color === "yellow") {
      where.riskScore = { gte: 40, lt: 70 };
    } else if (color === "red") {
      where.riskScore = { gte: 70 };
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
        riskScore: true,
        severity: true,
        status: true,
        dataCategory: true,
        summary: true,
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
      orderBy: { riskScore: "desc" },
    });

    return NextResponse.json({ system, findings });
  } catch (error) {
    return handleApiError(error);
  }
}
