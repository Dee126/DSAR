export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { ApiError, handleApiError } from "@/lib/errors";
import type { Prisma } from "@prisma/client";

/* -- GET — List evidence items for a copilot run (paginated) --------------- */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "read");

    const { id: caseId, runId } = await params;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    const itemType = searchParams.get("itemType");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10))
    );
    const skip = (page - 1) * limit;

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

    // Verify run exists in tenant/case
    const run = await prisma.copilotRun.findFirst({
      where: {
        id: runId,
        caseId,
        tenantId: user.tenantId,
      },
    });

    if (!run) {
      throw new ApiError(404, "Copilot run not found");
    }

    // Build filter conditions
    const where: Prisma.EvidenceItemWhereInput = {
      tenantId: user.tenantId,
      caseId,
      runId,
    };

    if (provider) {
      where.provider = provider;
    }

    if (itemType) {
      where.itemType = itemType as any;
    }

    // Fetch evidence items with detector results and total count in parallel
    const [evidenceItems, total] = await Promise.all([
      prisma.evidenceItem.findMany({
        where,
        include: {
          detectorResults: true,
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.evidenceItem.count({ where }),
    ]);

    return NextResponse.json({
      data: evidenceItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
