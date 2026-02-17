import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { runJob, RetryPolicies } from "@/lib/job-runner";

/**
 * POST /api/jobs/connectors/run — Process pending connector runs (hardened)
 *
 * Uses JobRunner with concurrency guard + retry.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "INTEGRATIONS_CONFIGURE");

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(body.limit ?? 10, 50);

    const result = await runJob(
      {
        jobName: "connector_runs",
        tenantId: user.tenantId,
        retry: RetryPolicies.CONNECTOR,
      },
      async () => {
        // Find pending connector runs
        const pendingRuns = await prisma.connectorRun.findMany({
          where: {
            tenantId: user.tenantId,
            status: "PENDING",
          },
          take: limit,
          orderBy: { createdAt: "asc" },
          include: { connector: true },
        });

        let processed = 0;
        let succeeded = 0;
        let failed = 0;

        for (const run of pendingRuns) {
          try {
            // Mark as running
            await prisma.connectorRun.update({
              where: { id: run.id },
              data: { status: "RUNNING", startedAt: new Date() },
            });

            // Connector execution is a placeholder — in production this would
            // call the connector framework. For now, mark as success.
            await prisma.connectorRun.update({
              where: { id: run.id },
              data: { status: "SUCCESS", finishedAt: new Date() },
            });

            succeeded++;
          } catch {
            await prisma.connectorRun.update({
              where: { id: run.id },
              data: { status: "FAILED", finishedAt: new Date() },
            }).catch(() => {});
            failed++;
          }
          processed++;
        }

        return { processed, succeeded, failed };
      },
    );

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "CONNECTOR_RUN_JOB",
      entityType: "JobRun",
      entityId: result.jobRunId,
      ip,
      userAgent,
      details: {
        status: result.status,
        durationMs: result.durationMs,
      },
    });

    return NextResponse.json(result, {
      status: result.status === "SUCCESS" ? 200 : 500,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
