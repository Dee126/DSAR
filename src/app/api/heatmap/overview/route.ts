import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/heatmap/overview
 * Returns per-system risk overview based on findings (Finding.systemId != null).
 * Optional query params:
 *  - caseId
 *  - runId
 * If scoped query returns 0 findings, falls back to tenant-only.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "data_inventory", "read");

    const tenantId = user.tenantId;
    const sp = request.nextUrl.searchParams;
    const caseId = sp.get("caseId") || undefined;
    const runId = sp.get("runId") || undefined;

    // Base clause: only findings that belong on the heatmap
    const baseWhere: any = {
      tenantId,
      systemId: { not: null },
    };

    const scopedWhere: any = { ...baseWhere };
    if (caseId) scopedWhere.caseId = caseId;
    if (runId) scopedWhere.runId = runId;

    // Try scoped first, fallback if empty
    let clause: "scoped" | "fallback" = "scoped";
    let findings = await prisma.finding.findMany({
      where: scopedWhere,
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
      orderBy: { createdAt: "desc" },
    });

    if (findings.length === 0) {
      clause = "fallback";
      findings = await prisma.finding.findMany({
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
        orderBy: { createdAt: "desc" },
      });
    }

    // Load tenant systems (NO inScopeForDsar filter for demo/dev)
    const systems = await prisma.system.findMany({
      where: { tenantId },
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

    // Group findings by systemId
    const bySystem = new Map<string, typeof findings>();
    for (const f of findings) {
      const sid = f.systemId as string;
      const arr = bySystem.get(sid) || [];
      arr.push(f);
      bySystem.set(sid, arr);
    }

    const systemTiles = systems
      .map((sys) => {
        const fs = bySystem.get(sys.id) || [];
        if (fs.length === 0) return null;

        const total = fs.length;
        const green = fs.filter((f) => (f.sensitivityScore ?? 0) < 40).length;
        const yellow = fs.filter(
          (f) =>
            (f.sensitivityScore ?? 0) >= 40 && (f.sensitivityScore ?? 0) < 70
        ).length;
        const red = fs.filter((f) => (f.sensitivityScore ?? 0) >= 70).length;
        const riskScore =
          total > 0
            ? Math.round((red * 100 + yellow * 60 + green * 20) / total)
            : 0;

        const lastScanAt = fs[0]?.createdAt
          ? fs[0].createdAt.toISOString()
          : null;

        const statusCounts = {
          OPEN: fs.filter((f) => f.status === "OPEN").length,
          ACCEPTED: fs.filter((f) => f.status === "ACCEPTED").length,
          MITIGATING: fs.filter((f) => f.status === "MITIGATING").length,
          MITIGATED: fs.filter((f) => f.status === "MITIGATED").length,
        };
        const severityCounts = {
          INFO: fs.filter((f) => f.severity === "INFO").length,
          WARNING: fs.filter((f) => f.severity === "WARNING").length,
          CRITICAL: fs.filter((f) => f.severity === "CRITICAL").length,
        };
        const specialCategoryCount = fs.filter(
          (f) => f.containsSpecialCategory
        ).length;

        const categoryBreakdown: Record<
          string,
          { green: number; yellow: number; red: number; total: number }
        > = {};
        for (const f of fs) {
          const cat = String(f.dataCategory || "UNKNOWN");
          if (!categoryBreakdown[cat])
            categoryBreakdown[cat] = {
              green: 0,
              yellow: 0,
              red: 0,
              total: 0,
            };
          categoryBreakdown[cat].total++;
          const s = f.sensitivityScore ?? 0;
          if (s >= 70) categoryBreakdown[cat].red++;
          else if (s >= 40) categoryBreakdown[cat].yellow++;
          else categoryBreakdown[cat].green++;
        }

        return {
          systemId: sys.id,
          systemName: sys.name,
          systemType: sys.connectorType,
          lastScanAt,
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

    const totals = {
      green: findings.filter((f) => (f.sensitivityScore ?? 0) < 40).length,
      yellow: findings.filter(
        (f) =>
          (f.sensitivityScore ?? 0) >= 40 && (f.sensitivityScore ?? 0) < 70
      ).length,
      red: findings.filter((f) => (f.sensitivityScore ?? 0) >= 70).length,
      total: findings.length,
    };

    const categoryCounts = Object.fromEntries(
      Object.entries(
        findings.reduce(
          (acc, f) => {
            const k = String(f.dataCategory || "UNKNOWN");
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        )
      ).sort(([, a], [, b]) => b - a)
    );

    const distinctSystemIds = new Set(
      findings.map((f) => String(f.systemId))
    ).size;

    if (process.env.NODE_ENV === "development") {
      console.log("[heatmap/overview]", {
        tenantId,
        caseId,
        runId,
        clause,
        findings: findings.length,
        systems: systems.length,
        systemsWithFindings: distinctSystemIds,
      });
    }

    return NextResponse.json({
      systems: systemTiles,
      totals,
      summary: {
        totalSystems: distinctSystemIds,
        totalFindings: findings.length,
        statusCounts: {
          OPEN: findings.filter((f) => f.status === "OPEN").length,
          ACCEPTED: findings.filter((f) => f.status === "ACCEPTED").length,
          MITIGATING: findings.filter((f) => f.status === "MITIGATING").length,
          MITIGATED: findings.filter((f) => f.status === "MITIGATED").length,
        },
        categoryCounts,
      },
      scope: {
        activeCaseId: caseId || null,
        activeRunId: runId || null,
        clause,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
