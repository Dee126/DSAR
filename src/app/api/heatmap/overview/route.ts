export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/heatmap/overview
 *
 * Returns per-system risk overview based on finding sensitivityScore bands:
 *   green:  sensitivityScore < 40
 *   yellow: sensitivityScore 40–69
 *   red:    sensitivityScore >= 70
 *
 * riskScore = weighted average: (red*100 + yellow*60 + green*20) / total
 * lastScanAt = latest finding.createdAt for that system (null if none)
 */
export async function GET() {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "data_inventory", "read");

    // Fetch all in-scope systems with their findings
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

    // Build per-system response
    const systemTiles = systems.map((sys) => {
      const findings = sys.findings;
      const total = findings.length;

      const green = findings.filter((f) => f.sensitivityScore < 40).length;
      const yellow = findings.filter(
        (f) => f.sensitivityScore >= 40 && f.sensitivityScore < 70
      ).length;
      const red = findings.filter((f) => f.sensitivityScore >= 70).length;

      // Weighted risk score
      const riskScore =
        total > 0
          ? Math.round((red * 100 + yellow * 60 + green * 20) / total)
          : 0;

      // lastScanAt = latest finding.createdAt for this system
      const lastScanAt =
        findings.length > 0
          ? findings.reduce(
              (latest, f) =>
                f.createdAt > latest ? f.createdAt : latest,
              findings[0].createdAt
            )
          : null;

      // Status counts (kept for rich UI)
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
        lastScanAt: lastScanAt ? lastScanAt.toISOString() : null,
        counts: { green, yellow, red, total },
        riskScore,
        // Extra fields for rich UI
        description: sys.description,
        criticality: sys.criticality,
        containsSpecialCategories: sys.containsSpecialCategories,
        statusCounts,
        severityCounts,
        specialCategoryCount,
      };
    });

    // Global totals
    const allFindings = systems.flatMap((s) => s.findings);
    const totals = {
      green: allFindings.filter((f) => f.sensitivityScore < 40).length,
      yellow: allFindings.filter(
        (f) => f.sensitivityScore >= 40 && f.sensitivityScore < 70
      ).length,
      red: allFindings.filter((f) => f.sensitivityScore >= 70).length,
      total: allFindings.length,
    };

    // Additional summary data for charts
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

    return NextResponse.json({
      systems: systemTiles,
      totals,
      // Extra summary for dashboard charts
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
    });
  } catch (error) {
    return handleApiError(error);
  }
}
