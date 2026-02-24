import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveHeatmapScope } from "@/lib/resolve-heatmap-scope";

export const dynamic = "force-dynamic";

/**
 * GET /api/heatmap/overview?caseId=...&runId=...
 *
 * Returns per-system risk overview based on finding sensitivityScore bands:
 *   green:  sensitivityScore < 40
 *   yellow: sensitivityScore 40–69
 *   red:    sensitivityScore >= 70
 *
 * riskScore = weighted average: (red*100 + yellow*60 + green*20) / total
 * lastScanAt = latest finding.createdAt for that system (null if none)
 *
 * Queries findings directly (not through system.findings relation) so that
 * findings without a systemId are still included in totals.
 *
 * Optional params:
 *   caseId — scope to a specific DSAR case (fallback: newest case)
 *   runId  — scope to a specific copilot run (fallback: newest run for case)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "data_inventory", "read");

    const { searchParams } = request.nextUrl;

    // ── Resolve caseId / runId with fallback ─────────────────────────
    const { caseId, runId } = await resolveHeatmapScope(
      user.tenantId,
      searchParams.get("caseId"),
      searchParams.get("runId")
    );

    // ── Build finding where filter (no run.status filter!) ───────────
    const findingWhere: Prisma.FindingWhereInput = {
      tenantId: user.tenantId,
      ...(caseId ? { caseId } : {}),
      ...(runId ? { runId } : {}),
    };

    console.log(
      `[heatmap/overview] tenantId=${user.tenantId} caseId=${caseId ?? "(auto-none)"} runId=${runId ?? "(auto-none)"} where=${JSON.stringify(findingWhere)}`
    );

    // ── Query findings directly ──────────────────────────────────────
    const allFindings = await prisma.finding.findMany({
      where: findingWhere,
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

    // ── Load in-scope systems for metadata ───────────────────────────
    const systems = await prisma.system.findMany({
      where: { tenantId: user.tenantId, inScopeForDsar: true },
      select: {
        id: true,
        name: true,
        connectorType: true,
        description: true,
        criticality: true,
        containsSpecialCategories: true,
      },
      orderBy: { name: "asc" },
    });
    const systemMap = new Map(systems.map((s) => [s.id, s]));

    // ── Group findings by systemId ───────────────────────────────────
    type FindingRow = (typeof allFindings)[number];
    const grouped = new Map<string | null, FindingRow[]>();
    for (const f of allFindings) {
      const key = f.systemId;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(f);
    }

    // ── Helper: build a tile from a list of findings ─────────────────
    const buildTile = (
      sysId: string,
      sysName: string,
      sysType: string | null,
      description: string | null,
      criticality: string | null,
      containsSpecialCategories: boolean,
      findings: FindingRow[]
    ) => {
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
        systemId: sysId,
        systemName: sysName,
        systemType: sysType,
        lastScanAt: lastScanAt ? lastScanAt.toISOString() : null,
        counts: { green, yellow, red, total },
        riskScore,
        description,
        criticality,
        containsSpecialCategories,
        statusCounts,
        severityCounts,
        specialCategoryCount,
        categoryBreakdown,
      };
    };

    // ── Build tiles ──────────────────────────────────────────────────
    const systemTiles: ReturnType<typeof buildTile>[] = [];

    for (const [sysId, findings] of grouped) {
      if (sysId && systemMap.has(sysId)) {
        const sys = systemMap.get(sysId)!;
        systemTiles.push(
          buildTile(
            sys.id,
            sys.name,
            sys.connectorType,
            sys.description,
            sys.criticality,
            sys.containsSpecialCategories,
            findings
          )
        );
      } else if (sysId) {
        // System not in-scope or deleted — still surface its findings
        systemTiles.push(
          buildTile(sysId, `System ${sysId.slice(0, 8)}…`, null, null, null, false, findings)
        );
      } else {
        // Findings without systemId
        systemTiles.push(
          buildTile("__unassigned__", "(Unassigned)", null, null, null, false, findings)
        );
      }
    }

    // Add empty tiles for in-scope systems that have zero findings
    for (const sys of systems) {
      if (!grouped.has(sys.id)) {
        systemTiles.push(
          buildTile(
            sys.id,
            sys.name,
            sys.connectorType,
            sys.description,
            sys.criticality,
            sys.containsSpecialCategories,
            []
          )
        );
      }
    }

    systemTiles.sort((a, b) => a.systemName.localeCompare(b.systemName));

    // ── Global totals ────────────────────────────────────────────────
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

    const _warnings: string[] = [];
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_PRISMA_URL) {
      _warnings.push("No DATABASE_URL configured — using Prisma fallback");
    }

    return NextResponse.json({
      systems: systemTiles,
      totals,
      summary: {
        totalSystems: systems.length,
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
      ...(_warnings.length > 0 ? { _warnings } : {}),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
