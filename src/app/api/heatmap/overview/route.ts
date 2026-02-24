export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/heatmap/overview?caseId=...&runId=...
 *
 * Returns per-system risk overview based on finding sensitivityScore bands:
 *   green:  sensitivityScore < 40
 *   yellow: sensitivityScore 40–69
 *   red:    sensitivityScore >= 70
 *
 * Active-scope resolution:
 *   1. Query params caseId/runId take precedence.
 *   2. Otherwise: latest CopilotRun / DSARCase for the tenant.
 *
 * Fallback strategy:
 *   Primary:  { tenantId, caseId, runId, systemId: not null }
 *   Fallback: { tenantId, systemId: not null }  (when primary yields 0 findings)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "data_inventory", "read");

    const { searchParams } = new URL(request.url);

    // ── 1. Resolve active scope ──────────────────────────────────────────────
    let activeCaseId = searchParams.get("caseId") ?? undefined;
    let activeRunId = searchParams.get("runId") ?? undefined;

    // Auto-detect latest run/case when not supplied via query params
    if (!activeRunId) {
      const latestRun = await prisma.copilotRun.findFirst({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      activeRunId = latestRun?.id;
    }

    if (!activeCaseId) {
      const latestCase = await prisma.dSARCase.findFirst({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      activeCaseId = latestCase?.id;
    }

    // ── 2. Query findings with fallback strategy ─────────────────────────────
    const baseWhere = {
      tenantId: user.tenantId,
      systemId: { not: null } as { not: null },
    };

    // Primary: scoped to caseId + runId (if available)
    const primaryWhere = {
      ...baseWhere,
      ...(activeCaseId ? { caseId: activeCaseId } : {}),
      ...(activeRunId ? { runId: activeRunId } : {}),
    };

    let usedClause: "primary" | "fallback" = "primary";

    let allFindings = await prisma.finding.findMany({
      where: primaryWhere,
      select: {
        id: true,
        systemId: true,
        sensitivityScore: true,
        riskScore: true,
        severity: true,
        status: true,
        dataCategory: true,
        containsSpecialCategory: true,
        createdAt: true,
      },
    });

    // Fallback: drop caseId/runId filter when primary yields 0
    if (allFindings.length === 0) {
      usedClause = "fallback";
      allFindings = await prisma.finding.findMany({
        where: baseWhere,
        select: {
          id: true,
          systemId: true,
          sensitivityScore: true,
          riskScore: true,
          severity: true,
          status: true,
          dataCategory: true,
          containsSpecialCategory: true,
          createdAt: true,
        },
      });
    }

    // ── Dev debug log ────────────────────────────────────────────────────────
    if (process.env.NODE_ENV === "development") {
      console.log(
        "[heatmap/overview]",
        JSON.stringify({
          tenantId: user.tenantId,
          activeCaseId: activeCaseId ?? null,
          activeRunId: activeRunId ?? null,
          clause: usedClause,
          findingsCount: allFindings.length,
        })
      );
    }

    // ── 3. Group findings by system ──────────────────────────────────────────
    const systemIds = Array.from(new Set(allFindings.map((f) => f.systemId!)));

    // Fetch system metadata for all referenced systems
    const systems = await prisma.system.findMany({
      where: { id: { in: systemIds }, tenantId: user.tenantId },
      select: {
        id: true,
        name: true,
        connectorType: true,
        description: true,
        criticality: true,
        containsSpecialCategories: true,
      },
    });

    const systemMap = new Map(systems.map((s) => [s.id, s]));

    // Group findings per system
    const findingsBySystem = new Map<string, typeof allFindings>();
    for (const f of allFindings) {
      const sid = f.systemId!;
      if (!findingsBySystem.has(sid)) findingsBySystem.set(sid, []);
      findingsBySystem.get(sid)!.push(f);
    }

    // ── 4. Build per-system tiles ────────────────────────────────────────────
    const systemTiles = systemIds
      .map((sid) => {
        const sys = systemMap.get(sid);
        if (!sys) return null;

        const findings = findingsBySystem.get(sid) ?? [];
        const total = findings.length;

        const green = findings.filter((f) => f.sensitivityScore < 40).length;
        const yellow = findings.filter(
          (f) => f.sensitivityScore >= 40 && f.sensitivityScore < 70
        ).length;
        const red = findings.filter((f) => f.sensitivityScore >= 70).length;

        const riskScore =
          total > 0
            ? Math.round((red * 100 + yellow * 60 + green * 20) / total)
            : 0;

        const lastScanAt =
          findings.length > 0
            ? findings.reduce(
                (latest, f) =>
                  f.createdAt > latest ? f.createdAt : latest,
                findings[0].createdAt
              )
            : null;

        const statusCounts = {
          OPEN: findings.filter((f) => f.status === "OPEN").length,
          ACCEPTED: findings.filter((f) => f.status === "ACCEPTED").length,
          MITIGATING: findings.filter((f) => f.status === "MITIGATING").length,
          MITIGATED: findings.filter((f) => f.status === "MITIGATED").length,
        };

        const severityCounts = {
          INFO: findings.filter((f) => f.severity === "INFO").length,
          WARNING: findings.filter((f) => f.severity === "WARNING").length,
          CRITICAL: findings.filter((f) => f.severity === "CRITICAL").length,
        };

        const specialCategoryCount = findings.filter(
          (f) => f.containsSpecialCategory
        ).length;

        // Per-category breakdown for the heatmap grid
        const categoryBreakdown: Record<
          string,
          { green: number; yellow: number; red: number; total: number }
        > = {};
        for (const f of findings) {
          const cat = f.dataCategory as string;
          if (!categoryBreakdown[cat])
            categoryBreakdown[cat] = { green: 0, yellow: 0, red: 0, total: 0 };
          categoryBreakdown[cat].total++;
          if (f.sensitivityScore >= 70) categoryBreakdown[cat].red++;
          else if (f.sensitivityScore >= 40) categoryBreakdown[cat].yellow++;
          else categoryBreakdown[cat].green++;
        }

        return {
          systemId: sys.id,
          systemName: sys.name,
          systemType: sys.connectorType,
          lastScanAt: lastScanAt ? lastScanAt.toISOString() : null,
          counts: { green, yellow, red, total },
          riskScore,
          description: sys.description,
          criticality: sys.criticality,
          containsSpecialCategories: sys.containsSpecialCategories,
          statusCounts,
          severityCounts,
          specialCategoryCount,
          categoryBreakdown,
        };
      })
      .filter(Boolean);

    // ── 5. Global totals ─────────────────────────────────────────────────────
    const totals = {
      green: allFindings.filter((f) => f.sensitivityScore < 40).length,
      yellow: allFindings.filter(
        (f) => f.sensitivityScore >= 40 && f.sensitivityScore < 70
      ).length,
      red: allFindings.filter((f) => f.sensitivityScore >= 70).length,
      total: allFindings.length,
    };

    const categoryCounts = Object.fromEntries(
      Object.entries(
        allFindings.reduce(
          (acc, f) => {
            acc[f.dataCategory] = (acc[f.dataCategory] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        )
      ).sort(([, a], [, b]) => b - a)
    );

    // totalSystems = distinct systemIds in the filtered findings
    const totalSystems = systemIds.length;

    // Surface warnings
    const _warnings: string[] = [];
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_PRISMA_URL) {
      _warnings.push("No DATABASE_URL configured — using Prisma fallback");
    }

    return NextResponse.json({
      systems: systemTiles,
      totals,
      summary: {
        totalSystems,
        totalFindings: allFindings.length,
        statusCounts: {
          OPEN: allFindings.filter((f) => f.status === "OPEN").length,
          ACCEPTED: allFindings.filter((f) => f.status === "ACCEPTED").length,
          MITIGATING: allFindings.filter((f) => f.status === "MITIGATING")
            .length,
          MITIGATED: allFindings.filter((f) => f.status === "MITIGATED").length,
        },
        categoryCounts,
      },
      // Scope metadata for client debugging
      scope: {
        activeCaseId: activeCaseId ?? null,
        activeRunId: activeRunId ?? null,
        clause: usedClause,
      },
      ...(_warnings.length > 0 ? { _warnings } : {}),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
