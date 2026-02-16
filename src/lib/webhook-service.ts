import { createHmac, randomUUID } from "crypto";
import { prisma } from "./prisma";
import { logAudit } from "./audit";

export interface WebhookEvent {
  id: string;
  type: string;
  created_at: string;
  resource_type: string;
  resource_id: string;
  data: Record<string, unknown>;
}

// Maximum consecutive failures before auto-disabling an endpoint
const MAX_FAILURE_COUNT = 10;

// Retry schedule in minutes
const RETRY_SCHEDULE_MINUTES = [1, 5, 30, 120];

/**
 * Generate HMAC-SHA256 signature for webhook payload.
 */
export function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Emit a webhook event. Creates delivery records for all matching endpoints.
 */
export async function emitWebhookEvent(
  tenantId: string,
  eventType: string,
  resourceType: string,
  resourceId: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        tenantId,
        enabled: true,
        subscribedEvents: { has: eventType },
      },
    });

    if (endpoints.length === 0) return;

    const event: WebhookEvent = {
      id: randomUUID(),
      type: eventType,
      created_at: new Date().toISOString(),
      resource_type: resourceType,
      resource_id: resourceId,
      data,
    };

    const deliveries = endpoints.map((ep) => ({
      id: randomUUID(),
      tenantId,
      endpointId: ep.id,
      eventType,
      payloadJson: event as any,
      status: "PENDING" as const,
      attempts: 0,
      nextRetryAt: new Date(),
    }));

    await prisma.webhookDelivery.createMany({ data: deliveries });
  } catch (err) {
    console.error("Failed to emit webhook event:", err);
  }
}

/**
 * Process pending webhook deliveries. Called by the deliver job endpoint.
 * Processes up to `limit` deliveries.
 */
export async function processPendingDeliveries(
  tenantId: string,
  limit = 50
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const deliveries = await prisma.webhookDelivery.findMany({
    where: {
      tenantId,
      status: "PENDING",
      nextRetryAt: { lte: new Date() },
    },
    include: { endpoint: true },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  let succeeded = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const payloadStr = JSON.stringify(delivery.payloadJson);
    const signature = signPayload(delivery.endpoint.secret, payloadStr);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(delivery.endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PrivacyPilot-Signature": `sha256=${signature}`,
          "X-PrivacyPilot-Event": delivery.eventType,
          "X-PrivacyPilot-Delivery": delivery.id,
        },
        body: payloadStr,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseSnippet = await response.text().then((t) => t.substring(0, 500)).catch(() => "");

      if (response.ok) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "SUCCESS",
            deliveredAt: new Date(),
            responseCode: response.status,
            responseBodySnippet: responseSnippet,
            attempts: delivery.attempts + 1,
            nextRetryAt: null,
          },
        });
        await prisma.webhookEndpoint.update({
          where: { id: delivery.endpointId },
          data: {
            lastSuccessAt: new Date(),
            failureCount: 0,
          },
        });
        succeeded++;
      } else {
        await handleDeliveryFailure(delivery, response.status, responseSnippet);
        failed++;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      await handleDeliveryFailure(delivery, null, errorMsg);
      failed++;
    }
  }

  return { processed: deliveries.length, succeeded, failed };
}

async function handleDeliveryFailure(
  delivery: any,
  responseCode: number | null,
  responseSnippet: string
): Promise<void> {
  const newAttempts = delivery.attempts + 1;
  const retryIndex = Math.min(newAttempts - 1, RETRY_SCHEDULE_MINUTES.length - 1);
  const hasMoreRetries = newAttempts <= RETRY_SCHEDULE_MINUTES.length;

  const nextRetry = hasMoreRetries
    ? new Date(Date.now() + RETRY_SCHEDULE_MINUTES[retryIndex] * 60_000)
    : null;

  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: hasMoreRetries ? "PENDING" : "FAILED",
      responseCode,
      responseBodySnippet: responseSnippet?.substring(0, 500),
      attempts: newAttempts,
      nextRetryAt: nextRetry,
    },
  });

  // Increment failure count on endpoint
  const endpoint = await prisma.webhookEndpoint.update({
    where: { id: delivery.endpointId },
    data: {
      failureCount: { increment: 1 },
      lastFailureAt: new Date(),
    },
  });

  // Auto-disable endpoint after too many failures
  if (endpoint.failureCount >= MAX_FAILURE_COUNT) {
    await prisma.webhookEndpoint.update({
      where: { id: delivery.endpointId },
      data: { enabled: false },
    });

    await logAudit({
      tenantId: delivery.tenantId,
      action: "WEBHOOK_ENDPOINT_AUTO_DISABLED",
      entityType: "WebhookEndpoint",
      entityId: delivery.endpointId,
      details: {
        failureCount: endpoint.failureCount,
        reason: "Exceeded maximum failure count",
      },
    });
  }
}

/**
 * Calculate the next retry time based on attempt number.
 */
export function getNextRetryTime(attempts: number): Date | null {
  if (attempts >= RETRY_SCHEDULE_MINUTES.length) return null;
  return new Date(Date.now() + RETRY_SCHEDULE_MINUTES[attempts] * 60_000);
}
