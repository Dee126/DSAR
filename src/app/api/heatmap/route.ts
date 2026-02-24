export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/heatmap?caseId=...&runId=...
 *
 * Legacy endpoint — mirrors /api/heatmap/overview contract with additional
 * backward-compatible fields (tiles, riskBands, overallRiskScore).
 *
 * Uses the same active-scope resolution and fallback strategy as /overview.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "data_inventory", "read");

    const { searchParams } = new URL(request.url);

    // ── 1. Resolve active scope ──────────────────────────────────────────────
    let activeCaseId = searchParams.get("caseId") ?? undefined;
    let activeRunId = searchParams.get("runId") ?? undefined;

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

    // ── 2. Query findings with fallback ──────────────────────────────────────
    const baseWhere = {
      tenantId: user.tenantId,
      systemId: { not: null } as { not: null },
    };

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

    if (process.env.NODE_ENV === "development") {
      console.log(
        "[heatmap]",
        JSON.stringify({
          tenantId: user.tenantId,
          activeCaseId: activeCaseId ?? null,
          activeRunId: activeRunId ?? null,
          clause: usedClause,
          findingsCount: allFindings.length,
        })
      );
    }

    // ── 3. Group by system ───────────────────────────────────────────────────
    const systemIds = Array.from(new Set(allFindings.map((f) => f.systemId!)));

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

    const findingsBySystem = new Map<string, typeof allFindings>();
    for (const f of allFindings) {
      const sid = f.systemId!;
      if (!findingsBySystem.has(sid)) findingsBySystem.set(sid, []);
      findingsBySystem.get(sid)!.push(f);
    }

    // ── 4. Build tiles ───────────────────────────────────────────────────────
    const tiles = systemIds
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

        return {
          systemId: sys.id,
          systemName: sys.name,
          systemType: sys.connectorType,
          description: sys.description,
          criticality: sys.criticality,
          containsSpecialCategories: sys.containsSpecialCategories,
          totalFindings: total,
          counts: { green, yellow, red, total },
          riskScore,
          overallRiskScore: riskScore,
          riskBands: { green, yellow, red },
          statusCounts,
          severityCounts,
          specialCategoryCount,
          lastScanAt: lastScanAt ? lastScanAt.toISOString() : null,
        };
      })
      .filter(Boolean);

    // ── 5. Totals & summary ──────────────────────────────────────────────────
    const totals = {
      green: allFindings.filter((f) => f.sensitivityScore < 40).length,
      yellow: allFindings.filter(
        (f) => f.sensitivityScore >= 40 && f.sensitivityScore < 70
      ).length,
      red: allFindings.filter((f) => f.sensitivityScore >= 70).length,
      total: allFindings.length,
    };

    const summary = {
      totalSystems: systemIds.length,
      totalFindings: allFindings.length,
      riskBands: { ...totals },
      statusCounts: {
        OPEN: allFindings.filter((f) => f.status === "OPEN").length,
        ACCEPTED: allFindings.filter((f) => f.status === "ACCEPTED").length,
        MITIGATING: allFindings.filter((f) => f.status === "MITIGATING").length,
        MITIGATED: allFindings.filter((f) => f.status === "MITIGATED").length,
      },
      categoryCounts: Object.fromEntries(
        Object.entries(
          allFindings.reduce(
            (acc, f) => {
              acc[f.dataCategory] = (acc[f.dataCategory] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          )
        ).sort(([, a], [, b]) => b - a)
      ),
    };

    return NextResponse.json({ systems: tiles, tiles, totals, summary });
  } catch (error) {
    return handleApiError(error);
  }
}
