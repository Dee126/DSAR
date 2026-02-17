/**
 * Resets demo evidence data for a tenant.
 * Removes synthetic artifacts while preserving the cases themselves.
 */
import { PrismaClient } from "@prisma/client";

export interface ResetResult {
  exportArtifactsDeleted: number;
  copilotSummariesDeleted: number;
  detectorResultsDeleted: number;
  findingsDeleted: number;
  evidenceItemsDeleted: number;
  copilotQueriesDeleted: number;
  copilotRunsDeleted: number;
  identityProfilesDeleted: number;
  dataCollectionItemsDeleted: number;
  documentsDeleted: number;
  tasksDeleted: number;
  legalReviewsDeleted: number;
  auditLogsDeleted: number;
}

export async function resetDemoEvidence(
  prisma: PrismaClient,
  tenantId: string,
  userId: string,
): Promise<ResetResult> {
  const result: ResetResult = {
    exportArtifactsDeleted: 0,
    copilotSummariesDeleted: 0,
    detectorResultsDeleted: 0,
    findingsDeleted: 0,
    evidenceItemsDeleted: 0,
    copilotQueriesDeleted: 0,
    copilotRunsDeleted: 0,
    identityProfilesDeleted: 0,
    dataCollectionItemsDeleted: 0,
    documentsDeleted: 0,
    tasksDeleted: 0,
    legalReviewsDeleted: 0,
    auditLogsDeleted: 0,
  };

  // Find all copilot runs tagged with demo metadata
  const demoRuns = await prisma.copilotRun.findMany({
    where: {
      tenantId,
      OR: [
        { metadata: { path: ["isDemoData"], equals: true } },
        { justification: { contains: "demo data" } },
      ],
    },
    select: { id: true },
  });

  const demoRunIds = demoRuns.map((r) => r.id);

  if (demoRunIds.length > 0) {
    // Delete in correct FK order
    const ea = await prisma.exportArtifact.deleteMany({
      where: { tenantId, runId: { in: demoRunIds } },
    });
    result.exportArtifactsDeleted = ea.count;

    const cs = await prisma.copilotSummary.deleteMany({
      where: { tenantId, runId: { in: demoRunIds } },
    });
    result.copilotSummariesDeleted = cs.count;

    const dr = await prisma.detectorResult.deleteMany({
      where: { tenantId, runId: { in: demoRunIds } },
    });
    result.detectorResultsDeleted = dr.count;

    const f = await prisma.finding.deleteMany({
      where: { tenantId, runId: { in: demoRunIds } },
    });
    result.findingsDeleted = f.count;

    const ei = await prisma.evidenceItem.deleteMany({
      where: { tenantId, runId: { in: demoRunIds } },
    });
    result.evidenceItemsDeleted = ei.count;

    const cq = await prisma.copilotQuery.deleteMany({
      where: { tenantId, runId: { in: demoRunIds } },
    });
    result.copilotQueriesDeleted = cq.count;

    const cr = await prisma.copilotRun.deleteMany({
      where: { tenantId, id: { in: demoRunIds } },
    });
    result.copilotRunsDeleted = cr.count;
  }

  // Delete demo documents (evidence index files tagged with demo-data via storageKey prefix)
  const dd = await prisma.document.deleteMany({
    where: {
      tenantId,
      storageKey: { startsWith: "demo/" },
    },
  });
  result.documentsDeleted = dd.count;

  // Delete demo data collection items (by querySpec.isDemoData)
  // Prisma JSON filtering: path + equals
  const dci = await prisma.dataCollectionItem.deleteMany({
    where: {
      tenantId,
      querySpec: { path: ["isDemoData"], equals: true },
    },
  });
  result.dataCollectionItemsDeleted = dci.count;

  // Delete demo audit logs
  const al = await prisma.auditLog.deleteMany({
    where: {
      tenantId,
      details: { path: ["isDemoData"], equals: true },
    },
  });
  result.auditLogsDeleted = al.count;

  // Log the reset itself
  await prisma.auditLog.create({
    data: {
      tenantId,
      actorUserId: userId,
      action: "DEMO_DATA_RESET",
      entityType: "Tenant",
      entityId: tenantId,
      details: {
        ...result,
        resetAt: new Date().toISOString(),
      },
    },
  });

  return result;
}
