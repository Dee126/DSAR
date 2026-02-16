// ─── Module 8.4: Access Log Middleware ───────────────────────────────────────
//
// Provides a wrapper function for download/access routes that:
// 1. Checks RBAC permission
// 2. Logs the access (ALLOWED or DENIED)
// 3. Returns the access decision

import { logAccess } from "./access-log-service";
import { has } from "./rbac";
import type { AccessType, AccessResourceType } from "@prisma/client";

export interface AccessCheckInput {
  tenantId: string;
  userId?: string;
  role: string;
  permission: string;
  accessType: AccessType;
  resourceType: AccessResourceType;
  resourceId: string;
  caseId?: string;
  ip?: string;
  userAgent?: string;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check and log access to a sensitive resource.
 * Logs both allowed and denied accesses.
 */
export async function checkAndLogAccess(input: AccessCheckInput): Promise<AccessCheckResult> {
  const allowed = has(input.role, input.permission as any);

  await logAccess({
    tenantId: input.tenantId,
    userId: input.userId,
    accessType: input.accessType,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    caseId: input.caseId,
    ip: input.ip,
    userAgent: input.userAgent,
    outcome: allowed ? "ALLOWED" : "DENIED",
    reason: allowed ? undefined : "RBAC_DENY",
  });

  return {
    allowed,
    reason: allowed ? undefined : "RBAC_DENY",
  };
}

/**
 * Log a successful access (for cases where RBAC was already checked separately).
 */
export async function logAllowedAccess(input: {
  tenantId: string;
  userId?: string;
  accessType: AccessType;
  resourceType: AccessResourceType;
  resourceId: string;
  caseId?: string;
  ip?: string;
  userAgent?: string;
}) {
  await logAccess({
    ...input,
    outcome: "ALLOWED",
  });
}

/**
 * Log a denied access.
 */
export async function logDeniedAccess(input: {
  tenantId: string;
  userId?: string;
  accessType: AccessType;
  resourceType: AccessResourceType;
  resourceId: string;
  caseId?: string;
  ip?: string;
  userAgent?: string;
  reason: string;
}) {
  await logAccess({
    ...input,
    outcome: "DENIED",
  });
}
