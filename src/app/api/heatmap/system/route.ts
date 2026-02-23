export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * GET /api/heatmap/system?systemId=...&limit=50&offset=0&minScore=&category=&status=&color=&sort=score|lastSeen&dir=desc|asc
 *
 * Returns findings for a single system with counts, pagination, and filters.
 * Default sort: sensitivityScore desc, createdAt desc.
 *
 * Severity bands (based on sensitivityScore):
 *   green:  < 40
 *   yellow: 40–69
 *   red:    >= 70
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
        connectorType: true,
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

    // Color filter → sensitivityScore bands
    const color = searchParams.get("color");
    if (color === "green") {
      where.sensitivityScore = { lt: 40 };
    } else if (color === "yellow") {
      where.sensitivityScore = { gte: 40, lt: 70 };
    } else if (color === "red") {
      where.sensitivityScore = { gte: 70 };
    }

    // Minimum score filter
    const minScore = searchParams.get("minScore");
    if (minScore && !color) {
      const min = parseInt(minScore, 10);
      if (!isNaN(min)) {
        where.sensitivityScore = { gte: min };
      }
    }

    // Category filter (accept both "category" and "piiCategory" params)
    const category =
      searchParams.get("category") ?? searchParams.get("piiCategory");
    if (category) {
      where.dataCategory = category as Prisma.EnumDataCategoryFilter;
    }

    // Status filter
    const status = searchParams.get("status");
    if (status) {
      where.status = status as Prisma.EnumFindingStatusFilter;
    }

    // Date range filter
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      where.createdAt = {};
      if (from)
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(from);
      if (to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(to);
    }

    // Pagination
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10))
    );
    const offset = Math.max(
      0,
      parseInt(searchParams.get("offset") ?? "0", 10)
    );

    // Sorting — default: sensitivityScore desc, createdAt desc
    const sort = searchParams.get("sort") ?? "score";
    const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";

    const orderBy: Prisma.FindingOrderByWithRelationInput[] =
      sort === "lastSeen"
        ? [{ createdAt: dir }, { sensitivityScore: "desc" }]
        : [{ sensitivityScore: dir }, { createdAt: "desc" }];

    // Fetch findings with pagination + total count
    const [findings, totalCount] = await Promise.all([
      prisma.finding.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        select: {
          id: true,
          summary: true,
          piiCategory: true,
          sensitivityScore: true,
          riskScore: true,
          severity: true,
          status: true,
          dataCategory: true,
          confidence: true,
          containsSpecialCategory: true,
          dataAssetLocation: true,
          snippetPreview: true,
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
      }),
      prisma.finding.count({ where }),
    ]);

    // Compute counts across ALL findings for this system (unfiltered)
    const allFindings = await prisma.finding.findMany({
      where: { tenantId: user.tenantId, systemId },
      select: { sensitivityScore: true },
    });

    const counts = {
      green: allFindings.filter((f) => f.sensitivityScore < 40).length,
      yellow: allFindings.filter(
        (f) => f.sensitivityScore >= 40 && f.sensitivityScore < 70
      ).length,
      red: allFindings.filter((f) => f.sensitivityScore >= 70).length,
      total: allFindings.length,
    };

    // Map findings to the required DTO
    const findingRows = findings.map((f) => ({
      id: f.id,
      title: f.summary,
      piiCategory: f.piiCategory ?? f.dataCategory,
      sensitivityScore: f.sensitivityScore,
      status: f.status,
      createdAt: f.createdAt.toISOString(),
      snippetPreview: f.snippetPreview ?? null,
      // Extra fields for rich UI
      riskScore: f.riskScore,
      severity: f.severity,
      dataCategory: f.dataCategory,
      confidence: f.confidence,
      containsSpecialCategory: f.containsSpecialCategory,
      dataAssetLocation: f.dataAssetLocation,
      statusComment: f.statusComment,
      mitigationDueDate: f.mitigationDueDate
        ? f.mitigationDueDate.toISOString()
        : null,
      statusChangedAt: f.statusChangedAt
        ? f.statusChangedAt.toISOString()
        : null,
      run: f.run,
    }));

    return NextResponse.json({
      system: {
        id: system.id,
        name: system.name,
        type: system.connectorType,
        description: system.description,
        criticality: system.criticality,
        containsSpecialCategories: system.containsSpecialCategories,
      },
      findings: findingRows,
      counts,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
