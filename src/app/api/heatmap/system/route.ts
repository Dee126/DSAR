export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * GET /api/heatmap/system?systemId=...&color=&piiCategory=&status=&from=&to=&sort=score|lastSeen&dir=desc|asc
 *
 * Returns findings for a single system with filtering and sorting.
 * Stable DTO — returns empty findings array when no data exists.
 *
 * Color filter maps to risk-score bands:
 *   green  → riskScore < 40
 *   yellow → riskScore 40–69
 *   red    → riskScore >= 70
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "data_inventory", "read");

    const { searchParams } = new URL(request.url);
    const systemId = searchParams.get("systemId");

    if (!systemId) {
      throw new ApiError(400, "systemId query parameter is required");
    }

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

    // Build where clause with filters
    const where: Prisma.FindingWhereInput = {
      tenantId: user.tenantId,
      systemId,
    };

    // Color filter → risk-score bands
    const color = searchParams.get("color");
    if (color === "green") {
      where.riskScore = { lt: 40 };
    } else if (color === "yellow") {
      where.riskScore = { gte: 40, lt: 70 };
    } else if (color === "red") {
      where.riskScore = { gte: 70 };
    }

    // PII category filter (also accept "category" param for compat)
    const piiCategory =
      searchParams.get("piiCategory") ?? searchParams.get("category");
    if (piiCategory) {
      where.dataCategory = piiCategory as Prisma.EnumDataCategoryFilter;
    }

    // Status filter
    const status = searchParams.get("status");
    if (status) {
      where.status = status as Prisma.EnumFindingStatusFilter;
    }

    // Date range filter (on createdAt)
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      where.createdAt = {};
      if (from)
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(from);
      if (to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(to);
    }

    // Sorting
    const sort = searchParams.get("sort") ?? "score";
    const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";

    let orderBy: Prisma.FindingOrderByWithRelationInput;
    if (sort === "lastSeen") {
      orderBy = { createdAt: dir };
    } else {
      orderBy = { riskScore: dir };
    }

    const findings = await prisma.finding.findMany({
      where,
      orderBy,
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
    });

    return NextResponse.json({ system, findings });
  } catch (error) {
    return handleApiError(error);
  }
}
