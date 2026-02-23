import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/heatmap
 *
 * Legacy endpoint — redirects shape to match /api/heatmap/overview contract.
 * Uses sensitivityScore for risk bands (green < 40, yellow 40-69, red >= 70).
 * riskScore = weighted average: (red*100 + yellow*60 + green*20) / total.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "data_inventory", "read");

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

    const tiles = systems.map((sys) => {
      const findings = sys.findings;
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
    });

    const allFindings = systems.flatMap((s) => s.findings);
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
