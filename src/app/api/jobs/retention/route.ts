import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { runRetentionDeletionJob } from "@/lib/retention-service";
import { runJob, RetryPolicies } from "@/lib/job-runner";

/**
 * POST /api/jobs/retention — Run retention deletion job (hardened)
 *
 * Uses JobRunner with concurrency guard, idempotency, and retry policy.
 * The retention service itself already creates JobRun + DeletionJob records.
 */
export async function POST() {
  try {
    const user = await requireAuth();
    enforce(user.role, "ASSURANCE_RETENTION_RUN");

    const today = new Date().toISOString().split("T")[0];

    const jobResult = await runJob(
      {
        jobName: "retention_deletion",
        tenantId: user.tenantId,
        idempotencyKey: `retention_${today}`,
        retry: RetryPolicies.RETENTION,
      },
      () => runRetentionDeletionJob(user.tenantId, "USER", user.id),
    );

    return NextResponse.json({
      job: jobResult,
      data: jobResult.data,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
