/**
 * Governance Engine — Privacy Copilot Safety & Governance Framework
 *
 * Core enforcement layer ensuring the Copilot cannot be used as a surveillance
 * tool. Implements:
 *
 *   1. Case-Only Enforcement — every Copilot action requires caseId + tenantId
 *   2. Search Justification — mandatory justification with quick templates
 *   3. Least Privilege — role-based scope restrictions
 *   4. Rate Limiting — per-user, per-tenant, concurrency limits
 *   5. Anomaly Detection — break-glass events for suspicious patterns
 *   6. Retention — artifact lifecycle management
 *   7. Data Minimization — storage governance
 *
 * Every enforcement function is designed to be called server-side before
 * any Copilot operation proceeds.
 */

import { maskPII } from "./detection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CopilotPurpose = "DSAR";

export interface CopilotRunRequest {
  tenantId: string;
  caseId: string;
  userId: string;
  userRole: string;
  justification: string;
  purpose?: CopilotPurpose;
  contentScanRequested?: boolean;
  ocrRequested?: boolean;
  llmRequested?: boolean;
}

export interface GovernanceCheckResult {
  allowed: boolean;
  reason?: string;
  code?: string;
}

export interface GovernanceSettings {
  copilotEnabled: boolean;
  allowedProviderPhases: number[];
  defaultExecutionMode: string;
  allowContentScanning: boolean;
  allowOcr: boolean;
  allowLlmSummaries: boolean;
  maxRunsPerDayTenant: number;
  maxRunsPerDayUser: number;
  maxEvidenceItemsPerRun: number;
  maxContentScanBytes: number;
  maxConcurrentRuns: number;
  dueSoonWindowDays: number;
  artifactRetentionDays: number;
  twoPersonApprovalForExport: boolean;
  requireJustification: boolean;
  requireConfirmation: boolean;
}

export interface RateLimitState {
  tenantRunsToday: number;
  userRunsToday: number;
  concurrentRuns: number;
}

export interface AnomalyCheckInput {
  userId: string;
  tenantId: string;
  runsInLastHour: number;
  distinctSubjectsInLastHour: number;
  permissionDeniedInLastHour: number;
}

