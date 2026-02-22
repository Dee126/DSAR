import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/heatmap
 *
 * Returns aggregated heatmap data per system:
 *   - finding counts by risk band (green/yellow/red)
 *   - overall risk score (weighted average)
 *   - finding counts by status
 */
export async function GET() {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "read");

    // Fetch all systems for the tenant that are in scope
    const systems = await prisma.system.findMany({
      where: { tenantId: user.tenantId, inScopeForDsar: true },
      select: {
        id: true,
        name: true,
        description: true,
        criticality: true,
        containsSpecialCategories: true,
        findings: {
          select: {
            id: true,
            riskScore: true,
            severity: true,
            status: true,
            dataCategory: true,
            containsSpecialCategory: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const tiles = systems.map((sys) => {
      const findings = sys.findings;
      const total = findings.length;

      const green = findings.filter((f) => f.riskScore < 40).length;
      const yellow = findings.filter(
        (f) => f.riskScore >= 40 && f.riskScore < 70
      ).length;
      const red = findings.filter((f) => f.riskScore >= 70).length;

      // Use avg of top 20 findings (highest risk) for the overall score
      const top20 = [...findings]
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 20);
      const avgRisk =
        top20.length > 0
          ? Math.round(
              top20.reduce((sum, f) => sum + f.riskScore, 0) / top20.length
            )
          : 0;

      const statusCounts = {
        NEW: findings.filter((f) => f.status === "NEW").length,
        ACCEPTED: findings.filter((f) => f.status === "ACCEPTED").length,
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
        description: sys.description,
        criticality: sys.criticality,
        containsSpecialCategories: sys.containsSpecialCategories,
        totalFindings: total,
        riskBands: { green, yellow, red },
        overallRiskScore: avgRisk,
        statusCounts,
        severityCounts,
        specialCategoryCount,
      };
    });

    // Global aggregates for charts
    const allFindings = systems.flatMap((s) => s.findings);
    const summary = {
      totalSystems: systems.length,
      totalFindings: allFindings.length,
      riskBands: {
        green: allFindings.filter((f) => f.riskScore < 40).length,
        yellow: allFindings.filter(
          (f) => f.riskScore >= 40 && f.riskScore < 70
        ).length,
        red: allFindings.filter((f) => f.riskScore >= 70).length,
      },
      statusCounts: {
        NEW: allFindings.filter((f) => f.status === "NEW").length,
        ACCEPTED: allFindings.filter((f) => f.status === "ACCEPTED").length,
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

    return NextResponse.json({ tiles, summary });
  } catch (error) {
    return handleApiError(error);
  }
}
