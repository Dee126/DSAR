import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/heatmap/overview
 * Returns per-system risk overview based on findings' sensitivityScore bands:
 * green: < 40, yellow: 40-69, red: >= 70
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "data_inventory", "read");

    const sp = request.nextUrl.searchParams;
    const caseId = sp.get("caseId") || undefined;
    const runId = sp.get("runId") || undefined;

    // Basic scope: always tenant-scoped
    // If caseId/runId present and your schema supports it, you can filter findings by them later.
    // For now we keep it robust to avoid empty dashboards.
    const systems = await prisma.system.findMany({
      where: { tenantId: user.tenantId },
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
            createdAt: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const tiles = systems.map((sys) => {
      const findings = sys.findings ?? [];
      const total = findings.length;
      const green = findings.filter((f) => (f.sensitivityScore ?? 0) < 40).length;
      const yellow = findings.filter((f) => {
        const s = f.sensitivityScore ?? 0;
        return s >= 40 && s <= 69;
      }).length;
      const red = findings.filter((f) => (f.sensitivityScore ?? 0) >= 70).length;

      const riskScore =
        total === 0 ? 0 : Math.round(((red * 100 + yellow * 60 + green * 20) / total) * 10) / 10;

      const lastScanAt =
        total === 0
          ? null
          : findings
              .map((f) => f.createdAt)
              .filter(Boolean)
              .sort((a, b) => +new Date(b) - +new Date(a))[0] ?? null;

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

    return NextResponse.json({
      ok: true,
      scope: { caseId: caseId ?? null, runId: runId ?? null, tenantId: user.tenantId },
      tiles,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
