/**
 * Export Service — Privacy Copilot
 *
 * Creates ExportArtifact records containing evidence index exports with
 * legal gate enforcement. If a copilot run contains Art. 9 special-category
 * data, export is blocked until a DPO or legal counsel explicitly approves
 * it via the legal gate workflow.
 *
 * Functions:
 *   - generateEvidenceIndexExport:  Build a full evidence index and create an ExportArtifact
 *   - checkLegalGate:               Check whether export is allowed for a run
 *   - approveLegalGate:             Approve the legal gate for a run
 *   - rejectLegalGate:              Reject the legal gate for a run
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvidenceIndexData {
  runId: string;
  caseNumber: string;
  exportedAt: string;
  evidenceItems: Array<{
    id: string;
    provider: string;
    workload: string | null;
    itemType: string;
    location: string;
    title: string;
    contentHandling: string;
    createdAtSource: string | null;
    modifiedAtSource: string | null;
    sensitivityScore: number | null;
    metadata: unknown;
  }>;
  findings: Array<{
    id: string;
    dataCategory: string;
    severity: string;
    confidence: number;
    summary: string;
    evidenceItemIds: string[];
    containsSpecialCategory: boolean;
    containsThirdPartyDataSuspected: boolean;
    requiresLegalReview: boolean;
  }>;
  detectorSummary: {
    totalDetectorResults: number;
    detectorTypes: string[];
    specialCategorySuspectedCount: number;
  };
  specialCategoryWarning: string | null;
}

export interface ExportResult {
  artifact: Awaited<ReturnType<typeof prisma.exportArtifact.create>>;
  data: EvidenceIndexData | null;
}

export interface LegalGateCheckResult {
  allowed: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Internal: validate run belongs to tenant
// ---------------------------------------------------------------------------

async function loadAndValidateRun(tenantId: string, runId: string) {
  const run = await prisma.copilotRun.findFirst({
    where: { id: runId, tenantId },
  });

  if (!run) {
    throw new Error(
      `CopilotRun ${runId} not found or does not belong to tenant ${tenantId}`
    );
  }

  return run;
}

// ---------------------------------------------------------------------------
// 1. generateEvidenceIndexExport
// ---------------------------------------------------------------------------

/**
 * Generate an evidence index export for a copilot run.
 *
 * Before building the export, the legal gate is checked: if the run has
 * `containsSpecialCategory=true` and `legalApprovalStatus` is not "APPROVED",
 * the artifact is created with `legalGateStatus="BLOCKED"` and status="BLOCKED",
 * and no data is returned.
 *
 * When the legal gate is satisfied (or not required), all EvidenceItems,
 * Findings, and DetectorResults are loaded, assembled into a structured
 * evidence index, and the artifact is created with status="COMPLETED".
 */
export async function generateEvidenceIndexExport(
  tenantId: string,
  caseId: string,
  runId: string,
  userId: string,
  exportType: string = "JSON"
): Promise<ExportResult> {
  const run = await loadAndValidateRun(tenantId, runId);

  // -----------------------------------------------------------------------
  // Legal gate check
  // -----------------------------------------------------------------------
  if (
    run.containsSpecialCategory &&
    run.legalApprovalStatus !== "APPROVED"
  ) {
    // Create a BLOCKED artifact
    const artifact = await prisma.exportArtifact.create({
      data: {
        tenantId,
        caseId,
        runId,
        createdByUserId: userId,
        exportType: exportType as any,
        status: "BLOCKED",
        legalGateStatus: "BLOCKED",
      },
    });

    await logAudit({
      tenantId,
      actorUserId: userId,
      action: "copilot_export.blocked",
      entityType: "ExportArtifact",
      entityId: artifact.id,
      details: {
        caseId,
        runId,
        reason: "Special category data detected but legal gate not approved",
        legalApprovalStatus: run.legalApprovalStatus,
        containsSpecialCategory: true,
      },
    });

    return { artifact, data: null };
  }

  // -----------------------------------------------------------------------
  // Load the case for the case number
  // -----------------------------------------------------------------------
  const dsarCase = await prisma.dSARCase.findFirst({
    where: { id: caseId, tenantId },
    select: { caseNumber: true },
  });

  if (!dsarCase) {
    throw new Error(
      `DSARCase ${caseId} not found or does not belong to tenant ${tenantId}`
    );
  }

  // -----------------------------------------------------------------------
  // Load all evidence items, findings, and detector results
  // -----------------------------------------------------------------------
  const evidenceItems = await prisma.evidenceItem.findMany({
    where: { tenantId, runId },
    orderBy: { createdAt: "asc" },
  });

  const findings = await prisma.finding.findMany({
    where: { tenantId, runId },
    orderBy: { dataCategory: "asc" },
  });

  const detectorResults = await prisma.detectorResult.findMany({
    where: { tenantId, runId },
    orderBy: { createdAt: "asc" },
  });

  // -----------------------------------------------------------------------
  // Build the evidence index
  // -----------------------------------------------------------------------
  const exportedAt = new Date().toISOString();

  // Compute detector summary
  const detectorTypes = Array.from(
    new Set(detectorResults.map((dr) => dr.detectorType))
  );
  const specialCategorySuspectedCount = detectorResults.filter(
    (dr) => dr.containsSpecialCategorySuspected
  ).length;

  // Special category warning
  const hasSpecialCategory = findings.some(
    (f) => f.containsSpecialCategory
  );
  const specialCategoryWarning = hasSpecialCategory
    ? "This export contains findings flagged as Art. 9 GDPR special category data. " +
      "Handle with heightened protection measures. Do not disclose without legal review."
    : null;

  const data: EvidenceIndexData = {
    runId,
    caseNumber: dsarCase.caseNumber,
    exportedAt,
    evidenceItems: evidenceItems.map((e) => ({
      id: e.id,
      provider: e.provider,
      workload: e.workload,
      itemType: e.itemType,
      location: e.location,
      title: e.title,
      contentHandling: e.contentHandling,
      createdAtSource: e.createdAtSource?.toISOString() ?? null,
      modifiedAtSource: e.modifiedAtSource?.toISOString() ?? null,
      sensitivityScore: e.sensitivityScore,
      metadata: e.metadata,
    })),
    findings: findings.map((f) => ({
      id: f.id,
      dataCategory: f.dataCategory,
      severity: f.severity,
      confidence: f.confidence,
      summary: f.summary,
      evidenceItemIds: f.evidenceItemIds,
      containsSpecialCategory: f.containsSpecialCategory,
      containsThirdPartyDataSuspected: f.containsThirdPartyDataSuspected,
      requiresLegalReview: f.requiresLegalReview,
    })),
    detectorSummary: {
      totalDetectorResults: detectorResults.length,
      detectorTypes,
      specialCategorySuspectedCount,
    },
    specialCategoryWarning,
  };

  // -----------------------------------------------------------------------
  // Create the ExportArtifact record
  // -----------------------------------------------------------------------
  const artifact = await prisma.exportArtifact.create({
    data: {
      tenantId,
      caseId,
      runId,
      createdByUserId: userId,
      exportType: exportType as any,
      status: "COMPLETED",
      legalGateStatus: "ALLOWED",
    },
  });

  await logAudit({
    tenantId,
    actorUserId: userId,
    action: "copilot_export.generated",
    entityType: "ExportArtifact",
    entityId: artifact.id,
    details: {
      caseId,
      runId,
      exportType,
      evidenceItemCount: evidenceItems.length,
      findingCount: findings.length,
      detectorResultCount: detectorResults.length,
      containsSpecialCategory: hasSpecialCategory,
    },
  });

  return { artifact, data };
}

