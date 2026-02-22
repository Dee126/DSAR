export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/heatmap/overview
 *
 * Returns one tile per in-scope system with:
 *   - green/yellow/red counters (by risk-score band)
 *   - overall risk score (0-100, avg of top-20)
 *   - status counts (OPEN / ACCEPTED / MITIGATING / MITIGATED)
 *   - severity counts
 *   - special-category count
 *   - last scan timestamp
 *
 * Also returns a global `summary` object for dashboard charts.
 * Always returns a stable DTO — empty arrays / zeroes when no data exists.
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

    // Fetch last completed scan per system
    const scanJobs = await prisma.scanJob.findMany({
      where: {
        tenantId: user.tenantId,
        status: "COMPLETED",
      },
      orderBy: { completedAt: "desc" },
      select: {
        systemId: true,
        completedAt: true,
      },
    });

    const lastScanBySystem = new Map<string, Date | null>();
    for (const sj of scanJobs) {
      if (!lastScanBySystem.has(sj.systemId)) {
        lastScanBySystem.set(sj.systemId, sj.completedAt);
      }
    }

    // Build per-system tiles
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
      const overallRiskScore =
        top20.length > 0
          ? Math.round(
              top20.reduce((sum, f) => sum + f.riskScore, 0) / top20.length
            )
          : 0;

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

      const lastScanAt = lastScanBySystem.get(sys.id) ?? null;

      return {
        systemId: sys.id,
        systemName: sys.name,
        description: sys.description,
        criticality: sys.criticality,
        containsSpecialCategories: sys.containsSpecialCategories,
        totalFindings: total,
        riskBands: { green, yellow, red },
        overallRiskScore,
        statusCounts,
        severityCounts,
        specialCategoryCount,
        lastScanAt,
      };
    });

    // Global aggregates
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

    return NextResponse.json({ tiles, summary });
  } catch (error) {
    return handleApiError(error);
  }
}
