// ─── Module 8.4: Access Logging Service ─────────────────────────────────────
//
// Logs every access to sensitive artifacts (IDV, documents, delivery packages,
// vendor artifacts, exports, evidence). Also logs denied accesses.

import { prisma } from "./prisma";
import { appendAuditEvent, hashIp, hashUserAgent } from "./assurance-audit-service";
import { eventBus, EventTypes } from "./event-bus";
import type { AccessType, AccessOutcome, AccessResourceType } from "@prisma/client";

export interface AccessLogInput {
  tenantId: string;
  userId?: string;
  accessType: AccessType;
  resourceType: AccessResourceType;
  resourceId: string;
  caseId?: string;
  ip?: string;
  userAgent?: string;
  outcome: AccessOutcome;
  reason?: string;
}

/**
 * Log an access event (allowed or denied) and write to both
 * access_logs and the assurance audit log.
 */
export async function logAccess(input: AccessLogInput) {
  const ipHash = input.ip ? hashIp(input.ip) : null;
  const uaHash = input.userAgent ? hashUserAgent(input.userAgent) : null;

  const entry = await prisma.accessLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      accessType: input.accessType,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      caseId: input.caseId ?? null,
      ipHash,
      userAgentHash: uaHash,
      outcome: input.outcome,
      reason: input.reason ?? null,
    },
  });

  // Also write to assurance audit log
  await appendAuditEvent({
    tenantId: input.tenantId,
    entityType: input.resourceType,
    entityId: input.resourceId,
    action: "ACCESS",
    actorUserId: input.userId,
    actorType: input.userId ? "USER" : "PUBLIC",
    metadataJson: {
      ip_hash: ipHash ?? undefined,
      user_agent_hash: uaHash ?? undefined,
      access_type: input.accessType,
      outcome: input.outcome,
      reason: input.reason,
      case_id: input.caseId,
    },
  });

  // Emit event for observability / future SIEM
  const eventType = input.outcome === "ALLOWED"
    ? EventTypes.ACCESS_ALLOWED
    : EventTypes.ACCESS_DENIED;

  await eventBus.emit(eventType, input.tenantId, {
    accessLogId: entry.id,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    outcome: input.outcome,
    userId: input.userId,
  });

  return entry;
}

/**
 * Query access logs with filters.
 */
export async function queryAccessLogs(
  tenantId: string,
  filters: {
    resourceType?: AccessResourceType;
    caseId?: string;
    userId?: string;
    outcome?: AccessOutcome;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  } = {}
) {
  const where: Record<string, unknown> = { tenantId };
  if (filters.resourceType) where.resourceType = filters.resourceType;
  if (filters.caseId) where.caseId = filters.caseId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.outcome) where.outcome = filters.outcome;

  if (filters.dateFrom || filters.dateTo) {
    const timestampFilter: Record<string, Date> = {};
    if (filters.dateFrom) timestampFilter.gte = filters.dateFrom;
    if (filters.dateTo) timestampFilter.lte = filters.dateTo;
    where.timestamp = timestampFilter;
  }

  const [items, total] = await Promise.all([
    prisma.accessLog.findMany({
      where: where as any,
      orderBy: { timestamp: "desc" },
      take: filters.limit || 50,
      skip: filters.offset || 0,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.accessLog.count({ where: where as any }),
  ]);

  return { items, total };
}

/**
 * Get recent access events for a specific case (for the case detail mini panel).
 */
export async function getRecentCaseAccessLogs(tenantId: string, caseId: string, limit = 5) {
  return prisma.accessLog.findMany({
    where: { tenantId, caseId },
    orderBy: { timestamp: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
}
