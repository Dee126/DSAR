import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { hasPermission, checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const DEMO_TAG = "[DEMO]";

/**
 * GET /api/demo/reset-heatmap
 * Returns a hint directing callers to POST.
 */
export async function GET() {
  return NextResponse.json({ ok: true, method: "GET", hint: "POST to reset" });
}

/**
 * POST /api/demo/reset-heatmap
 * Deletes all [DEMO]-tagged heatmap data for the effective tenant.
 * Dev-only convenience endpoint.
 */
export async function POST() {
  try {
    const user = await requireAuth();

    // Prefer data_inventory "manage"; fall back to "read"
    if (!hasPermission(user.role, "data_inventory", "manage")) {
      checkPermission(user.role, "data_inventory", "read");
    }

    // Always use the authenticated user's tenant
    const tenantId = user.tenantId;

    console.log("[reset-heatmap] POST started", { tenantId });

    // ── 1. Find demo systems ──────────────────────────────────────────────
    const demoSystems = await prisma.system.findMany({
      where: { tenantId, description: { contains: DEMO_TAG } },
      select: { id: true },
    });
    const demoSystemIds = demoSystems.map((s: { id: string }) => s.id);

    // ── 2. Delete findings for demo systems ───────────────────────────────
    let removedFindings = 0;
    if (demoSystemIds.length > 0) {
      const result = await prisma.finding.deleteMany({
        where: { tenantId, systemId: { in: demoSystemIds } },
      });
      removedFindings = result.count;
      console.log("[reset-heatmap] Deleted", removedFindings, "findings");
    }

    // ── 3. Delete demo copilot run, case, and data subject ────────────────
    let removedRuns = 0;
    let removedCases = 0;
    let removedSubjects = 0;

    const demoRuns = await prisma.copilotRun.findMany({
      where: { tenantId, justification: { contains: DEMO_TAG } },
      select: { id: true, caseId: true },
    });

    for (const run of demoRuns) {
      await prisma.copilotRun.delete({ where: { id: run.id } });
      removedRuns++;

      const demoCase = await prisma.dSARCase.findFirst({
        where: {
          id: run.caseId,
          tenantId,
          description: { contains: DEMO_TAG },
        },
        select: { id: true, dataSubjectId: true },
      });

      if (demoCase) {
        await prisma.dSARCase.delete({ where: { id: demoCase.id } });
        removedCases++;

        // Delete data subject if it matches demo pattern
        const subject = await prisma.dataSubject.findUnique({
          where: { id: demoCase.dataSubjectId },
          select: { id: true, fullName: true, email: true },
        });
        if (
          subject &&
          (subject.fullName?.includes("Demo Heatmap") ||
            subject.email?.includes("demo-heatmap"))
        ) {
          await prisma.dataSubject
            .delete({ where: { id: subject.id } })
            .catch((e: unknown) => {
              console.warn("[reset-heatmap] DataSubject delete failed (non-fatal):", e);
            });
          removedSubjects++;
        }
      }
    }

    // ── 4. Delete demo systems ────────────────────────────────────────────
    let removedSystems = 0;
    if (demoSystemIds.length > 0) {
      const result = await prisma.system.deleteMany({
        where: { id: { in: demoSystemIds } },
      });
      removedSystems = result.count;
      console.log("[reset-heatmap] Deleted", removedSystems, "demo systems");
    }

    console.log("[reset-heatmap] SUCCESS", {
      removedSystems,
      removedFindings,
      removedRuns,
      removedCases,
      removedSubjects,
    });

    return NextResponse.json({
      ok: true,
      removedSystems,
      removedFindings,
      removedRuns,
      removedCases,
      removedSubjects,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
