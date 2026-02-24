import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/heatmap/overview
 * Per-system risk overview based on finding.sensitivityScore bands:
 *  green: < 40
 *  yellow: 40–69
 *  red: >= 70
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "data_inventory", "read");

    // Optional query params (harmless if not provided)
    const caseId = request.nextUrl.searchParams.get("caseId") || undefined;
    const runId = request.nextUrl.searchParams.get("runId") || undefined;

    // Fetch systems in scope (keep your original filter if you want it)
    const systems = await prisma.system.findMany({
      where: { tenantId: user.tenantId, inScopeForDsar: true },
      select: {
        id: true,
        name: true,
        connectorType: true,
        description: true,
        criticality: true,
        containsSpecialCategories: true,
        findings: {
          where: {
            ...(caseId ? { caseId } : {}),
            ...(runId ? { runId } : {}),
          },
          select: {
            id: true,
            sensitivityScore: true,
            riskScore: true,
            severity: true,
            status: true,
            dataCategory: true,
            containsSpecialCategory: true,
            createdAt: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const systemTiles = systems.map((sys) => {
      const findings = sys.findings ?? [];
      const total = findings.length;

      const green = findings.filter((f) => (f.sensitivityScore ?? 0) < 40).length;
      const yellow = findings.filter((f) => {
        const s = f.sensitivityScore ?? 0;
        return s >= 40 && s < 70;
      }).length;
      const red = findings.filter((f) => (f.sensitivityScore ?? 0) >= 70).length;

      const riskScore =
        total > 0 ? Math.round((red * 100 + yellow * 60 + green * 20) / total) : 0;

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

      const specialCategoryCount = findings.filter((f) => f.containsSpecialCategory).length;

      const categoryBreakdown: Record<
        string,
        { green: number; yellow: number; red: number; total: number }
      > = {};
      for (const f of findings) {
        const cat = (f.dataCategory ?? "UNKNOWN") as string;
        if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { green: 0, yellow: 0, red: 0, total: 0 };
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
    });

    const allFindings = systems.flatMap((s) => s.findings ?? []);

    const totals = {
      green: allFindings.filter((f) => (f.sensitivityScore ?? 0) < 40).length,
      yellow: allFindings.filter((f) => {
        const s = f.sensitivityScore ?? 0;
        return s >= 40 && s < 70;
      }).length,
      red: allFindings.filter((f) => (f.sensitivityScore ?? 0) >= 70).length,
      total: allFindings.length,
    };

    const categoryCounts = Object.fromEntries(
      Object.entries(
        allFindings.reduce((acc, f) => {
          const key = (f.dataCategory ?? "UNKNOWN") as string;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).sort(([, a], [, b]) => b - a)
    );

    return NextResponse.json({
      scope: { caseId: caseId ?? null, runId: runId ?? null },
      systems: systemTiles,
      totals,
      summary: {
        totalSystems: systems.length,
        totalFindings: allFindings.length,
        statusCounts: {
          OPEN: allFindings.filter((f) => f.status === "OPEN").length,
          ACCEPTED: allFindings.filter((f) => f.status === "ACCEPTED").length,
          MITIGATING: allFindings.filter((f) => f.status === "MITIGATING").length,
          MITIGATED: allFindings.filter((f) => f.status === "MITIGATED").length,
        },
        categoryCounts,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
