/**
 * Legal Exception & Partial Denial Service — Module 8.3
 *
 * Manages legal exceptions (Art. 15(4), Art. 17(3), Art. 23, etc.)
 * and partial denial sections for DSAR responses.
 */

import { prisma } from "./prisma";
import { logAudit, getClientInfo } from "./audit";
import type { NextRequest } from "next/server";

// ─── Legal Exceptions ───────────────────────────────────────────────────────

export async function createLegalException(
  tenantId: string,
  caseId: string,
  userId: string,
  data: {
    exceptionType: string;
    legalBasisReference: string;
    scope: string;
    justification: string;
  },
  request?: NextRequest,
) {
  const exception = await prisma.legalException.create({
    data: {
      tenantId,
      caseId,
      exceptionType: data.exceptionType as any,
      legalBasisReference: data.legalBasisReference,
      scope: data.scope,
      justification: data.justification,
      proposedByUserId: userId,
    },
  });

  const clientInfo = request ? getClientInfo(request) : {};
  await logAudit({
    tenantId,
    actorUserId: userId,
    action: "LEGAL_EXCEPTION_PROPOSED",
    entityType: "LegalException",
    entityId: exception.id,
    ...clientInfo,
    details: {
      caseId,
      exceptionType: data.exceptionType,
      legalBasisReference: data.legalBasisReference,
    },
  });

  return exception;
}

export async function decideLegalException(
  tenantId: string,
  exceptionId: string,
  userId: string,
  action: "approve" | "reject" | "withdraw",
  rejectionReason?: string,
  request?: NextRequest,
) {
  const statusMap = {
    approve: "APPROVED",
    reject: "REJECTED",
    withdraw: "WITHDRAWN",
  } as const;

  const exception = await prisma.legalException.update({
    where: { id: exceptionId },
    data: {
      status: statusMap[action] as any,
      ...(action === "approve" ? { approvedByUserId: userId, approvedAt: new Date() } : {}),
      ...(action === "reject" ? { rejectionReason } : {}),
    },
  });

  const clientInfo = request ? getClientInfo(request) : {};
  await logAudit({
    tenantId,
    actorUserId: userId,
    action: `LEGAL_EXCEPTION_${statusMap[action]}`,
    entityType: "LegalException",
    entityId: exception.id,
    ...clientInfo,
    details: {
      caseId: exception.caseId,
      exceptionType: exception.exceptionType,
      action,
      rejectionReason,
    },
  });

  return exception;
}

export async function getLegalExceptions(tenantId: string, caseId: string) {
  return prisma.legalException.findMany({
    where: { tenantId, caseId },
    include: {
      proposedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true } },
      partialDenials: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Partial Denial Sections ────────────────────────────────────────────────

export async function createPartialDenial(
  tenantId: string,
  caseId: string,
  userId: string,
  data: {
    sectionKey: string;
    deniedScope: string;
    legalBasis: string;
    exceptionId?: string;
    justificationText: string;
  },
  request?: NextRequest,
) {
  const denial = await prisma.partialDenialSection.create({
    data: {
      tenantId,
      caseId,
      sectionKey: data.sectionKey,
      deniedScope: data.deniedScope,
      legalBasis: data.legalBasis,
      exceptionId: data.exceptionId,
      justificationText: data.justificationText,
      createdByUserId: userId,
    },
  });

  const clientInfo = request ? getClientInfo(request) : {};
  await logAudit({
    tenantId,
    actorUserId: userId,
    action: "PARTIAL_DENIAL_CREATED",
    entityType: "PartialDenialSection",
    entityId: denial.id,
    ...clientInfo,
    details: {
      caseId,
      sectionKey: data.sectionKey,
      legalBasis: data.legalBasis,
    },
  });

  return denial;
}

export async function decidePartialDenial(
  tenantId: string,
  denialId: string,
  userId: string,
  action: "submit" | "approve" | "reject",
  request?: NextRequest,
) {
  const statusMap = {
    submit: "SUBMITTED",
    approve: "APPROVED",
    reject: "REJECTED",
  } as const;

  const denial = await prisma.partialDenialSection.update({
    where: { id: denialId },
    data: {
      status: statusMap[action] as any,
      ...(action === "approve" ? { approvedByUserId: userId, approvedAt: new Date() } : {}),
    },
  });

  const clientInfo = request ? getClientInfo(request) : {};
  await logAudit({
    tenantId,
    actorUserId: userId,
    action: `PARTIAL_DENIAL_${statusMap[action]}`,
    entityType: "PartialDenialSection",
    entityId: denial.id,
    ...clientInfo,
    details: {
      caseId: denial.caseId,
      sectionKey: denial.sectionKey,
      action,
    },
  });

  return denial;
}

export async function getPartialDenials(tenantId: string, caseId: string) {
  return prisma.partialDenialSection.findMany({
    where: { tenantId, caseId },
    include: {
      exception: { select: { id: true, exceptionType: true, legalBasisReference: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Summary Helpers ────────────────────────────────────────────────────────

/**
 * Build a redaction/exception summary for the FactPack.
 */
export async function buildRedactionSummary(
  tenantId: string,
  caseId: string,
): Promise<{
  totalRedactions: number;
  approvedRedactions: number;
  redactionTypes: string[];
  totalSensitiveFlags: number;
  pendingSensitiveFlags: number;
  legalExceptions: Array<{ type: string; status: string; scope: string }>;
  partialDenials: Array<{ sectionKey: string; status: string; legalBasis: string }>;
  reviewState: string | null;
}> {
  const [
    redactionEntries,
    sensitiveFlags,
    exceptions,
    denials,
    reviewState,
  ] = await Promise.all([
    prisma.redactionEntry.findMany({ where: { tenantId, caseId } }),
    prisma.sensitiveDataFlag.findMany({ where: { tenantId, caseId } }),
    prisma.legalException.findMany({ where: { tenantId, caseId } }),
    prisma.partialDenialSection.findMany({ where: { tenantId, caseId } }),
    prisma.caseRedactionReview.findUnique({ where: { caseId } }),
  ]);

  const redactionTypes = Array.from(
    new Set(redactionEntries.filter((r: { redactionType: string | null }) => r.redactionType).map((r: { redactionType: string | null }) => r.redactionType!))
  );

  return {
    totalRedactions: redactionEntries.length,
    approvedRedactions: redactionEntries.filter((r: { approved: boolean }) => r.approved).length,
    redactionTypes,
    totalSensitiveFlags: sensitiveFlags.length,
    pendingSensitiveFlags: sensitiveFlags.filter((f: { status: string }) => f.status === "FLAGGED" || f.status === "UNDER_REVIEW").length,
    legalExceptions: exceptions.map((e: { exceptionType: string; status: string; scope: string }) => ({
      type: e.exceptionType,
      status: e.status,
      scope: e.scope,
    })),
    partialDenials: denials.map((d: { sectionKey: string; status: string; legalBasis: string }) => ({
      sectionKey: d.sectionKey,
      status: d.status,
      legalBasis: d.legalBasis,
    })),
    reviewState: reviewState?.state || null,
  };
}
