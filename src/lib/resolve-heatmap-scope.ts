import { prisma } from "@/lib/prisma";

/**
 * Resolve caseId and runId for heatmap queries.
 *
 * - If provided and valid for the tenant → use as-is
 * - If missing or invalid → fallback to newest case / newest run (createdAt desc)
 * - No filtering on copilotRun.status (seeds may use any status value)
 */
export async function resolveHeatmapScope(
  tenantId: string,
  paramCaseId: string | null,
  paramRunId: string | null
): Promise<{ caseId: string | null; runId: string | null }> {
  let caseId = paramCaseId || null;
  let runId = paramRunId || null;

  // ── Validate / fallback caseId ───────────────────────────────────
  if (caseId) {
    const exists = await prisma.dSARCase.findFirst({
      where: { id: caseId, tenantId },
      select: { id: true },
    });
    if (!exists) {
      console.warn(
        `[heatmap] caseId="${caseId}" not found for tenant — falling back to newest`
      );
      caseId = null;
    }
  }
  if (!caseId) {
    const newest = await prisma.dSARCase.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    caseId = newest?.id ?? null;
  }

  // ── Validate / fallback runId (no status filter!) ────────────────
  if (runId) {
    const exists = await prisma.copilotRun.findFirst({
      where: { id: runId, tenantId },
      select: { id: true },
    });
    if (!exists) {
      console.warn(
        `[heatmap] runId="${runId}" not found — falling back to newest`
      );
      runId = null;
    }
  }
  if (!runId && caseId) {
    const newest = await prisma.copilotRun.findFirst({
      where: { tenantId, caseId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    runId = newest?.id ?? null;
  }

  return { caseId, runId };
}
