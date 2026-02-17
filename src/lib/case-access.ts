/**
 * Case Access Model — Need-to-know enforcement for DSAR cases.
 *
 * Determines whether a user can access a specific case based on:
 *   1. Role-based global access (TENANT_ADMIN, DPO → all cases)
 *   2. Assignment (assignedToUserId = userId)
 *   3. Team membership (userId in caseTeamMembers)
 *   4. AUDITOR: read-only access to all cases (configurable)
 *
 * Every case-related action (Copilot, Docs, Exports) must first call
 * canAccessCase(). Frontend hides UI but backend always checks.
 */

import { hasGlobalCaseAccess, isReadOnly, has } from "./rbac";
import type { Permission } from "./rbac";
import { ApiError } from "./errors";

// ─── In-Memory Case Team Store ─────────────────────────────────────────────
// In production this would be backed by the CaseTeamMember Prisma model.

interface CaseTeamEntry {
  tenantId: string;
  caseId: string;
  userId: string;
  addedAt: string;
}

const caseTeamStore: CaseTeamEntry[] = [];

export function addTeamMember(tenantId: string, caseId: string, userId: string): void {
  const exists = caseTeamStore.some(
    (e) => e.tenantId === tenantId && e.caseId === caseId && e.userId === userId,
  );
  if (!exists) {
    caseTeamStore.push({ tenantId, caseId, userId, addedAt: new Date().toISOString() });
  }
}

export function removeTeamMember(tenantId: string, caseId: string, userId: string): void {
  const idx = caseTeamStore.findIndex(
    (e) => e.tenantId === tenantId && e.caseId === caseId && e.userId === userId,
  );
  if (idx >= 0) caseTeamStore.splice(idx, 1);
}

export function getTeamMembers(tenantId: string, caseId: string): CaseTeamEntry[] {
  return caseTeamStore.filter((e) => e.tenantId === tenantId && e.caseId === caseId);
}

export function isTeamMember(tenantId: string, caseId: string, userId: string): boolean {
  return caseTeamStore.some(
    (e) => e.tenantId === tenantId && e.caseId === caseId && e.userId === userId,
  );
}

export function getCasesForUser(tenantId: string, userId: string): string[] {
  return caseTeamStore
    .filter((e) => e.tenantId === tenantId && e.userId === userId)
    .map((e) => e.caseId);
}

/** Reset store (for testing only) */
export function resetCaseTeamStore(): void {
  caseTeamStore.length = 0;
}

// ─── Case Access Checking ──────────────────────────────────────────────────

export type CaseAction = "read" | "write" | "copilot" | "export" | "documents";

interface CaseAccessContext {
  userId: string;
  userRole: string;
  tenantId: string;
  caseId: string;
  /** The userId currently assigned to the case (from DSARCase.assignedToUserId) */
  assignedToUserId?: string | null;
}

/**
 * Check whether a user can access a specific case for a given action.
 *
 * Rules:
 * - SUPER_ADMIN, TENANT_ADMIN, DPO: global access to all cases in tenant
 * - AUDITOR: read-only access to all cases (configurable)
 * - CASE_MANAGER, ANALYST, CONTRIBUTOR:
 *     - must be assignedTo OR in caseTeamMembers
 * - READ_ONLY: read access only if assigned/team member
 */
export function canAccessCase(ctx: CaseAccessContext, action: CaseAction = "read"): boolean {
  // Global access roles: can access everything
  if (hasGlobalCaseAccess(ctx.userRole)) return true;

  // AUDITOR: read-only access to all cases in tenant
  if (ctx.userRole === "AUDITOR") {
    return action === "read";
  }

  // Scoped roles: must be assigned or team member
  const isAssigned = ctx.assignedToUserId === ctx.userId;
  const isMember = isTeamMember(ctx.tenantId, ctx.caseId, ctx.userId);

  if (!isAssigned && !isMember) return false;

  // For read-only roles, only allow reads even if assigned
  if (isReadOnly(ctx.userRole)) {
    return action === "read";
  }

  return true;
}

/**
 * Enforce case access, throwing ApiError(403) if denied.
 */
export function enforceCaseAccess(ctx: CaseAccessContext, action: CaseAction = "read"): void {
  if (!canAccessCase(ctx, action)) {
    throw new ApiError(403, `Access denied: you do not have ${action} access to this case.`);
  }
}

/**
 * Combined check: user has the required permission AND has access to the case.
 * This is the primary gate for all case-scoped operations.
 */
export function enforceCasePermission(
  ctx: CaseAccessContext,
  permission: Permission,
  action: CaseAction = "read",
): void {
  // First check role-level permission
  if (!has(ctx.userRole, permission)) {
    throw new ApiError(403, `Forbidden: missing permission ${permission}`);
  }
  // Then check case-level access
  enforceCaseAccess(ctx, action);
}
