/**
 * Tenant Guard — Enforces strict tenant isolation on all data access.
 *
 * Every database query that returns data MUST be tenant-scoped.
 * This module provides utilities to:
 * 1. Verify an entity belongs to a given tenant
 * 2. Assert tenant scope on query results
 * 3. Provide safe query helpers that always include tenantId
 *
 * Sprint 9.2: Security Hardening
 */

import { ApiError } from "../errors";

// ─── Tenant Assertion ────────────────────────────────────────────────────────

/**
 * Assert that an entity belongs to the expected tenant.
 * Throws 404 (not 403) if tenant mismatch to prevent information leakage.
 *
 * Usage:
 *   const doc = await prisma.document.findUnique({ where: { id } });
 *   assertTenantScoped(doc, user.tenantId, "Document");
 */
export function assertTenantScoped<T extends { tenantId: string }>(
  entity: T | null | undefined,
  expectedTenantId: string,
  entityName: string = "Resource",
): asserts entity is T {
  if (!entity) {
    throw new ApiError(404, `${entityName} not found`);
  }
  if (entity.tenantId !== expectedTenantId) {
    // Return 404, not 403, to prevent tenant enumeration
    throw new ApiError(404, `${entityName} not found`);
  }
}

/**
 * Build a WHERE clause that always includes tenantId.
 * Use this to prevent accidentally omitting tenant scope.
 *
 * Usage:
 *   const cases = await prisma.dSARCase.findMany({
 *     where: tenantWhere(user.tenantId, { status: "NEW" }),
 *   });
 */
export function tenantWhere<T extends Record<string, unknown>>(
  tenantId: string,
  additionalFilters: T = {} as T,
): T & { tenantId: string } {
  return { ...additionalFilters, tenantId };
}

/**
 * Build a WHERE clause for finding a specific entity by ID within a tenant.
 * Use instead of findUnique to ensure tenant isolation.
 *
 * Usage:
 *   const doc = await prisma.document.findFirst({
 *     where: tenantEntityWhere(user.tenantId, params.id),
 *   });
 */
export function tenantEntityWhere(
  tenantId: string,
  id: string,
  additionalFilters: Record<string, unknown> = {},
): { id: string; tenantId: string } & Record<string, unknown> {
  return { id, tenantId, ...additionalFilters };
}

/**
 * Get tenantId from a session user, asserting it exists.
 * Throws 401 if tenantId is missing (corrupted session).
 */
export function getTenantIdFromSession(user: {
  tenantId?: string;
}): string {
  if (!user.tenantId) {
    throw new ApiError(401, "Session missing tenant context");
  }
  return user.tenantId;
}

/**
 * Validate that a related entity belongs to the same tenant.
 * For cross-entity references (e.g., assigning a user to a case).
 *
 * Usage:
 *   await assertRelatedEntityTenant(
 *     prisma.user.findFirst({ where: { id: assigneeId, tenantId } }),
 *     "Assignee"
 *   );
 */
export async function assertRelatedEntityTenant<T>(
  query: Promise<T | null>,
  entityName: string = "Related entity",
): Promise<T> {
  const entity = await query;
  if (!entity) {
    throw new ApiError(400, `${entityName} not found in your organization`);
  }
  return entity;
}
