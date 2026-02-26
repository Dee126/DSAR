import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-mode";
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
    const user = await getRequestUser();
    checkPermission(user.role, "data_inventory", "read");

    // Always use the authenticated user's tenant
    const tenantId = user.tenantId;

    const sp = request.nextUrl.searchParams;
    const caseId = sp.get("caseId") || undefined;
    const runId = sp.get("runId") || undefined;

    // Build an optional where-clause for findings so we can scope to a
    // specific case / run when the caller provides those params.
    const findingsWhere: Record<string, unknown> = {};
    if (caseId) findingsWhere.caseId = caseId;
    if (runId) findingsWhere.runId = runId;

    // ── Dev-only debug: confirm tenant scoping ──────────────────────────
    let debug: Record<string, unknown> | undefined;
    if (process.env.NODE_ENV === "development") {
      const totalSystemsForTenant = await prisma.system.count({
        where: { tenantId },
      });
      debug = {
        tenantId,
        totalSystemsForTenant,
      };
      console.log("[heatmap/overview] debug %o", debug);
    }

    const systemRows = await prisma.system.findMany({
      where: { tenantId },
      include: {
        findings: {
          where: Object.keys(findingsWhere).length > 0 ? findingsWhere : undefined,
        },
      },
      orderBy: { name: "asc" },
    });

    let totalGreen = 0;
    let totalYellow = 0;
    let totalRed = 0;
    let totalFindings = 0;
    const globalStatusCounts: Record<string, number> = { OPEN: 0, ACCEPTED: 0, MITIGATING: 0, MITIGATED: 0 };
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
      const statusCounts: Record<string, number> = { OPEN: 0, ACCEPTED: 0, MITIGATING: 0, MITIGATED: 0 };
      for (const f of findings) {
        if (f.status in statusCounts) statusCounts[f.status]++;
      }

      // Per-system severity counts
      const severityCounts: Record<string, number> = { INFO: 0, WARNING: 0, CRITICAL: 0 };
      for (const f of findings) {
        if (f.severity in severityCounts) severityCounts[f.severity]++;
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
      for (const key of Object.keys(statusCounts)) {
        globalStatusCounts[key] = (globalStatusCounts[key] ?? 0) + statusCounts[key];
      }
      for (const f of findings) {
        globalCategoryCounts[f.dataCategory] = (globalCategoryCounts[f.dataCategory] ?? 0) + 1;
      }

      // ── AI summary counts ──────────────────────────────────────────────
      const analyzedFindings = findings.filter(
        (f) => f.aiReviewStatus === "ANALYZED",
      ).length;
      const pendingHumanDecisions = findings.filter(
        (f) =>
          (f.aiSuggestedAction === "DELETE" ||
            f.aiSuggestedAction === "REVIEW_REQUIRED") &&
          f.humanDecision === null,
      ).length;
      const highRiskRecommendations = findings.filter(
        (f) => f.aiSuggestedAction === "DELETE",
      ).length;

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
        ai: {
          analyzedFindings,
          pendingHumanDecisions,
          highRiskRecommendations,
        },
      };
    });

    // Sort categories by count descending for the summary
    const sortedCategoryCounts = Object.fromEntries(
      Object.entries(globalCategoryCounts).sort(([, a], [, b]) => b - a),
    );

    const totals = {
      green: totalGreen,
      yellow: totalYellow,
      red: totalRed,
      total: totalFindings,
    };

    const summary = {
      totalSystems: systemRows.length,
      totalFindings,
      statusCounts: globalStatusCounts,
      categoryCounts: sortedCategoryCounts,
    };

    return NextResponse.json({
      systems,
      systemsCount: systems.length,
      totals,
      summary,
      ...(debug ? { debug } : {}),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
