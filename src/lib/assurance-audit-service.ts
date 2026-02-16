// ─── Module 8.4: Hash-Chained Immutable Audit Service ───────────────────────
//
// Implements append-only audit logging with SHA-256 hash chain per tenant.
// Events are NEVER updated — corrections use AMEND events with references.

import { createHash } from "crypto";
import { prisma } from "./prisma";
import { eventBus, EventTypes } from "./event-bus";
import type { ActorType } from "@prisma/client";

export interface AuditEventInput {
  tenantId: string;
  entityType: string;
  entityId?: string;
  action: string;
  actorUserId?: string;
  actorType?: ActorType;
  diffJson?: Record<string, unknown>;
  metadataJson?: {
    ip_hash?: string;
    user_agent_hash?: string;
    correlation_id?: string;
    [key: string]: unknown;
  };
}

/**
 * Create a stable canonical JSON representation for hashing.
 * Keys are sorted recursively, no random fields.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "string") return JSON.stringify(obj);
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJson).join(",") + "]";
  }
  if (typeof obj === "object") {
    const sorted = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = sorted.map(
      (k) => JSON.stringify(k) + ":" + canonicalJson((obj as Record<string, unknown>)[k])
    );
    return "{" + pairs.join(",") + "}";
  }
  return String(obj);
}

/**
 * Compute SHA-256 hash of a string.
 */
export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Hash an IP address for privacy-safe storage.
 */
export function hashIp(ip: string, salt?: string): string {
  return sha256((salt || "assurance") + ":" + ip);
}

/**
 * Hash a user agent for privacy-safe storage.
 */
export function hashUserAgent(ua: string, salt?: string): string {
  return sha256((salt || "assurance") + ":" + ua);
}

/**
 * Get the last hash in the audit chain for a tenant.
 */
async function getLastHash(tenantId: string): Promise<string | null> {
  const last = await prisma.assuranceAuditLog.findFirst({
    where: { tenantId },
    orderBy: { timestamp: "desc" },
    select: { hash: true },
  });
  return last?.hash ?? null;
}

/**
 * Append a new audit event to the immutable hash chain.
 * Returns the created audit log entry.
 */
export async function appendAuditEvent(input: AuditEventInput) {
  const prevHash = await getLastHash(input.tenantId);
  const timestamp = new Date();

  // Build the event payload for hashing
  const eventPayload = {
    tenantId: input.tenantId,
    entityType: input.entityType,
    entityId: input.entityId || null,
    action: input.action,
    actorUserId: input.actorUserId || null,
    actorType: input.actorType || "USER",
    timestamp: timestamp.toISOString(),
    diffJson: input.diffJson || null,
    metadataJson: input.metadataJson || null,
  };

  const canonical = canonicalJson(eventPayload);
  const hashInput = (prevHash || "") + canonical;
  const hash = sha256(hashInput);

  const entry = await prisma.assuranceAuditLog.create({
    data: {
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType ?? "USER",
      timestamp,
      diffJson: input.diffJson ? (input.diffJson as object) : undefined,
      metadataJson: input.metadataJson ? (input.metadataJson as object) : undefined,
      prevHash,
      hash,
      signatureVersion: "v1",
    },
  });

  // Emit event for SIEM/observability
  await eventBus.emit(EventTypes.AUDIT_LOG_CREATED, input.tenantId, {
    auditLogId: entry.id,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
  });

  return entry;
}

/**
 * Verify the integrity of the entire audit chain for a tenant.
 * Returns verification result with details.
 */
export async function verifyAuditChainIntegrity(tenantId: string): Promise<{
  valid: boolean;
  totalEntries: number;
  checkedEntries: number;
  firstInvalidIndex?: number;
  firstInvalidId?: string;
  error?: string;
}> {
  const entries = await prisma.assuranceAuditLog.findMany({
    where: { tenantId },
    orderBy: { timestamp: "asc" },
    select: {
      id: true,
      tenantId: true,
      entityType: true,
      entityId: true,
      action: true,
      actorUserId: true,
      actorType: true,
      timestamp: true,
      diffJson: true,
      metadataJson: true,
      prevHash: true,
      hash: true,
    },
  });

  if (entries.length === 0) {
    return { valid: true, totalEntries: 0, checkedEntries: 0 };
  }

  let previousHash: string | null = null;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Verify prevHash chain link
    if (entry.prevHash !== previousHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        checkedEntries: i + 1,
        firstInvalidIndex: i,
        firstInvalidId: entry.id,
        error: `Chain break at index ${i}: expected prevHash=${previousHash}, got ${entry.prevHash}`,
      };
    }

    // Reconstruct hash
    const eventPayload = {
      tenantId: entry.tenantId,
      entityType: entry.entityType,
      entityId: entry.entityId || null,
      action: entry.action,
      actorUserId: entry.actorUserId || null,
      actorType: entry.actorType,
      timestamp: entry.timestamp.toISOString(),
      diffJson: entry.diffJson || null,
      metadataJson: entry.metadataJson || null,
    };

    const canonical = canonicalJson(eventPayload);
    const hashInput = (previousHash || "") + canonical;
    const expectedHash = sha256(hashInput);

    if (entry.hash !== expectedHash) {
      await eventBus.emit(EventTypes.AUDIT_INTEGRITY_VIOLATION, tenantId, {
        entryId: entry.id,
        index: i,
        expectedHash,
        actualHash: entry.hash,
      });

      return {
        valid: false,
        totalEntries: entries.length,
        checkedEntries: i + 1,
        firstInvalidIndex: i,
        firstInvalidId: entry.id,
        error: `Hash mismatch at index ${i}: expected=${expectedHash}, got=${entry.hash}`,
      };
    }

    previousHash = entry.hash;
  }

  return {
    valid: true,
    totalEntries: entries.length,
    checkedEntries: entries.length,
  };
}

/**
 * Query audit logs with filters.
 */
export async function queryAuditLogs(
  tenantId: string,
  filters: {
    entityType?: string;
    action?: string;
    actorUserId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  } = {}
) {
  const where: Record<string, unknown> = { tenantId };
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.action) where.action = filters.action;
  if (filters.actorUserId) where.actorUserId = filters.actorUserId;

  if (filters.dateFrom || filters.dateTo) {
    const timestampFilter: Record<string, Date> = {};
    if (filters.dateFrom) timestampFilter.gte = filters.dateFrom;
    if (filters.dateTo) timestampFilter.lte = filters.dateTo;
    where.timestamp = timestampFilter;
  }

  const [items, total] = await Promise.all([
    prisma.assuranceAuditLog.findMany({
      where: where as any,
      orderBy: { timestamp: "desc" },
      take: filters.limit || 50,
      skip: filters.offset || 0,
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.assuranceAuditLog.count({ where: where as any }),
  ]);

  return { items, total };
}
