import { createHash } from "crypto";
import { prisma } from "./prisma";
import { logAudit } from "./audit";
import type { DeliveryEventType } from "@prisma/client";

/**
 * Privacy-safe hashing: hash IP and user-agent with tenant-specific salt
 * to avoid storing PII in delivery event logs.
 */
export function hashPrivacySafe(value: string, tenantSalt: string): string {
  return createHash("sha256").update(value + tenantSalt).digest("hex");
}

interface RecordEventInput {
  tenantId: string;
  caseId: string;
  deliveryLinkId?: string;
  eventType: DeliveryEventType;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  actorUserId?: string; // internal actor for audit log
}

/**
 * Records a delivery event with privacy-safe IP/UserAgent hashing,
 * and creates a corresponding audit log entry.
 */
export async function recordDeliveryEvent(input: RecordEventInput) {
  // Use tenantId as salt basis for hashing
  const tenantSalt = input.tenantId;
  const ipHash = input.ip ? hashPrivacySafe(input.ip, tenantSalt) : null;
  const userAgentHash = input.userAgent
    ? hashPrivacySafe(input.userAgent, tenantSalt)
    : null;

  const event = await prisma.deliveryEvent.create({
    data: {
      tenantId: input.tenantId,
      caseId: input.caseId,
      deliveryLinkId: input.deliveryLinkId ?? null,
      eventType: input.eventType,
      ipHash,
      userAgentHash,
      metadataJson: input.metadata ? (input.metadata as any) : undefined,
    },
  });

  // Also write to general audit log
  await logAudit({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId ?? null,
    action: `delivery.${input.eventType.toLowerCase()}`,
    entityType: "DeliveryLink",
    entityId: input.deliveryLinkId ?? input.caseId,
    ip: input.ip ? ipHash : null, // store hash, not raw
    userAgent: input.userAgent ? userAgentHash : null,
    details: {
      caseId: input.caseId,
      eventType: input.eventType,
      ...(input.metadata ?? {}),
    },
  });

  return event;
}

/**
 * Retrieve delivery events for a case, ordered by most recent first.
 */
export async function getDeliveryEvents(
  tenantId: string,
  caseId: string,
  linkId?: string
) {
  return prisma.deliveryEvent.findMany({
    where: {
      tenantId,
      caseId,
      ...(linkId ? { deliveryLinkId: linkId } : {}),
    },
    orderBy: { timestamp: "desc" },
    take: 200,
  });
}
