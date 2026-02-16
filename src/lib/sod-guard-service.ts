// ─── Module 8.4: Separation of Duties (SoD) Guard ──────────────────────────
//
// Enforces 4-Augen-Prinzip (four-eyes principle) for critical actions.
// When SoD is enabled and a rule is violated, the action is blocked
// and an approval request is created.

import { prisma } from "./prisma";
import { appendAuditEvent } from "./assurance-audit-service";
import { eventBus, EventTypes } from "./event-bus";
import type { ApprovalScopeType } from "@prisma/client";

// ─── Rule Definitions ─────────────────────────────────────────────────────

export interface SodRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export const DEFAULT_SOD_RULES: SodRule[] = [
  {
    id: "generator_cannot_approve_response",
    name: "Response Generator ≠ Approver",
    description: "The user who generated/drafted a response cannot be the same user who approves it.",
    enabled: true,
  },
  {
    id: "idv_reviewer_cannot_finalize_delivery",
    name: "IDV Reviewer ≠ Delivery Finalizer",
    description: "The user who reviewed IDV cannot finalize the delivery package.",
    enabled: true,
  },
  {
    id: "same_user_cannot_request_and_approve_legal_exception",
    name: "Legal Exception Creator ≠ Approver",
    description: "The user who proposed a legal exception cannot approve it.",
    enabled: true,
  },
  {
    id: "retention_override_requester_cannot_approve",
    name: "Retention Override Requester ≠ Approver",
    description: "The user who requested a retention override cannot approve it.",
    enabled: true,
  },
];

// ─── SoD Policy Management ───────────────────────────────────────────────

export async function getSodPolicy(tenantId: string) {
  let policy = await prisma.sodPolicy.findUnique({
    where: { tenantId },
  });

  if (!policy) {
    // Create default policy
    policy = await prisma.sodPolicy.create({
      data: {
        tenantId,
        enabled: true,
        rulesJson: DEFAULT_SOD_RULES as unknown as object[],
      },
    });
  }

  return policy;
}

export async function updateSodPolicy(
  tenantId: string,
  data: { enabled?: boolean; rulesJson?: SodRule[]; exemptions?: Record<string, unknown> }
) {
  return prisma.sodPolicy.upsert({
    where: { tenantId },
    create: {
      tenantId,
      enabled: data.enabled ?? true,
      rulesJson: (data.rulesJson ?? DEFAULT_SOD_RULES) as object[],
      exemptions: data.exemptions ? (data.exemptions as object) : undefined,
    },
    update: {
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.rulesJson && { rulesJson: data.rulesJson as object[] }),
      ...(data.exemptions !== undefined && { exemptions: data.exemptions as object }),
    },
  });
}

// ─── SoD Check Results ────────────────────────────────────────────────────

export interface SodCheckResult {
  allowed: boolean;
  violatedRule?: string;
  violatedRuleDescription?: string;
  approvalRequired?: boolean;
  approvalId?: string;
}

// ─── SoD Guard Checks ────────────────────────────────────────────────────

/**
 * Check if a specific SoD rule is enabled for the tenant.
 */
async function isRuleEnabled(tenantId: string, ruleId: string): Promise<boolean> {
  const policy = await getSodPolicy(tenantId);
  if (!policy.enabled) return false;

  const rules = policy.rulesJson as unknown as SodRule[];
  const rule = rules.find(r => r.id === ruleId);
  return rule?.enabled ?? false;
}

/**
 * Check SoD for response approval: generator cannot approve.
 */
export async function checkResponseApprovalSoD(
  tenantId: string,
  responseDocId: string,
  approvingUserId: string
): Promise<SodCheckResult> {
  const ruleId = "generator_cannot_approve_response";
  if (!(await isRuleEnabled(tenantId, ruleId))) {
    return { allowed: true };
  }

  // Find who created/generated the response
  const responseDoc = await prisma.responseDocument.findFirst({
    where: { id: responseDocId, tenantId },
    select: { createdByUserId: true, editedByUserId: true },
  });

  if (!responseDoc) return { allowed: true };

  const creatorId = responseDoc.createdByUserId;
  const editorId = responseDoc.editedByUserId;

  if (approvingUserId === creatorId || approvingUserId === editorId) {
    return await handleSodViolation(tenantId, ruleId, approvingUserId, "RESPONSE", responseDocId);
  }

  return { allowed: true };
}

/**
 * Check SoD for legal exception approval: proposer cannot approve.
 */
