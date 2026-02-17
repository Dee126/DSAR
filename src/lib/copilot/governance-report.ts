/**
 * Governance Report Service — Privacy Copilot
 *
 * Provides DPIA-ready reporting and logging for DPO/Auditor use.
 *
 * Key features:
 *   - Time-range filtered report of all Copilot runs
 *   - All identifiers in reports are masked (PII minimization)
 *   - Export as CSV or JSON (DPO/Admin only)
 *   - Tracks: who, when, which case, which subject (masked),
 *     justification, systems searched, content scanning usage,
 *     Art. 9 detection, export generation/approval
 *
 * This module contains pure functions for building report data.
 * Actual DB queries are performed in the API layer.
 */

import { maskIdentifierForLog } from "./governance";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GovernanceReportEntry {
  runId: string;
  caseId: string;
  caseNumber: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  justification: string;
  subjectIdentifier: string; // Always masked
  subjectIdentifierType: string;
  systemsSearched: string[];
  contentScanningUsed: boolean;
  ocrUsed: boolean;
  art9Suspected: boolean;
  specialCategories: string[];
  totalFindings: number;
  totalEvidenceItems: number;
  exportGenerated: boolean;
  exportApprovedBy: string | null;
  legalApprovalStatus: string;
}

export interface GovernanceReportFilter {
  tenantId: string;
  fromDate?: Date;
  toDate?: Date;
  userId?: string;
  caseId?: string;
  statusFilter?: string[];
}

export interface GovernanceReportSummary {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  art9DetectedRuns: number;
  totalExports: number;
  uniqueUsers: number;
  uniqueCases: number;
  periodStart: string;
  periodEnd: string;
}

// ---------------------------------------------------------------------------
// Role checks
// ---------------------------------------------------------------------------

const GOVERNANCE_REPORT_ROLES = new Set([
  "DPO",
  "TENANT_ADMIN",
  "SUPER_ADMIN",
  "AUDITOR",
]);

/**
 * Check whether a role can view governance reports.
 */
export function canViewGovernanceReport(role: string): boolean {
  return GOVERNANCE_REPORT_ROLES.has(role);
}

/**
 * Check whether a role can export governance reports.
 */
export function canExportGovernanceReport(role: string): boolean {
  return GOVERNANCE_REPORT_ROLES.has(role);
}

// ---------------------------------------------------------------------------
// Report building (pure functions)
// ---------------------------------------------------------------------------

/**
 * Build a governance report entry from raw data.
 * All subject identifiers are automatically masked.
 */
export function buildReportEntry(raw: {
  runId: string;
  caseId: string;
  caseNumber: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  startedAt: Date | null;
  completedAt: Date | null;
  status: string;
  justification: string;
  subjectIdentifierType: string;
  subjectIdentifierValue: string;
  systemsSearched: string[];
  contentScanningUsed: boolean;
  ocrUsed: boolean;
  art9Suspected: boolean;
  specialCategories: string[];
  totalFindings: number;
  totalEvidenceItems: number;
  exportGenerated: boolean;
  exportApprovedBy: string | null;
  legalApprovalStatus: string;
}): GovernanceReportEntry {
  return {
    runId: raw.runId,
    caseId: raw.caseId,
    caseNumber: raw.caseNumber,
    actorUserId: raw.actorUserId,
    actorName: raw.actorName,
    actorRole: raw.actorRole,
    startedAt: raw.startedAt?.toISOString() ?? null,
    completedAt: raw.completedAt?.toISOString() ?? null,
    status: raw.status,
    justification: raw.justification,
    // ALWAYS mask the subject identifier
    subjectIdentifier: maskIdentifierForLog(
      raw.subjectIdentifierType,
      raw.subjectIdentifierValue,
    ),
    subjectIdentifierType: raw.subjectIdentifierType,
    systemsSearched: raw.systemsSearched,
    contentScanningUsed: raw.contentScanningUsed,
    ocrUsed: raw.ocrUsed,
    art9Suspected: raw.art9Suspected,
    specialCategories: raw.specialCategories,
    totalFindings: raw.totalFindings,
    totalEvidenceItems: raw.totalEvidenceItems,
    exportGenerated: raw.exportGenerated,
    exportApprovedBy: raw.exportApprovedBy,
    legalApprovalStatus: raw.legalApprovalStatus,
  };
}

/**
 * Generate a report summary from a list of report entries.
 */
export function buildReportSummary(
  entries: GovernanceReportEntry[],
  periodStart: Date,
  periodEnd: Date,
): GovernanceReportSummary {
  const uniqueUsers = new Set(entries.map((e) => e.actorUserId));
  const uniqueCases = new Set(entries.map((e) => e.caseId));

  return {
    totalRuns: entries.length,
    completedRuns: entries.filter((e) => e.status === "COMPLETED").length,
    failedRuns: entries.filter((e) => e.status === "FAILED").length,
    art9DetectedRuns: entries.filter((e) => e.art9Suspected).length,
    totalExports: entries.filter((e) => e.exportGenerated).length,
    uniqueUsers: uniqueUsers.size,
    uniqueCases: uniqueCases.size,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Export formats
// ---------------------------------------------------------------------------

/**
 * Export governance report entries as CSV.
 * All identifiers are pre-masked.
 */
export function exportReportAsCSV(entries: GovernanceReportEntry[]): string {
  const header = [
    "RunId",
    "CaseId",
    "CaseNumber",
    "ActorUserId",
    "ActorName",
    "ActorRole",
    "StartedAt",
    "CompletedAt",
    "Status",
    "Justification",
    "SubjectIdentifier",
    "SubjectIdentifierType",
    "SystemsSearched",
    "ContentScanningUsed",
    "OcrUsed",
    "Art9Suspected",
    "SpecialCategories",
    "TotalFindings",
    "TotalEvidenceItems",
    "ExportGenerated",
    "ExportApprovedBy",
    "LegalApprovalStatus",
  ].join(",");

  const rows: string[] = [header];

  for (const entry of entries) {
    const row = [
      csvEscape(entry.runId),
      csvEscape(entry.caseId),
      csvEscape(entry.caseNumber),
      csvEscape(entry.actorUserId),
      csvEscape(entry.actorName),
      csvEscape(entry.actorRole),
      csvEscape(entry.startedAt ?? ""),
      csvEscape(entry.completedAt ?? ""),
      csvEscape(entry.status),
      csvEscape(entry.justification),
      csvEscape(entry.subjectIdentifier),
      csvEscape(entry.subjectIdentifierType),
      csvEscape(entry.systemsSearched.join("; ")),
      entry.contentScanningUsed ? "YES" : "NO",
      entry.ocrUsed ? "YES" : "NO",
      entry.art9Suspected ? "YES" : "NO",
      csvEscape(entry.specialCategories.join("; ")),
      String(entry.totalFindings),
      String(entry.totalEvidenceItems),
      entry.exportGenerated ? "YES" : "NO",
      csvEscape(entry.exportApprovedBy ?? ""),
      csvEscape(entry.legalApprovalStatus),
    ].join(",");

    rows.push(row);
  }

  return rows.join("\n");
}

/**
 * Export governance report as JSON.
 * All identifiers are pre-masked.
 */
export function exportReportAsJSON(
  entries: GovernanceReportEntry[],
  summary: GovernanceReportSummary,
): string {
  return JSON.stringify(
    {
      meta: {
        generatedAt: new Date().toISOString(),
        reportType: "COPILOT_GOVERNANCE_DPIA",
        version: "1.0",
      },
      summary,
      entries,
    },
    null,
    2,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
