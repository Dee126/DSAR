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
      where: { tenantId: user.tenantId },
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

      totalGreen += green;
      totalYellow += yellow;
      totalRed += red;
      totalFindings += total;

      return {
        systemId: sys.id,
        name: sys.name,
        connectorType: sys.connectorType,
        description: sys.description,
        criticality: sys.criticality,
        containsSpecialCategories: sys.containsSpecialCategories,
        counts: { total, green, yellow, red },
        riskScore,
        lastScanAt,
      };
    });

    const totals = {
      systems: systemRows.length,
      findings: totalFindings,
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
