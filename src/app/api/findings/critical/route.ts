import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/findings/critical
 *
 * Returns findings with riskScore >= 70 (red zone),
 * grouped by system and piiCategory (dataCategory).
 * Supports quick-action buttons on the client side.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "findings", "read");

    const findings = await prisma.finding.findMany({
      where: {
        tenantId: user.tenantId,
        riskScore: { gte: 70 },
      },
      include: {
        system: {
          select: { id: true, name: true, criticality: true },
        },
        run: {
          select: {
            id: true,
            case: {
              select: { id: true, caseNumber: true },
            },
          },
        },
        statusChangedBy: {
          select: { id: true, name: true },
        },
        mitigationTasks: {
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            assignee: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ riskScore: "desc" }, { createdAt: "desc" }],
    });

    // Group by system
    const bySystem: Record<
      string,
      {
        systemId: string;
        systemName: string;
        criticality: string | null;
        findings: typeof findings;
      }
    > = {};

    for (const f of findings) {
      const sysKey = f.systemId ?? "__unassigned";
      if (!bySystem[sysKey]) {
        bySystem[sysKey] = {
          systemId: f.systemId ?? "",
          systemName: f.system?.name ?? "Unassigned",
          criticality: f.system?.criticality ?? null,
          findings: [],
        };
      }
      bySystem[sysKey].findings.push(f);
    }

    // Group by dataCategory (piiCategory)
    const byCategory: Record<string, typeof findings> = {};
    for (const f of findings) {
      if (!byCategory[f.dataCategory]) {
        byCategory[f.dataCategory] = [];
      }
      byCategory[f.dataCategory].push(f);
    }

    // Summary stats
    const summary = {
      total: findings.length,
      open: findings.filter((f) => f.status === "OPEN").length,
      accepted: findings.filter((f) => f.status === "ACCEPTED").length,
      mitigating: findings.filter((f) => f.status === "MITIGATING").length,
      mitigated: findings.filter((f) => f.status === "MITIGATED").length,
      specialCategory: findings.filter((f) => f.containsSpecialCategory).length,
    };

    return NextResponse.json({
      findings,
      bySystem: Object.values(bySystem).sort(
        (a, b) => b.findings.length - a.findings.length
      ),
      byCategory: Object.entries(byCategory)
        .map(([category, items]) => ({ category, findings: items }))
        .sort((a, b) => b.findings.length - a.findings.length),
      summary,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
