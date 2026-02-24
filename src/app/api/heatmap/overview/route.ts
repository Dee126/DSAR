import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/heatmap/overview
 * Returns per-system risk overview with totals and summary.
 *
 * Optional query params:
 *   - caseId: filter findings to a specific DSAR case
 *   - runId:  filter findings to a specific copilot run
 *
 * Sensitivity-score bands:
 *   green  < 40 | yellow 40-69 | red >= 70
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "data_inventory", "read");

    const sp = request.nextUrl.searchParams;
    const caseId = sp.get("caseId") || undefined;
    const runId = sp.get("runId") || undefined;

    if (process.env.NODE_ENV === "development") {
      console.log("[heatmap/overview] tenant=%s caseId=%s runId=%s", user.tenantId, caseId ?? "(all)", runId ?? "(all)");
    }

    // Build an optional where-clause for findings so we can scope to a
    // specific case / run when the caller provides those params.
    const findingsWhere: Record<string, unknown> = {};
    if (caseId) findingsWhere.caseId = caseId;
    if (runId) findingsWhere.runId = runId;

    const systemRows = await prisma.system.findMany({
      where: { tenantId: user.tenantId, inScopeForDsar: true },
      select: {
        id: true,
        name: true,
        connectorType: true,
        description: true,
        criticality: true,
        containsSpecialCategories: true,
        findings: {
          where: Object.keys(findingsWhere).length > 0 ? findingsWhere : undefined,
          select: {
            id: true,
            sensitivityScore: true,
            status: true,
            severity: true,
            dataCategory: true,
            containsSpecialCategory: true,
            createdAt: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    let totalGreen = 0;
    let totalYellow = 0;
    let totalRed = 0;
    let totalFindings = 0;
    const globalStatusCounts = { OPEN: 0, ACCEPTED: 0, MITIGATING: 0, MITIGATED: 0 };
    const globalCategoryCounts: Record<string, number> = {};

    const systems = systemRows.map((sys) => {
      const findings = sys.findings ?? [];
      const total = findings.length;
      const green = findings.filter((f) => (f.sensitivityScore ?? 0) < 40).length;
      const yellow = findings.filter((f) => {
        const s = f.sensitivityScore ?? 0;
        return s >= 40 && s <= 69;
      }).length;
      const red = findings.filter((f) => (f.sensitivityScore ?? 0) >= 70).length;

      const riskScore =
        total === 0
          ? 0
          : Math.round(((red * 100 + yellow * 60 + green * 20) / total) * 10) / 10;

      const lastScanAt =
        total === 0
          ? null
          : findings
              .map((f) => f.createdAt)
              .filter(Boolean)
              .sort((a, b) => +new Date(b) - +new Date(a))[0] ?? null;

      // Per-system status counts
      const statusCounts = { OPEN: 0, ACCEPTED: 0, MITIGATING: 0, MITIGATED: 0 };
      for (const f of findings) {
        if (f.status in statusCounts) statusCounts[f.status as keyof typeof statusCounts]++;
      }

      // Per-system severity counts
      const severityCounts = { INFO: 0, WARNING: 0, CRITICAL: 0 };
      for (const f of findings) {
        if (f.severity in severityCounts) severityCounts[f.severity as keyof typeof severityCounts]++;
      }

      // Special category count
      const specialCategoryCount = findings.filter((f) => f.containsSpecialCategory).length;

      // Per-system category breakdown with risk bands
      const categoryBreakdown: Record<string, { total: number; green: number; yellow: number; red: number }> = {};
      for (const f of findings) {
        const cat = f.dataCategory;
        if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { total: 0, green: 0, yellow: 0, red: 0 };
        categoryBreakdown[cat].total++;
        const s = f.sensitivityScore ?? 0;
        if (s >= 70) categoryBreakdown[cat].red++;
        else if (s >= 40) categoryBreakdown[cat].yellow++;
        else categoryBreakdown[cat].green++;
      }

      // Accumulate globals
      totalGreen += green;
      totalYellow += yellow;
      totalRed += red;
      totalFindings += total;
      for (const key of Object.keys(statusCounts) as (keyof typeof statusCounts)[]) {
        globalStatusCounts[key] += statusCounts[key];
      }
      for (const f of findings) {
        globalCategoryCounts[f.dataCategory] = (globalCategoryCounts[f.dataCategory] ?? 0) + 1;
      }

      return {
        systemId: sys.id,
        systemName: sys.name,
        systemType: sys.connectorType,
        description: sys.description,
        criticality: sys.criticality,
        containsSpecialCategories: sys.containsSpecialCategories,
        counts: { total, green, yellow, red },
        riskScore,
        lastScanAt,
        statusCounts,
        severityCounts,
        specialCategoryCount,
        categoryBreakdown,
      };
    });

    // Sort categories by count descending for the summary
    const sortedCategoryCounts = Object.fromEntries(
      Object.entries(globalCategoryCounts).sort(([, a], [, b]) => b - a),
    );

    const totals = {
      systems: systemRows.length,
      findings: totalFindings,
      total: totalFindings,
      green: totalGreen,
      yellow: totalYellow,
      red: totalRed,
    };

    const overallRisk =
      totalFindings === 0
        ? 0
        : Math.round(
            ((totalRed * 100 + totalYellow * 60 + totalGreen * 20) / totalFindings) * 10
          ) / 10;

    const summary = {
      overallRiskScore: overallRisk,
      totalSystems: systemRows.length,
      totalFindings,
      statusCounts: globalStatusCounts,
      categoryCounts: sortedCategoryCounts,
      scope: {
        caseId: caseId ?? null,
        runId: runId ?? null,
        tenantId: user.tenantId,
      },
    };

    return NextResponse.json({ systems, totals, summary });
  } catch (err) {
    return handleApiError(err);
  }
}