export interface AnomalyCheckResult {
  isAnomaly: boolean;
  eventType?: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Justification Templates
// ---------------------------------------------------------------------------

export const JUSTIFICATION_TEMPLATES = [
  {
    id: "art15_access",
    label: "Art. 15 Access request – response preparation",
    text: "Art. 15 GDPR access request – locating personal data for response preparation",
  },
  {
    id: "art17_erasure",
    label: "Art. 17 Erasure request – locate data for deletion assessment",
    text: "Art. 17 GDPR erasure request – identifying data locations for deletion assessment",
  },
  {
    id: "identity_verification",
    label: "Identity verification support – correlate identifiers",
    text: "Identity verification support – correlating identifiers to confirm data subject identity",
  },
  {
    id: "art16_rectification",
    label: "Art. 16 Rectification request – locate data for correction",
    text: "Art. 16 GDPR rectification request – locating data for accuracy correction",
  },
  {
    id: "art20_portability",
    label: "Art. 20 Portability request – prepare data export",
    text: "Art. 20 GDPR portability request – preparing structured data export",
  },
] as const;

// ---------------------------------------------------------------------------
// Default Governance Settings
// ---------------------------------------------------------------------------

export const DEFAULT_GOVERNANCE_SETTINGS: GovernanceSettings = {
  copilotEnabled: true,
  allowedProviderPhases: [1],
  defaultExecutionMode: "METADATA_ONLY",
  allowContentScanning: false,
  allowOcr: false,
  allowLlmSummaries: false,
  maxRunsPerDayTenant: 100,
  maxRunsPerDayUser: 20,
  maxEvidenceItemsPerRun: 10000,
  maxContentScanBytes: 512000,
  maxConcurrentRuns: 3,
  dueSoonWindowDays: 7,
  artifactRetentionDays: 90,
  twoPersonApprovalForExport: false,
  requireJustification: true,
  requireConfirmation: true,
};

// ---------------------------------------------------------------------------
// Role-based Copilot Scopes
// ---------------------------------------------------------------------------

export interface CopilotRoleScope {
  canStartRun: boolean;
  canConfigureRun: boolean;
  metadataOnly: boolean;
  canRequestContentScan: boolean;
  canGenerateSummaries: boolean;
  canRequestExport: boolean;
  canApproveExport: boolean;
  canApproveArt9: boolean;
  canChangeSettings: boolean;
  canViewGovernanceReport: boolean;
}

const COPILOT_ROLE_SCOPES: Record<string, CopilotRoleScope> = {
  SUPER_ADMIN: {
    canStartRun: true,
    canConfigureRun: true,
    metadataOnly: false,
    canRequestContentScan: true,
    canGenerateSummaries: true,
    canRequestExport: true,
    canApproveExport: true,
    canApproveArt9: true,
    canChangeSettings: true,
    canViewGovernanceReport: true,
  },
  TENANT_ADMIN: {
    canStartRun: true,
    canConfigureRun: true,
    metadataOnly: false,
    canRequestContentScan: true,
    canGenerateSummaries: true,
    canRequestExport: true,
    canApproveExport: true,
    canApproveArt9: true,
    canChangeSettings: true,
    canViewGovernanceReport: true,
  },
  DPO: {
    canStartRun: true,
    canConfigureRun: true,
    metadataOnly: false,
    canRequestContentScan: true,
    canGenerateSummaries: true,
    canRequestExport: true,
    canApproveExport: true,
    canApproveArt9: true,
    canChangeSettings: true,
    canViewGovernanceReport: true,
  },
  CASE_MANAGER: {
    canStartRun: true,
    canConfigureRun: true,
    metadataOnly: false,
    canRequestContentScan: false,
    canGenerateSummaries: true,
    canRequestExport: true,
    canApproveExport: false,
    canApproveArt9: false,
    canChangeSettings: false,
    canViewGovernanceReport: false,
  },
  CONTRIBUTOR: {
    canStartRun: false,
    canConfigureRun: false,
    metadataOnly: true,
    canRequestContentScan: false,
    canGenerateSummaries: false,
    canRequestExport: false,
    canApproveExport: false,
    canApproveArt9: false,
    canChangeSettings: false,
    canViewGovernanceReport: false,
  },
  READ_ONLY: {
    canStartRun: false,
    canConfigureRun: false,
    metadataOnly: true,
    canRequestContentScan: false,
    canGenerateSummaries: false,
    canRequestExport: false,
    canApproveExport: false,
    canApproveArt9: false,
    canChangeSettings: false,
    canViewGovernanceReport: false,
  },
};

/**
 * Get the Copilot scope for a given role.
 */
export function getCopilotRoleScope(role: string): CopilotRoleScope {
  return COPILOT_ROLE_SCOPES[role] ?? COPILOT_ROLE_SCOPES.READ_ONLY;
}

// ---------------------------------------------------------------------------
// 1. Case-Only Enforcement
// ---------------------------------------------------------------------------

/**
 * Validate that a Copilot request is bound to a valid case.
 * Rejects requests without caseId or tenantId.
 */
export function enforceCaseBinding(
  caseId: string | null | undefined,
  tenantId: string | null | undefined,
): GovernanceCheckResult {
  if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
    return {
      allowed: false,
      reason: "Copilot actions require a valid tenantId",
      code: "MISSING_TENANT_ID",
    };
  }

  if (!caseId || typeof caseId !== "string" || caseId.trim() === "") {
    return {
      allowed: false,
      reason: "Copilot actions are only permitted within a DSAR case. No caseId provided.",
      code: "MISSING_CASE_ID",
    };
  }

  return { allowed: true };
}

/**
 * Validate that a subject identity is linked to the case.
 */
