import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { processPendingDeliveries } from "@/lib/webhook-service";
import { logAudit, getClientInfo } from "@/lib/audit";
import { runJob, RetryPolicies } from "@/lib/job-runner";

/**
 * POST /api/jobs/webhooks/deliver — Process pending webhook deliveries (hardened)
 *
 * Uses JobRunner with concurrency guard, idempotency, and retry policy.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "WEBHOOKS_MANAGE");

    const jobResult = await runJob(
      {
        jobName: "webhook_delivery",
        tenantId: user.tenantId,
        retry: RetryPolicies.WEBHOOK,
      },
      () => processPendingDeliveries(user.tenantId),
    );

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "WEBHOOK_DELIVERY_JOB",
      entityType: "WebhookDelivery",
      entityId: jobResult.jobRunId,
      ip,
      userAgent,
      details: {
        status: jobResult.status,
        durationMs: jobResult.durationMs,
        attempt: jobResult.attempt,
        ...jobResult.data,
      },
    });

    return NextResponse.json({ data: jobResult });
  } catch (error) {
    return handleApiError(error);
  }
}
