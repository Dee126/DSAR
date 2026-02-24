import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveHeatmapScope } from "@/lib/resolve-heatmap-scope";

export const dynamic = "force-dynamic";

/**
 * GET /api/heatmap?caseId=...&runId=...
 *
 * Legacy endpoint — redirects shape to match /api/heatmap/overview contract.
 * Uses sensitivityScore for risk bands (green < 40, yellow 40-69, red >= 70).
 * riskScore = weighted average: (red*100 + yellow*60 + green*20) / total.
 *
 * Queries findings directly (not through system.findings relation) so that
 * findings without a systemId are still included in totals.
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
      `[heatmap] tenantId=${user.tenantId} caseId=${caseId ?? "(auto-none)"} runId=${runId ?? "(auto-none)"} where=${JSON.stringify(findingWhere)}`
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

    // ── Helper: build a tile ─────────────────────────────────────────
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
              (latest, f) => (f.createdAt > latest ? f.createdAt : latest),
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
        systemId: sysId,
        systemName: sysName,
        systemType: sysType,
        description,
        criticality,
        containsSpecialCategories,
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
    };

    // ── Build tiles ──────────────────────────────────────────────────
    const tiles: ReturnType<typeof buildTile>[] = [];

    for (const [sysId, findings] of grouped) {
      if (sysId && systemMap.has(sysId)) {
        const sys = systemMap.get(sysId)!;
        tiles.push(
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
        tiles.push(
          buildTile(sysId, `System ${sysId.slice(0, 8)}…`, null, null, null, false, findings)
        );
      } else {
        tiles.push(
          buildTile("__unassigned__", "(Unassigned)", null, null, null, false, findings)
        );
      }
    }

    // Add empty tiles for in-scope systems without findings
    for (const sys of systems) {
      if (!grouped.has(sys.id)) {
        tiles.push(
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

    tiles.sort((a, b) => a.systemName.localeCompare(b.systemName));

    // ── Global totals ────────────────────────────────────────────────
    const totals = {
      green: allFindings.filter((f) => f.sensitivityScore < 40).length,
      yellow: allFindings.filter(
        (f) => f.sensitivityScore >= 40 && f.sensitivityScore < 70
      ).length,
      red: allFindings.filter((f) => f.sensitivityScore >= 70).length,
      total: allFindings.length,
    };

    const summary = {
      totalSystems: systems.length,
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