export function enforceSubjectLinked(
  identityProfileExists: boolean,
): GovernanceCheckResult {
  if (!identityProfileExists) {
    return {
      allowed: false,
      reason: "Subject must be linked to case. An IdentityProfile must exist or be created for the case before running the Copilot.",
      code: "SUBJECT_NOT_LINKED",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 2. Justification Enforcement
// ---------------------------------------------------------------------------

/**
 * Validate that a justification is provided for a Copilot run.
 */
export function enforceJustification(
  justification: string | null | undefined,
  settings: GovernanceSettings,
): GovernanceCheckResult {
  if (!settings.requireJustification) {
    return { allowed: true };
  }

  if (
    !justification ||
    typeof justification !== "string" ||
    justification.trim().length < 10
  ) {
    return {
      allowed: false,
      reason: "A justification of at least 10 characters is required for every Copilot run.",
      code: "MISSING_JUSTIFICATION",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 3. Role-based Scope Enforcement
// ---------------------------------------------------------------------------

/**
 * Enforce that the user's role allows starting a Copilot run.
 */
export function enforceRunPermission(
  role: string,
): GovernanceCheckResult {
  const scope = getCopilotRoleScope(role);
  if (!scope.canStartRun) {
    return {
      allowed: false,
      reason: `Role '${role}' does not have permission to start Copilot runs.`,
      code: "ROLE_FORBIDDEN",
    };
  }
  return { allowed: true };
}

/**
 * Enforce content scanning permissions.
 * CONTRIBUTOR/READ_ONLY: always metadata-only.
 * CASE_MANAGER: cannot enable content scanning.
 * DPO/ADMIN: can enable if tenant settings allow.
 */
export function enforceContentScanPermission(
  role: string,
  contentScanRequested: boolean,
  settings: GovernanceSettings,
): GovernanceCheckResult {
  if (!contentScanRequested) {
    return { allowed: true };
  }

  const scope = getCopilotRoleScope(role);

  if (!scope.canRequestContentScan) {
    return {
      allowed: false,
      reason: `Role '${role}' does not have permission to enable content scanning.`,
      code: "CONTENT_SCAN_FORBIDDEN",
    };
  }

  if (!settings.allowContentScanning) {
    return {
      allowed: false,
      reason: "Content scanning is disabled in tenant governance settings.",
      code: "CONTENT_SCAN_DISABLED",
    };
  }

  return { allowed: true };
}

/**
 * Enforce export permission (request + approval).
 */
export function enforceExportPermission(
  role: string,
): GovernanceCheckResult {
  const scope = getCopilotRoleScope(role);
  if (!scope.canRequestExport) {
    return {
      allowed: false,
      reason: `Role '${role}' does not have permission to request exports.`,
      code: "EXPORT_FORBIDDEN",
    };
  }
  return { allowed: true };
}

/**
 * Enforce governance settings change permission.
 */
export function enforceSettingsPermission(
  role: string,
): GovernanceCheckResult {
  const scope = getCopilotRoleScope(role);
  if (!scope.canChangeSettings) {
    return {
      allowed: false,
      reason: `Role '${role}' does not have permission to change governance settings.`,
      code: "SETTINGS_FORBIDDEN",
    };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 4. Rate Limiting
// ---------------------------------------------------------------------------

/**
 * Check rate limits for a Copilot run.
 */
export function enforceRateLimits(
  state: RateLimitState,
  settings: GovernanceSettings,
): GovernanceCheckResult {
  if (state.concurrentRuns >= settings.maxConcurrentRuns) {
    return {
      allowed: false,
      reason: `Concurrency limit reached (${settings.maxConcurrentRuns} concurrent runs). Please wait for a running operation to complete.`,
      code: "CONCURRENCY_LIMIT",
    };
  }

  if (state.tenantRunsToday >= settings.maxRunsPerDayTenant) {
    return {
      allowed: false,
      reason: `Tenant daily limit reached (${settings.maxRunsPerDayTenant} runs/day).`,
      code: "TENANT_DAILY_LIMIT",
    };
  }

  if (state.userRunsToday >= settings.maxRunsPerDayUser) {
    return {
      allowed: false,
      reason: `User daily limit reached (${settings.maxRunsPerDayUser} runs/day).`,
      code: "USER_DAILY_LIMIT",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 5. Anomaly Detection
// ---------------------------------------------------------------------------

/** Threshold: runs in one hour by a single user */
const ANOMALY_RUNS_PER_HOUR = 10;
/** Threshold: distinct subjects searched in one hour */
const ANOMALY_SUBJECTS_PER_HOUR = 5;
/** Threshold: permission denied attempts in one hour */
const ANOMALY_PERMISSION_DENIED_PER_HOUR = 5;

/**
 * Check for anomalous usage patterns.
 * Returns an AnomalyCheckResult with details if suspicious activity is detected.
 */
export function checkForAnomalies(
  input: AnomalyCheckInput,
): AnomalyCheckResult {
  if (input.runsInLastHour >= ANOMALY_RUNS_PER_HOUR) {
    return {
      isAnomaly: true,
      eventType: "ANOMALY_MANY_RUNS",
      description: `User ${input.userId} executed ${input.runsInLastHour} Copilot runs in the last hour (threshold: ${ANOMALY_RUNS_PER_HOUR}).`,
    };
  }

  if (input.distinctSubjectsInLastHour >= ANOMALY_SUBJECTS_PER_HOUR) {
    return {
      isAnomaly: true,
      eventType: "ANOMALY_MANY_SUBJECTS",
      description: `User ${input.userId} searched for ${input.distinctSubjectsInLastHour} distinct subjects in the last hour (threshold: ${ANOMALY_SUBJECTS_PER_HOUR}).`,
    };
  }

  if (input.permissionDeniedInLastHour >= ANOMALY_PERMISSION_DENIED_PER_HOUR) {
    return {
      isAnomaly: true,
      eventType: "ANOMALY_PERMISSION_DENIED",
      description: `User ${input.userId} received ${input.permissionDeniedInLastHour} permission denied events in the last hour (threshold: ${ANOMALY_PERMISSION_DENIED_PER_HOUR}).`,
    };
  }

  return { isAnomaly: false };
}

// ---------------------------------------------------------------------------
// 6. Two-Person Export Approval
// ---------------------------------------------------------------------------

export interface TwoPersonApprovalState {
  approvals: Array<{
    userId: string;
    role: string;
    approved: boolean;
  }>;
}

/**
 * Check whether a two-person export approval is satisfied.
 *
 * Requirements (when twoPersonApprovalForExport is enabled):
 *   - At least 2 distinct approvers
 *   - Both must have approved (not rejected)
 *   - At least one must be DPO, TENANT_ADMIN, or SUPER_ADMIN
 *   - The export requester cannot be one of the approvers
 */
export function checkTwoPersonApproval(
  state: TwoPersonApprovalState,
  requesterId: string,
  settings: GovernanceSettings,
): GovernanceCheckResult {
  if (!settings.twoPersonApprovalForExport) {
    return { allowed: true };
  }

  const validApprovals = state.approvals.filter(
    (a) => a.approved && a.userId !== requesterId,
  );

  if (validApprovals.length < 2) {
    return {
      allowed: false,
      reason: `Two-person approval required. ${validApprovals.length} of 2 required approvals received (excluding requester).`,
      code: "TWO_PERSON_APPROVAL_REQUIRED",
    };
  }

  const hasQualifiedApprover = validApprovals.some(
    (a) =>
      a.role === "DPO" || a.role === "TENANT_ADMIN" || a.role === "SUPER_ADMIN",
  );

  if (!hasQualifiedApprover) {
    return {
      allowed: false,
      reason: "Two-person approval requires at least one DPO, Tenant Admin, or Super Admin approver.",
      code: "TWO_PERSON_APPROVAL_REQUIRES_DPO",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 7. Full Pre-Run Governance Check
// ---------------------------------------------------------------------------

/**
 * Run ALL governance checks before a Copilot run starts.
 *
 * Returns the first failing check, or { allowed: true } if all pass.
 * Designed to be called server-side in the API route.
 */
export function runPreFlightChecks(
  request: CopilotRunRequest,
  settings: GovernanceSettings,
  rateLimitState: RateLimitState,
  identityProfileExists: boolean,
): GovernanceCheckResult {
  // Global killswitch
  if (!settings.copilotEnabled) {
    return {
      allowed: false,
      reason: "Copilot is disabled for this tenant.",
      code: "COPILOT_DISABLED",
    };
  }

  // Case binding
  const caseCheck = enforceCaseBinding(request.caseId, request.tenantId);
  if (!caseCheck.allowed) return caseCheck;

  // Subject linked
  const subjectCheck = enforceSubjectLinked(identityProfileExists);
  if (!subjectCheck.allowed) return subjectCheck;

  // Justification
  const justCheck = enforceJustification(request.justification, settings);
  if (!justCheck.allowed) return justCheck;

  // Role permission
  const roleCheck = enforceRunPermission(request.userRole);
  if (!roleCheck.allowed) return roleCheck;

  // Content scan permission
  const scanCheck = enforceContentScanPermission(
    request.userRole,
    request.contentScanRequested ?? false,
    settings,
  );
  if (!scanCheck.allowed) return scanCheck;

  // Rate limits
  const rateCheck = enforceRateLimits(rateLimitState, settings);
  if (!rateCheck.allowed) return rateCheck;

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 8. Retention / Artifact Lifecycle
// ---------------------------------------------------------------------------

/**
 * Calculate the retention deletion date for copilot artifacts
 * based on case closure date and tenant retention setting.
 */
export function calculateRetentionDate(
  caseClosedAt: Date | null,
  retentionDays: number,
): Date | null {
  if (!caseClosedAt) return null;
  const retentionDate = new Date(caseClosedAt);
  retentionDate.setDate(retentionDate.getDate() + retentionDays);
  return retentionDate;
}

/**
 * Check whether artifacts for a case are eligible for deletion
 * based on retention policy.
 */
export function isEligibleForRetentionDeletion(
  caseClosedAt: Date | null,
  retentionDays: number,
  now: Date = new Date(),
): boolean {
  const retentionDate = calculateRetentionDate(caseClosedAt, retentionDays);
  if (!retentionDate) return false;
  return now >= retentionDate;
}

/**
 * Determine the artifacts that should be deleted/soft-deleted
 * for a case based on retention policy.
 *
 * Returns a list of entity types to clean up.
 */
export function getRetentionDeletionTargets(): string[] {
  return [
    "EvidenceItem",
    "DetectorResult",
    "Finding",
    "CopilotSummary",
    "ExportArtifact",
    "RedactionSuggestion",
  ];
}

// ---------------------------------------------------------------------------
// 9. Data Minimization Helpers
// ---------------------------------------------------------------------------

/**
 * Mask identifiers in a governance log entry to ensure PII minimization.
 * Used when writing DPIA-ready reports or displaying audit data.
 */
export function maskIdentifierForLog(
  identifierType: string,
  identifierValue: string,
): string {
  if (!identifierValue) return "***";

  switch (identifierType) {
    case "EMAIL":
    case "email":
      return maskPII(identifierValue, "EMAIL");
    case "PHONE":
    case "phone":
      return maskPII(identifierValue, "PHONE");
    case "IBAN":
      return maskPII(identifierValue, "IBAN");
    case "EMPLOYEE_ID":
    case "employeeId":
      return maskPII(identifierValue, "EMPLOYEE_ID");
    case "name":
      return maskPII(identifierValue, "NAME");
    default:
      if (identifierValue.includes("@")) {
        return maskPII(identifierValue, "EMAIL");
      }
      return maskPII(identifierValue, "KEYWORD");
  }
}

// ---------------------------------------------------------------------------
// 10. UX Guardrails — Static Messages
// ---------------------------------------------------------------------------

export const UX_MESSAGES = {
  runStartWarning:
    "This action will query connected systems and log the access. All queries are audit-logged and visible to your DPO.",
  runConfirmationLabel:
    "I confirm this is for DSAR processing",
  exportWarning:
    "Export may contain sensitive data. Approval may be required before download.",
  exportReasonRequired:
    "Please select a reason and add a note for this export request.",
  specialCategoryWarning:
    "This run detected Art. 9 special category data. Legal review and explicit approval are required before disclosure.",
  noEvidenceDisclaimer:
    "No evidence does not guarantee absence of data. Only the systems queried were searched.",
} as const;