export async function checkLegalExceptionSoD(
  tenantId: string,
  exceptionId: string,
  approvingUserId: string
): Promise<SodCheckResult> {
  const ruleId = "same_user_cannot_request_and_approve_legal_exception";
  if (!(await isRuleEnabled(tenantId, ruleId))) {
    return { allowed: true };
  }

  const exception = await prisma.legalException.findFirst({
    where: { id: exceptionId, tenantId },
    select: { proposedByUserId: true },
  });

  if (!exception) return { allowed: true };

  if (approvingUserId === exception.proposedByUserId) {
    return await handleSodViolation(tenantId, ruleId, approvingUserId, "LEGAL_EXCEPTION", exceptionId);
  }

  return { allowed: true };
}

/**
 * Generic SoD check: compare actor with creator of a resource.
 */
export async function checkGenericSoD(
  tenantId: string,
  ruleId: string,
  actorUserId: string,
  creatorUserId: string,
  scopeType: ApprovalScopeType,
  scopeId: string
): Promise<SodCheckResult> {
  if (!(await isRuleEnabled(tenantId, ruleId))) {
    return { allowed: true };
  }

  if (actorUserId === creatorUserId) {
    return await handleSodViolation(tenantId, ruleId, actorUserId, scopeType, scopeId);
  }

  return { allowed: true };
}

/**
 * Handle a SoD violation: create approval request and log.
 */
async function handleSodViolation(
  tenantId: string,
  ruleId: string,
  actorUserId: string,
  scopeType: ApprovalScopeType,
  scopeId: string
): Promise<SodCheckResult> {
  const policy = await getSodPolicy(tenantId);
  const rules = policy.rulesJson as unknown as SodRule[];
  const rule = rules.find(r => r.id === ruleId);

  // Create approval request
  const approval = await prisma.assuranceApproval.create({
    data: {
      tenantId,
      scopeType,
      scopeId,
      requestedBy: actorUserId,
      status: "PENDING",
      reason: `SoD violation: ${rule?.name || ruleId}. Another user must approve this action.`,
    },
  });

  // Audit log
  await appendAuditEvent({
    tenantId,
    entityType: "SodPolicy",
    entityId: ruleId,
    action: "SOD_VIOLATION",
    actorUserId,
    metadataJson: {
      rule_id: ruleId,
      scope_type: scopeType,
      scope_id: scopeId,
      approval_id: approval.id,
    },
  });

  // Emit event
  await eventBus.emit(EventTypes.SOD_VIOLATION_BLOCKED, tenantId, {
    ruleId,
    actorUserId,
    scopeType,
    scopeId,
    approvalId: approval.id,
  });

  return {
    allowed: false,
    violatedRule: ruleId,
    violatedRuleDescription: rule?.description,
    approvalRequired: true,
    approvalId: approval.id,
  };
}

// ─── Approval Workflow ────────────────────────────────────────────────────

export async function decideApproval(
  tenantId: string,
  approvalId: string,
  decidingUserId: string,
  decision: "APPROVED" | "REJECTED",
  reason?: string
) {
  const approval = await prisma.assuranceApproval.findFirst({
    where: { id: approvalId, tenantId, status: "PENDING" },
  });

  if (!approval) {
    throw new Error("Approval not found or already decided");
  }

  // The decider must NOT be the same as the requester (SoD for approvals too)
  if (approval.requestedBy === decidingUserId) {
    throw new Error("SoD violation: the requester cannot decide their own approval");
  }

  const updated = await prisma.assuranceApproval.update({
    where: { id: approvalId },
    data: {
      approvedBy: decidingUserId,
      approvedAt: new Date(),
      status: decision,
      reason: reason ?? undefined,
    },
  });

  await appendAuditEvent({
    tenantId,
    entityType: "AssuranceApproval",
    entityId: approvalId,
    action: decision === "APPROVED" ? "APPROVE" : "REVOKE",
    actorUserId: decidingUserId,
    metadataJson: {
      scope_type: approval.scopeType,
      scope_id: approval.scopeId,
      decision,
    },
  });

  await eventBus.emit(EventTypes.SOD_APPROVAL_DECIDED, tenantId, {
    approvalId,
    decision,
    decidingUserId,
    scopeType: approval.scopeType,
    scopeId: approval.scopeId,
  });

  return updated;
}

/**
 * List pending approvals for a tenant.
 */
export async function listApprovals(
  tenantId: string,
  filters: {
    status?: string;
    scopeType?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const where: Record<string, unknown> = { tenantId };
  if (filters.status) where.status = filters.status;
  if (filters.scopeType) where.scopeType = filters.scopeType;

  const [items, total] = await Promise.all([
    prisma.assuranceApproval.findMany({
      where: where as any,
      orderBy: { requestedAt: "desc" },
      take: filters.limit || 50,
      skip: filters.offset || 0,
      include: {
        requester: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.assuranceApproval.count({ where: where as any }),
  ]);

  return { items, total };
}
