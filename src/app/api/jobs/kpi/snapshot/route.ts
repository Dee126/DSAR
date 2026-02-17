import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { storeKpiSnapshot } from "@/lib/kpi-service";
import { runJob, RetryPolicies } from "@/lib/job-runner";

/**
 * POST /api/jobs/kpi/snapshot — Run KPI snapshot job (hardened)
 *
 * Uses JobRunner with concurrency guard + idempotency + retry.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EXEC_KPI_CONFIG");

    const today = new Date().toISOString().split("T")[0];

    const result = await runJob(
      {
        jobName: "kpi_snapshot",
        tenantId: user.tenantId,
        idempotencyKey: `kpi_snapshot_${today}`,
        retry: RetryPolicies.KPI_SNAPSHOT,
      },
      async () => {
        const snapshot = await storeKpiSnapshot(user.tenantId, "MONTHLY");
        return { snapshotId: snapshot.id };
      },
    );

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "KPI_SNAPSHOT_JOB_RUN",
      entityType: "JobRun",
      entityId: result.jobRunId,
      ip,
      userAgent,
      details: {
        status: result.status,
        durationMs: result.durationMs,
        attempt: result.attempt,
      },
    });

    return NextResponse.json(result, {
      status: result.status === "SUCCESS" ? 200 : 500,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