// ---------------------------------------------------------------------------
// 2. checkLegalGate
// ---------------------------------------------------------------------------

/**
 * Check whether export is allowed for a copilot run.
 *
 * Export is allowed when:
 *   - The run does not contain special category data, OR
 *   - The run's legalApprovalStatus is "APPROVED"
 *
 * Returns `{ allowed: true }` if export may proceed, or
 * `{ allowed: false, reason: "..." }` if blocked.
 */
export async function checkLegalGate(
  tenantId: string,
  runId: string
): Promise<LegalGateCheckResult> {
  const run = await loadAndValidateRun(tenantId, runId);

  if (!run.containsSpecialCategory) {
    return { allowed: true };
  }

  if (run.legalApprovalStatus === "APPROVED") {
    return { allowed: true };
  }

  if (run.legalApprovalStatus === "REJECTED") {
    return {
      allowed: false,
      reason:
        "Legal gate has been rejected. Special category data was detected and a reviewer " +
        "has explicitly rejected the export. Contact your DPO for further guidance.",
    };
  }

  // REQUIRED, PENDING, or NOT_REQUIRED (but containsSpecialCategory is true)
  return {
    allowed: false,
    reason:
      "Export is blocked because this run contains Art. 9 special category data " +
      `and legal approval has not been granted (current status: ${run.legalApprovalStatus}). ` +
      "A DPO or legal counsel must approve the legal gate before export.",
  };
}

// ---------------------------------------------------------------------------
// 3. approveLegalGate
// ---------------------------------------------------------------------------

/**
 * Approve the legal gate for a copilot run.
 *
 * Sets legalApprovalStatus to "APPROVED", records the approving user and
 * timestamp, and logs an audit event. After approval, exports for this
 * run will no longer be blocked by the legal gate.
 */
export async function approveLegalGate(
  tenantId: string,
  runId: string,
  userId: string
) {
  await loadAndValidateRun(tenantId, runId);

  const updatedRun = await prisma.copilotRun.update({
    where: { id: runId },
    data: {
      legalApprovalStatus: "APPROVED",
      legalApprovedByUserId: userId,
      legalApprovedAt: new Date(),
    },
  });

  await logAudit({
    tenantId,
    actorUserId: userId,
    action: "copilot_run.legal_approved",
    entityType: "CopilotRun",
    entityId: runId,
    details: {
      caseId: updatedRun.caseId,
      legalApprovalStatus: "APPROVED",
      approvedByUserId: userId,
    },
  });

  return updatedRun;
}

// ---------------------------------------------------------------------------
// 4. rejectLegalGate
// ---------------------------------------------------------------------------

/**
 * Reject the legal gate for a copilot run.
 *
 * Sets legalApprovalStatus to "REJECTED" and logs an audit event with
 * an optional rejection reason. After rejection, exports for this run
 * remain blocked until a new approval is granted.
 */
export async function rejectLegalGate(
  tenantId: string,
  runId: string,
  userId: string,
  reason?: string
) {
  await loadAndValidateRun(tenantId, runId);

  const updatedRun = await prisma.copilotRun.update({
    where: { id: runId },
    data: {
      legalApprovalStatus: "REJECTED",
    },
  });

  await logAudit({
    tenantId,
    actorUserId: userId,
    action: "copilot_run.legal_rejected",
    entityType: "CopilotRun",
    entityId: runId,
    details: {
      caseId: updatedRun.caseId,
      legalApprovalStatus: "REJECTED",
      rejectedByUserId: userId,
      reason: reason ?? null,
    },
  });

  return updatedRun;
}
