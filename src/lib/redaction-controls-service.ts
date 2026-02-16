/**
 * Redaction Controls Service — Module 8.3
 *
 * Manages enhanced redaction entries on response documents,
 * redaction review state per case, and workflow gating checks.
 */

import { prisma } from "./prisma";
import { logAudit, getClientInfo } from "./audit";
import type { NextRequest } from "next/server";

// ─── Redaction Entries (Enhanced) ────────────────────────────────────────────

export async function createRedactionEntry(
  tenantId: string,
  caseId: string,
  userId: string,
  data: {
    responseDocId: string;
    sectionKey?: string;
    documentRef?: string;
    redactedContent?: string;
    reason: string;
    redactionType?: string;
    pageNumber?: number;
    legalBasisReference?: string;
  },
  request?: NextRequest,
) {
  const entry = await prisma.redactionEntry.create({
    data: {
      tenantId,
      caseId,
      responseDocId: data.responseDocId,
      sectionKey: data.sectionKey,
      documentRef: data.documentRef,
      redactedContent: data.redactedContent,
      reason: data.reason,
      redactionType: data.redactionType as any,
      pageNumber: data.pageNumber,
      legalBasisReference: data.legalBasisReference,
      createdByUserId: userId,
    },
  });

  // Update review state counters
  await syncRedactionReviewState(tenantId, caseId);

  const clientInfo = request ? getClientInfo(request) : {};
  await logAudit({
    tenantId,
    actorUserId: userId,
    action: "REDACTION_ENTRY_CREATED",
    entityType: "RedactionEntry",
    entityId: entry.id,
    ...clientInfo,
    details: { caseId, responseDocId: data.responseDocId, redactionType: data.redactionType },
  });

  return entry;
}

export async function approveRedactionEntry(
  tenantId: string,
  entryId: string,
  userId: string,
  approved: boolean,
  request?: NextRequest,
) {
  const entry = await prisma.redactionEntry.update({
    where: { id: entryId },
    data: {
      approved,
      approvedByUserId: userId,
      approvedAt: new Date(),
    },
  });

  await syncRedactionReviewState(tenantId, entry.caseId);

  const clientInfo = request ? getClientInfo(request) : {};
  await logAudit({
    tenantId,
    actorUserId: userId,
    action: approved ? "REDACTION_ENTRY_APPROVED" : "REDACTION_ENTRY_REJECTED",
    entityType: "RedactionEntry",
    entityId: entry.id,
    ...clientInfo,
    details: { caseId: entry.caseId, approved },
  });

  return entry;
}

export async function getRedactionEntries(tenantId: string, caseId: string) {
  return prisma.redactionEntry.findMany({
    where: { tenantId, caseId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Redaction Review State ─────────────────────────────────────────────────

export async function getRedactionReviewState(tenantId: string, caseId: string) {
  return prisma.caseRedactionReview.findUnique({
    where: { caseId },
    include: {
      completedBy: { select: { id: true, name: true } },
    },
  });
}

export async function updateRedactionReviewState(
  tenantId: string,
  caseId: string,
  userId: string,
  state: string,
  notes?: string,
  request?: NextRequest,
) {
  const review = await prisma.caseRedactionReview.upsert({
    where: { caseId },
    update: {
      state: state as any,
      notes,
      ...(state === "COMPLETED" ? { completedByUserId: userId, completedAt: new Date() } : {}),
    },
    create: {
      tenantId,
      caseId,
      state: state as any,
      notes,
      ...(state === "COMPLETED" ? { completedByUserId: userId, completedAt: new Date() } : {}),
    },
  });

  const clientInfo = request ? getClientInfo(request) : {};
  await logAudit({
    tenantId,
    actorUserId: userId,
    action: "REDACTION_REVIEW_STATE_UPDATED",
    entityType: "CaseRedactionReview",
    entityId: review.id,
    ...clientInfo,
    details: { caseId, state, notes },
  });

  return review;
}

/**
 * Sync the review state counters from actual data.
 */
export async function syncRedactionReviewState(tenantId: string, caseId: string) {
  const [totalRedactions, approvedRedactions, pendingSensitive, pendingExceptions] = await Promise.all([
    prisma.redactionEntry.count({ where: { tenantId, caseId } }),
    prisma.redactionEntry.count({ where: { tenantId, caseId, approved: true } }),
    prisma.sensitiveDataFlag.count({ where: { tenantId, caseId, status: { in: ["FLAGGED", "UNDER_REVIEW"] } } }),
    prisma.legalException.count({ where: { tenantId, caseId, status: "PROPOSED" } }),
  ]);

  await prisma.caseRedactionReview.upsert({
    where: { caseId },
    update: {
      totalRedactions,
      approvedRedactions,
      pendingSensitiveFlags: pendingSensitive,
      pendingExceptions,
    },
    create: {
      tenantId,
      caseId,
      totalRedactions,
      approvedRedactions,
      pendingSensitiveFlags: pendingSensitive,
      pendingExceptions,
    },
  });
}

// ─── Workflow Gating ────────────────────────────────────────────────────────

export interface RedactionGateResult {
  allowed: boolean;
  blockers: string[];
}

/**
 * Check if response generation/sending is allowed based on redaction review state.
 * Blocks if:
 * - There are unapproved redaction entries
 * - There are pending sensitive data flags
 * - There are pending legal exceptions
 * - The redaction review state is not COMPLETED
 */
export async function checkRedactionGate(
  tenantId: string,
  caseId: string,
): Promise<RedactionGateResult> {
  const blockers: string[] = [];

  const [unapprovedRedactions, pendingSensitive, pendingExceptions, reviewState] = await Promise.all([
    prisma.redactionEntry.count({ where: { tenantId, caseId, approved: false } }),
    prisma.sensitiveDataFlag.count({ where: { tenantId, caseId, status: { in: ["FLAGGED", "UNDER_REVIEW"] } } }),
    prisma.legalException.count({ where: { tenantId, caseId, status: "PROPOSED" } }),
    prisma.caseRedactionReview.findUnique({ where: { caseId } }),
  ]);

  if (unapprovedRedactions > 0) {
    blockers.push(`${unapprovedRedactions} redaction(s) pending approval`);
  }

  if (pendingSensitive > 0) {
    blockers.push(`${pendingSensitive} sensitive data flag(s) pending review`);
  }

  if (pendingExceptions > 0) {
    blockers.push(`${pendingExceptions} legal exception(s) pending approval`);
  }

  // Only block on review state if there are any redactions/flags/exceptions in the case
  const hasAnyItems = await prisma.redactionEntry.count({ where: { tenantId, caseId } });
  if (hasAnyItems > 0 && (!reviewState || reviewState.state !== "COMPLETED")) {
    blockers.push("Redaction review has not been completed");
  }

  return {
    allowed: blockers.length === 0,
    blockers,
  };
}

/**
 * Check if legal hold blocks erasure operations for a case.
 */
export async function checkLegalHoldBlocksErasure(
  tenantId: string,
  caseId: string,
): Promise<{ blocked: boolean; reason?: string }> {
  const activeHold = await prisma.legalHold.findFirst({
    where: { tenantId, caseId, enabled: true },
  });

  if (activeHold) {
    return {
      blocked: true,
      reason: `Legal hold is active: ${activeHold.reason}. Erasure operations are blocked.`,
    };
  }

  return { blocked: false };
}
