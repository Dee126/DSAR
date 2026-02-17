import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Governance Engine
// ---------------------------------------------------------------------------
import {
  enforceCaseBinding,
  enforceSubjectLinked,
  enforceJustification,
  enforceRunPermission,
  enforceContentScanPermission,
  enforceExportPermission,
  enforceSettingsPermission,
  enforceRateLimits,
  checkForAnomalies,
  checkTwoPersonApproval,
  runPreFlightChecks,
  calculateRetentionDate,
  isEligibleForRetentionDeletion,
  getRetentionDeletionTargets,
  maskIdentifierForLog,
  getCopilotRoleScope,
  JUSTIFICATION_TEMPLATES,
  DEFAULT_GOVERNANCE_SETTINGS,
  UX_MESSAGES,
} from "@/lib/copilot/governance";
import type {
  GovernanceSettings,
  RateLimitState,
  AnomalyCheckInput,
  TwoPersonApprovalState,
  CopilotRunRequest,
} from "@/lib/copilot/governance";

// ---------------------------------------------------------------------------
// Governance Settings
// ---------------------------------------------------------------------------
import {
  validateSettingsUpdate,
  computeSettingsChanges,
  applySettingsUpdate,
  canModifySettings,
  getDefaultSettings,
} from "@/lib/copilot/governance-settings";

// ---------------------------------------------------------------------------
// Legal Hold
// ---------------------------------------------------------------------------
import {
  checkLegalHoldForExport,
  checkLegalHoldForDeletion,
  isRetentionSuspended,
  canManageLegalHold as canManageLegalHoldFromService,
  validateLegalHoldEnable,
  validateLegalHoldDisable,
  getLegalHoldBannerText,
} from "@/lib/copilot/legal-hold";

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------
import {
  canReviewRedaction as canReviewRedactionFromService,
  validateRedactionReview,
  generateRedactionSuggestions,
  getRedactionLabel,
} from "@/lib/copilot/redaction";

// ---------------------------------------------------------------------------
// Governance Report
// ---------------------------------------------------------------------------
import {
  canViewGovernanceReport as canViewGovReportFromService,
  canExportGovernanceReport,
  buildReportEntry,
  buildReportSummary,
  exportReportAsCSV,
  exportReportAsJSON,
} from "@/lib/copilot/governance-report";

// ---------------------------------------------------------------------------
// Explainability
// ---------------------------------------------------------------------------
import {
  buildEvidenceBasedResponse,
  validateSummaryExplainability,
  dataFoundResponse,
  noEvidenceFoundResponse,
  MANDATORY_DISCLAIMERS,
} from "@/lib/copilot/explainability";

// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------
import {
  hasPermission,
  checkPermission,
  canManageGovernance,
  canViewGovernanceReport,
  canManageLegalHold,
  canReviewRedaction,
} from "@/lib/rbac";

// =========================================================================
// 1. Case-Only Enforcement
// =========================================================================
describe("Case-Only Enforcement", () => {
  it("should reject when tenantId is missing", () => {
    const result = enforceCaseBinding("case-123", null);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_TENANT_ID");
  });

  it("should reject when tenantId is empty string", () => {
    const result = enforceCaseBinding("case-123", "");
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_TENANT_ID");
  });

  it("should reject when caseId is missing", () => {
    const result = enforceCaseBinding(null, "tenant-123");
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_CASE_ID");
  });

  it("should reject when caseId is empty string", () => {
    const result = enforceCaseBinding("", "tenant-123");
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_CASE_ID");
  });

  it("should allow when both caseId and tenantId are valid", () => {
    const result = enforceCaseBinding("case-123", "tenant-123");
    expect(result.allowed).toBe(true);
  });

  it("should reject when subject is not linked", () => {
    const result = enforceSubjectLinked(false);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("SUBJECT_NOT_LINKED");
  });

  it("should allow when subject is linked", () => {
    const result = enforceSubjectLinked(true);
    expect(result.allowed).toBe(true);
  });
});

// =========================================================================
// 2. Justification Enforcement
// =========================================================================
describe("Justification Enforcement", () => {
  const settings = DEFAULT_GOVERNANCE_SETTINGS;

  it("should reject missing justification", () => {
    const result = enforceJustification(null, settings);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_JUSTIFICATION");
  });

  it("should reject empty justification", () => {
    const result = enforceJustification("", settings);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_JUSTIFICATION");
  });

  it("should reject justification shorter than 10 chars", () => {
    const result = enforceJustification("short", settings);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_JUSTIFICATION");
  });

  it("should allow valid justification", () => {
    const result = enforceJustification(
      "Art. 15 access request for data subject",
      settings,
    );
    expect(result.allowed).toBe(true);
  });

  it("should skip check when requireJustification is false", () => {
    const noJustSettings: GovernanceSettings = {
      ...settings,
      requireJustification: false,
    };
    const result = enforceJustification(null, noJustSettings);
    expect(result.allowed).toBe(true);
  });

  it("should have at least 3 justification templates", () => {
    expect(JUSTIFICATION_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    for (const t of JUSTIFICATION_TEMPLATES) {
      expect(t.id).toBeDefined();
      expect(t.label).toBeDefined();
      expect(t.text.length).toBeGreaterThan(10);
    }
  });
});

// =========================================================================
// 3. Role-based Scope Enforcement
// =========================================================================
describe("Role-based Scope Enforcement", () => {
  it("SUPER_ADMIN can start runs", () => {
    expect(enforceRunPermission("SUPER_ADMIN").allowed).toBe(true);
  });

  it("TENANT_ADMIN can start runs", () => {
    expect(enforceRunPermission("TENANT_ADMIN").allowed).toBe(true);
  });

  it("DPO can start runs", () => {
    expect(enforceRunPermission("DPO").allowed).toBe(true);
  });

  it("CASE_MANAGER can start runs", () => {
    expect(enforceRunPermission("CASE_MANAGER").allowed).toBe(true);
  });

  it("CONTRIBUTOR cannot start runs", () => {
    const result = enforceRunPermission("CONTRIBUTOR");
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("ROLE_FORBIDDEN");
  });

  it("READ_ONLY cannot start runs", () => {
    const result = enforceRunPermission("READ_ONLY");
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("ROLE_FORBIDDEN");
  });

  describe("Content scan permissions", () => {
    const settings = DEFAULT_GOVERNANCE_SETTINGS;
    const enabledSettings: GovernanceSettings = {
      ...settings,
      allowContentScanning: true,
    };

    it("CASE_MANAGER cannot request content scanning", () => {
      const result = enforceContentScanPermission("CASE_MANAGER", true, enabledSettings);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("CONTENT_SCAN_FORBIDDEN");
    });

    it("DPO can request content scanning when enabled", () => {
      const result = enforceContentScanPermission("DPO", true, enabledSettings);
      expect(result.allowed).toBe(true);
    });

    it("DPO cannot content scan when globally disabled", () => {
      const result = enforceContentScanPermission("DPO", true, settings);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("CONTENT_SCAN_DISABLED");
    });

    it("no check needed when content scan not requested", () => {
      const result = enforceContentScanPermission("READ_ONLY", false, settings);
      expect(result.allowed).toBe(true);
    });
  });

  describe("Export permissions", () => {
    it("CASE_MANAGER can request exports", () => {
      expect(enforceExportPermission("CASE_MANAGER").allowed).toBe(true);
    });

    it("CONTRIBUTOR cannot request exports", () => {
      expect(enforceExportPermission("CONTRIBUTOR").allowed).toBe(false);
    });
  });

  describe("Settings permissions", () => {
    it("DPO can change settings", () => {
      expect(enforceSettingsPermission("DPO").allowed).toBe(true);
    });

    it("CASE_MANAGER cannot change settings", () => {
      expect(enforceSettingsPermission("CASE_MANAGER").allowed).toBe(false);
    });
  });

  describe("Role scope object", () => {
    it("CONTRIBUTOR is metadata-only", () => {
      const scope = getCopilotRoleScope("CONTRIBUTOR");
      expect(scope.metadataOnly).toBe(true);
      expect(scope.canStartRun).toBe(false);
    });

    it("DPO has full scope", () => {
      const scope = getCopilotRoleScope("DPO");
      expect(scope.canStartRun).toBe(true);
      expect(scope.canApproveArt9).toBe(true);
      expect(scope.canChangeSettings).toBe(true);
      expect(scope.canViewGovernanceReport).toBe(true);
    });
  });
});

// =========================================================================
// 4. Rate Limiting
// =========================================================================
describe("Rate Limiting", () => {
  const settings = DEFAULT_GOVERNANCE_SETTINGS;

  it("should allow when within limits", () => {
    const state: RateLimitState = {
      tenantRunsToday: 5,
      userRunsToday: 2,
      concurrentRuns: 0,
    };
    expect(enforceRateLimits(state, settings).allowed).toBe(true);
  });

  it("should reject when tenant daily limit reached", () => {
    const state: RateLimitState = {
      tenantRunsToday: 100,
      userRunsToday: 2,
      concurrentRuns: 0,
    };
    const result = enforceRateLimits(state, settings);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("TENANT_DAILY_LIMIT");
  });

  it("should reject when user daily limit reached", () => {
    const state: RateLimitState = {
      tenantRunsToday: 5,
      userRunsToday: 20,
      concurrentRuns: 0,
    };
    const result = enforceRateLimits(state, settings);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("USER_DAILY_LIMIT");
  });

  it("should reject when concurrency limit reached", () => {
    const state: RateLimitState = {
      tenantRunsToday: 5,
      userRunsToday: 2,
      concurrentRuns: 3,
    };
    const result = enforceRateLimits(state, settings);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("CONCURRENCY_LIMIT");
  });
});

// =========================================================================
// 5. Anomaly Detection (Break-Glass)
// =========================================================================
describe("Anomaly Detection", () => {
  it("should detect many runs in short time", () => {
    const input: AnomalyCheckInput = {
      userId: "user-1",
      tenantId: "tenant-1",
      runsInLastHour: 15,
      distinctSubjectsInLastHour: 1,
      permissionDeniedInLastHour: 0,
    };
    const result = checkForAnomalies(input);
    expect(result.isAnomaly).toBe(true);
    expect(result.eventType).toBe("ANOMALY_MANY_RUNS");
  });

  it("should detect many distinct subjects searched", () => {
    const input: AnomalyCheckInput = {
      userId: "user-1",
      tenantId: "tenant-1",
      runsInLastHour: 3,
      distinctSubjectsInLastHour: 8,
      permissionDeniedInLastHour: 0,
    };
    const result = checkForAnomalies(input);
    expect(result.isAnomaly).toBe(true);
    expect(result.eventType).toBe("ANOMALY_MANY_SUBJECTS");
  });

  it("should detect repeated permission denied", () => {
    const input: AnomalyCheckInput = {
      userId: "user-1",
      tenantId: "tenant-1",
      runsInLastHour: 2,
      distinctSubjectsInLastHour: 1,
      permissionDeniedInLastHour: 7,
    };
    const result = checkForAnomalies(input);
    expect(result.isAnomaly).toBe(true);
    expect(result.eventType).toBe("ANOMALY_PERMISSION_DENIED");
  });

  it("should not flag normal usage", () => {
    const input: AnomalyCheckInput = {
      userId: "user-1",
      tenantId: "tenant-1",
      runsInLastHour: 3,
      distinctSubjectsInLastHour: 2,
      permissionDeniedInLastHour: 0,
    };
    expect(checkForAnomalies(input).isAnomaly).toBe(false);
  });
});

// =========================================================================
// 6. Two-Person Export Approval
// =========================================================================
describe("Two-Person Export Approval", () => {
  const twoPersonSettings: GovernanceSettings = {
    ...DEFAULT_GOVERNANCE_SETTINGS,
    twoPersonApprovalForExport: true,
  };

  it("should skip when two-person approval is disabled", () => {
    const state: TwoPersonApprovalState = { approvals: [] };
    expect(
      checkTwoPersonApproval(state, "user-1", DEFAULT_GOVERNANCE_SETTINGS).allowed,
    ).toBe(true);
  });

  it("should reject with 0 approvals", () => {
    const state: TwoPersonApprovalState = { approvals: [] };
    const result = checkTwoPersonApproval(state, "user-1", twoPersonSettings);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("TWO_PERSON_APPROVAL_REQUIRED");
  });

  it("should reject with only 1 approval", () => {
    const state: TwoPersonApprovalState = {
      approvals: [{ userId: "user-2", role: "DPO", approved: true }],
    };
    const result = checkTwoPersonApproval(state, "user-1", twoPersonSettings);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("TWO_PERSON_APPROVAL_REQUIRED");
  });

  it("should reject when requester is one of the approvers", () => {
    const state: TwoPersonApprovalState = {
      approvals: [
        { userId: "user-1", role: "DPO", approved: true },
        { userId: "user-2", role: "TENANT_ADMIN", approved: true },
      ],
    };
    const result = checkTwoPersonApproval(state, "user-1", twoPersonSettings);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("TWO_PERSON_APPROVAL_REQUIRED");
  });

  it("should reject when no qualified approver (no DPO/Admin)", () => {
    const state: TwoPersonApprovalState = {
      approvals: [
        { userId: "user-2", role: "CASE_MANAGER", approved: true },
        { userId: "user-3", role: "CASE_MANAGER", approved: true },
      ],
    };
    const result = checkTwoPersonApproval(state, "user-1", twoPersonSettings);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("TWO_PERSON_APPROVAL_REQUIRES_DPO");
  });

  it("should allow with 2 valid approvals including a DPO", () => {
    const state: TwoPersonApprovalState = {
      approvals: [
        { userId: "user-2", role: "DPO", approved: true },
        { userId: "user-3", role: "CASE_MANAGER", approved: true },
      ],
    };
    const result = checkTwoPersonApproval(state, "user-1", twoPersonSettings);
    expect(result.allowed).toBe(true);
  });
});

// =========================================================================
// 7. Full Pre-Flight Checks
// =========================================================================
describe("Pre-Flight Governance Checks", () => {
  const settings = DEFAULT_GOVERNANCE_SETTINGS;
  const okState: RateLimitState = {
    tenantRunsToday: 0,
    userRunsToday: 0,
    concurrentRuns: 0,
  };

  it("should reject when copilot is disabled", () => {
    const disabledSettings: GovernanceSettings = {
      ...settings,
      copilotEnabled: false,
    };
    const request: CopilotRunRequest = {
      tenantId: "t1",
      caseId: "c1",
      userId: "u1",
      userRole: "DPO",
      justification: "Art. 15 access request",
    };
    const result = runPreFlightChecks(request, disabledSettings, okState, true);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("COPILOT_DISABLED");
  });

  it("should reject without caseId", () => {
    const request: CopilotRunRequest = {
      tenantId: "t1",
      caseId: "",
      userId: "u1",
      userRole: "DPO",
      justification: "Art. 15 access request",
    };
    const result = runPreFlightChecks(request, settings, okState, true);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_CASE_ID");
  });

  it("should reject without justification", () => {
    const request: CopilotRunRequest = {
      tenantId: "t1",
      caseId: "c1",
      userId: "u1",
      userRole: "DPO",
      justification: "",
    };
    const result = runPreFlightChecks(request, settings, okState, true);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_JUSTIFICATION");
  });

  it("should reject when subject not linked", () => {
    const request: CopilotRunRequest = {
      tenantId: "t1",
      caseId: "c1",
      userId: "u1",
      userRole: "DPO",
      justification: "Art. 15 access request",
    };
    const result = runPreFlightChecks(request, settings, okState, false);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("SUBJECT_NOT_LINKED");
  });

  it("should allow a valid DPO request", () => {
    const request: CopilotRunRequest = {
      tenantId: "t1",
      caseId: "c1",
      userId: "u1",
      userRole: "DPO",
      justification: "Art. 15 access request",
    };
    const result = runPreFlightChecks(request, settings, okState, true);
    expect(result.allowed).toBe(true);
  });

  it("should reject CONTRIBUTOR from starting a run", () => {
    const request: CopilotRunRequest = {
      tenantId: "t1",
      caseId: "c1",
      userId: "u1",
      userRole: "CONTRIBUTOR",
      justification: "Art. 15 access request",
    };
    const result = runPreFlightChecks(request, settings, okState, true);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("ROLE_FORBIDDEN");
  });
});

// =========================================================================
// 8. Retention / Artifact Lifecycle
// =========================================================================
describe("Retention / Artifact Lifecycle", () => {
  it("should calculate retention date from case closure + days", () => {
    const closedAt = new Date("2025-01-01");
    const retentionDate = calculateRetentionDate(closedAt, 90);
    expect(retentionDate).not.toBeNull();
    expect(retentionDate!.getTime()).toBe(
      new Date("2025-04-01").getTime(),
    );
  });

  it("should return null when case is not closed", () => {
    expect(calculateRetentionDate(null, 90)).toBeNull();
  });

  it("should mark eligible when past retention date", () => {
    const closedAt = new Date("2024-01-01");
    const now = new Date("2025-01-01");
    expect(isEligibleForRetentionDeletion(closedAt, 90, now)).toBe(true);
  });

  it("should not be eligible when within retention period", () => {
    const closedAt = new Date("2025-01-01");
    const now = new Date("2025-02-01"); // Only 31 days
    expect(isEligibleForRetentionDeletion(closedAt, 90, now)).toBe(false);
  });

  it("should not be eligible when case is still open", () => {
    expect(isEligibleForRetentionDeletion(null, 90)).toBe(false);
  });

  it("should list all artifact types for deletion", () => {
    const targets = getRetentionDeletionTargets();
    expect(targets).toContain("EvidenceItem");
    expect(targets).toContain("DetectorResult");
    expect(targets).toContain("Finding");
    expect(targets).toContain("CopilotSummary");
    expect(targets).toContain("ExportArtifact");
    expect(targets).toContain("RedactionSuggestion");
  });
});

// =========================================================================
// 9. Governance Settings
// =========================================================================
describe("Governance Settings", () => {
  describe("Validation", () => {
    it("should accept valid update", () => {
      expect(
        validateSettingsUpdate({ maxRunsPerDayTenant: 50 }),
      ).toBeNull();
    });

    it("should reject invalid execution mode", () => {
      expect(
        validateSettingsUpdate({ defaultExecutionMode: "INVALID" }),
      ).not.toBeNull();
    });

    it("should reject invalid provider phase", () => {
      expect(
        validateSettingsUpdate({ allowedProviderPhases: [99] }),
      ).not.toBeNull();
    });

    it("should reject out-of-range maxRunsPerDayTenant", () => {
      expect(
        validateSettingsUpdate({ maxRunsPerDayTenant: 0 }),
      ).not.toBeNull();
      expect(
        validateSettingsUpdate({ maxRunsPerDayTenant: 99999 }),
      ).not.toBeNull();
    });

    it("should reject out-of-range artifactRetentionDays", () => {
      expect(
        validateSettingsUpdate({ artifactRetentionDays: 0 }),
      ).not.toBeNull();
    });
  });

  describe("Change computation", () => {
    it("should detect changed fields", () => {
      const current = getDefaultSettings();
      const changes = computeSettingsChanges(current, {
        maxRunsPerDayTenant: 50,
        allowContentScanning: true,
      });
      expect(changes.length).toBe(2);
      const fieldNames = changes.map((c) => c.field);
      expect(fieldNames).toContain("maxRunsPerDayTenant");
      expect(fieldNames).toContain("allowContentScanning");
    });

    it("should not report unchanged fields", () => {
      const current = getDefaultSettings();
      const changes = computeSettingsChanges(current, {
        copilotEnabled: true, // Same as default
      });
      expect(changes.length).toBe(0);
    });
  });

  describe("Apply update", () => {
    it("should merge update into current settings", () => {
      const current = getDefaultSettings();
      const updated = applySettingsUpdate(current, {
        maxRunsPerDayTenant: 50,
        allowContentScanning: true,
      });
      expect(updated.maxRunsPerDayTenant).toBe(50);
      expect(updated.allowContentScanning).toBe(true);
      expect(updated.copilotEnabled).toBe(true); // Unchanged
    });
  });

  describe("RBAC for settings", () => {
    it("DPO can modify settings", () => {
      expect(canModifySettings("DPO")).toBe(true);
    });

    it("TENANT_ADMIN can modify settings", () => {
      expect(canModifySettings("TENANT_ADMIN")).toBe(true);
    });

    it("CASE_MANAGER cannot modify settings", () => {
      expect(canModifySettings("CASE_MANAGER")).toBe(false);
    });

    it("CONTRIBUTOR cannot modify settings", () => {
      expect(canModifySettings("CONTRIBUTOR")).toBe(false);
    });
  });
});

// =========================================================================
// 10. Legal Hold
// =========================================================================
describe("Legal Hold", () => {
  const activeHold = {
    enabled: true,
    reason: "Litigation pending",
    enabledAt: new Date(),
    enabledByUserId: "u-dpo",
  };

  const inactiveHold = { enabled: false };

  it("should block export when Legal Hold is active", () => {
    const result = checkLegalHoldForExport(activeHold);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("LEGAL_HOLD_EXPORT_BLOCKED");
  });

  it("should allow export when Legal Hold is inactive", () => {
    expect(checkLegalHoldForExport(inactiveHold).allowed).toBe(true);
  });

  it("should block deletion when Legal Hold is active", () => {
    const result = checkLegalHoldForDeletion(activeHold);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("LEGAL_HOLD_DELETION_BLOCKED");
  });

  it("should allow deletion when Legal Hold is inactive", () => {
    expect(checkLegalHoldForDeletion(inactiveHold).allowed).toBe(true);
  });

  it("should suspend retention when Legal Hold is active", () => {
    expect(isRetentionSuspended(activeHold)).toBe(true);
  });

  it("should not suspend retention when Legal Hold is inactive", () => {
    expect(isRetentionSuspended(inactiveHold)).toBe(false);
  });

  describe("Role checks", () => {
    it("DPO can manage Legal Hold", () => {
      expect(canManageLegalHoldFromService("DPO")).toBe(true);
    });

    it("TENANT_ADMIN can manage Legal Hold", () => {
      expect(canManageLegalHoldFromService("TENANT_ADMIN")).toBe(true);
    });

    it("CASE_MANAGER cannot manage Legal Hold", () => {
      expect(canManageLegalHoldFromService("CASE_MANAGER")).toBe(false);
    });
  });

  describe("Enable validation", () => {
    it("should require a reason", () => {
      const result = validateLegalHoldEnable("DPO", "");
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("LEGAL_HOLD_REASON_REQUIRED");
    });

    it("should reject short reason", () => {
      const result = validateLegalHoldEnable("DPO", "abc");
      expect(result.allowed).toBe(false);
    });

    it("should reject unauthorized role", () => {
      const result = validateLegalHoldEnable("CONTRIBUTOR", "Litigation pending investigation");
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("LEGAL_HOLD_ROLE_FORBIDDEN");
    });

    it("should allow DPO with valid reason", () => {
      const result = validateLegalHoldEnable("DPO", "Litigation pending investigation");
      expect(result.allowed).toBe(true);
    });
  });

  describe("Disable validation", () => {
    it("should allow DPO to disable", () => {
      expect(validateLegalHoldDisable("DPO").allowed).toBe(true);
    });

    it("should reject CASE_MANAGER from disabling", () => {
      expect(validateLegalHoldDisable("CASE_MANAGER").allowed).toBe(false);
    });
  });

  describe("UI banner", () => {
    it("should return banner text when hold is active", () => {
      const text = getLegalHoldBannerText(activeHold);
      expect(text).not.toBeNull();
      expect(text).toContain("LEGAL HOLD");
    });

    it("should return null when hold is inactive", () => {
      expect(getLegalHoldBannerText(inactiveHold)).toBeNull();
    });
  });
});

// =========================================================================
// 11. Redaction Suggestions
// =========================================================================
describe("Redaction Suggestions", () => {
  describe("Review permissions", () => {
    it("DPO can review redactions", () => {
      expect(canReviewRedactionFromService("DPO")).toBe(true);
    });

    it("TENANT_ADMIN can review redactions", () => {
      expect(canReviewRedactionFromService("TENANT_ADMIN")).toBe(true);
    });

    it("CASE_MANAGER cannot review redactions", () => {
      expect(canReviewRedactionFromService("CASE_MANAGER")).toBe(false);
    });
  });

  describe("Review validation", () => {
    it("should reject unauthorized reviewer", () => {
      const result = validateRedactionReview({
        suggestionId: "s1",
        status: "APPROVED",
        reviewerUserId: "u1",
        reviewerRole: "CASE_MANAGER",
      });
      expect(result.allowed).toBe(false);
    });

    it("should allow DPO reviewer", () => {
      const result = validateRedactionReview({
        suggestionId: "s1",
        status: "APPROVED",
        reviewerUserId: "u1",
        reviewerRole: "DPO",
      });
      expect(result.allowed).toBe(true);
    });

    it("should reject invalid status", () => {
      const result = validateRedactionReview({
        suggestionId: "s1",
        status: "INVALID" as any,
        reviewerUserId: "u1",
        reviewerRole: "DPO",
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe("Suggestion generation", () => {
    it("should generate suggestions from detected elements", () => {
      const elements = [
        {
          elementType: "EMAIL_ADDRESS",
          snippetPreview: "t***@example.com",
          confidence: 0.85,
          confidenceLevel: "HIGH",
        },
        {
          elementType: "IBAN_DE",
          snippetPreview: "DE****3000",
          confidence: 0.95,
          confidenceLevel: "HIGH",
        },
      ];

      const suggestions = generateRedactionSuggestions(elements, "ev-001");
      expect(suggestions.length).toBe(2);
      expect(suggestions[0].elementType).toBe("EMAIL_ADDRESS");
      expect(suggestions[0].suggestedRedaction).toBe("[REDACTED EMAIL]");
      expect(suggestions[0].evidenceItemId).toBe("ev-001");
      expect(suggestions[1].suggestedRedaction).toBe("[REDACTED IBAN]");
    });

    it("should skip elements without snippet preview", () => {
      const elements = [
        {
          elementType: "EMAIL_ADDRESS",
          snippetPreview: null,
          confidence: 0.85,
          confidenceLevel: "HIGH",
        },
      ];
      const suggestions = generateRedactionSuggestions(elements);
      expect(suggestions.length).toBe(0);
    });

    it("should generate Art. 9 redaction label", () => {
      expect(getRedactionLabel("ART9_HEALTH_DATA")).toBe(
        "[REDACTED SPECIAL CATEGORY DATA]",
      );
    });

    it("should generate default redaction label for unknown types", () => {
      expect(getRedactionLabel("UNKNOWN_TYPE")).toBe("[REDACTED]");
    });
  });
});

// =========================================================================
// 12. Governance Report (DPIA-ready)
// =========================================================================
describe("Governance Report", () => {
  describe("Role checks", () => {
    it("DPO can view governance report", () => {
      expect(canViewGovReportFromService("DPO")).toBe(true);
    });

    it("CASE_MANAGER cannot view governance report", () => {
      expect(canViewGovReportFromService("CASE_MANAGER")).toBe(false);
    });

    it("DPO can export governance report", () => {
      expect(canExportGovernanceReport("DPO")).toBe(true);
    });
  });

  describe("Report entry building", () => {
    it("should mask subject identifier in report entries", () => {
      const entry = buildReportEntry({
        runId: "r1",
        caseId: "c1",
        caseNumber: "DSAR-2025-001",
        actorUserId: "u1",
        actorName: "Max DPO",
        actorRole: "DPO",
        startedAt: new Date("2025-01-01T10:00:00Z"),
        completedAt: new Date("2025-01-01T10:05:00Z"),
        status: "COMPLETED",
        justification: "Art. 15 request",
        subjectIdentifierType: "EMAIL",
        subjectIdentifierValue: "max@example.com",
        systemsSearched: ["EXCHANGE_ONLINE", "SHAREPOINT"],
        contentScanningUsed: false,
        ocrUsed: false,
        art9Suspected: true,
        specialCategories: ["HEALTH"],
        totalFindings: 3,
        totalEvidenceItems: 5,
        exportGenerated: true,
        exportApprovedBy: "u2",
        legalApprovalStatus: "APPROVED",
      });

      // Subject identifier must be masked
      expect(entry.subjectIdentifier).not.toBe("max@example.com");
      expect(entry.subjectIdentifier).toContain("@example.com");
      expect(entry.subjectIdentifier).toContain("*");

      // Other fields preserved
      expect(entry.caseNumber).toBe("DSAR-2025-001");
      expect(entry.art9Suspected).toBe(true);
      expect(entry.systemsSearched).toContain("EXCHANGE_ONLINE");
    });
  });

  describe("Report summary", () => {
    it("should compute correct summary stats", () => {
      const entries = [
        buildReportEntry({
          runId: "r1", caseId: "c1", caseNumber: "D-001",
          actorUserId: "u1", actorName: "A", actorRole: "DPO",
          startedAt: new Date(), completedAt: new Date(), status: "COMPLETED",
          justification: "j1", subjectIdentifierType: "EMAIL",
          subjectIdentifierValue: "a@b.com", systemsSearched: ["S1"],
          contentScanningUsed: false, ocrUsed: false, art9Suspected: true,
          specialCategories: ["HEALTH"], totalFindings: 2, totalEvidenceItems: 3,
          exportGenerated: true, exportApprovedBy: "u2", legalApprovalStatus: "APPROVED",
        }),
        buildReportEntry({
          runId: "r2", caseId: "c2", caseNumber: "D-002",
          actorUserId: "u2", actorName: "B", actorRole: "CASE_MANAGER",
          startedAt: new Date(), completedAt: new Date(), status: "FAILED",
          justification: "j2", subjectIdentifierType: "EMAIL",
          subjectIdentifierValue: "c@d.com", systemsSearched: ["S2"],
          contentScanningUsed: false, ocrUsed: false, art9Suspected: false,
          specialCategories: [], totalFindings: 0, totalEvidenceItems: 0,
          exportGenerated: false, exportApprovedBy: null, legalApprovalStatus: "NOT_REQUIRED",
        }),
      ];

      const summary = buildReportSummary(
        entries,
        new Date("2025-01-01"),
        new Date("2025-01-31"),
      );

      expect(summary.totalRuns).toBe(2);
      expect(summary.completedRuns).toBe(1);
      expect(summary.failedRuns).toBe(1);
      expect(summary.art9DetectedRuns).toBe(1);
      expect(summary.totalExports).toBe(1);
      expect(summary.uniqueUsers).toBe(2);
      expect(summary.uniqueCases).toBe(2);
    });
  });

  describe("CSV export", () => {
    it("should generate valid CSV with header", () => {
      const entry = buildReportEntry({
        runId: "r1", caseId: "c1", caseNumber: "D-001",
        actorUserId: "u1", actorName: "A", actorRole: "DPO",
        startedAt: new Date(), completedAt: new Date(), status: "COMPLETED",
        justification: "j1", subjectIdentifierType: "EMAIL",
        subjectIdentifierValue: "a@b.com", systemsSearched: ["S1"],
        contentScanningUsed: false, ocrUsed: false, art9Suspected: false,
        specialCategories: [], totalFindings: 1, totalEvidenceItems: 2,
        exportGenerated: false, exportApprovedBy: null, legalApprovalStatus: "NOT_REQUIRED",
      });

      const csv = exportReportAsCSV([entry]);
      const lines = csv.split("\n");
      expect(lines.length).toBe(2); // header + 1 row
      expect(lines[0]).toContain("RunId");
      expect(lines[0]).toContain("Justification");
      expect(lines[0]).toContain("SubjectIdentifier");
      expect(lines[1]).toContain("r1");
    });
  });

  describe("JSON export", () => {
    it("should generate valid JSON structure", () => {
      const entry = buildReportEntry({
        runId: "r1", caseId: "c1", caseNumber: "D-001",
        actorUserId: "u1", actorName: "A", actorRole: "DPO",
        startedAt: new Date(), completedAt: new Date(), status: "COMPLETED",
        justification: "j1", subjectIdentifierType: "EMAIL",
        subjectIdentifierValue: "a@b.com", systemsSearched: ["S1"],
        contentScanningUsed: false, ocrUsed: false, art9Suspected: false,
        specialCategories: [], totalFindings: 1, totalEvidenceItems: 2,
        exportGenerated: false, exportApprovedBy: null, legalApprovalStatus: "NOT_REQUIRED",
      });

      const summary = buildReportSummary(
        [entry],
        new Date("2025-01-01"),
        new Date("2025-01-31"),
      );

      const json = exportReportAsJSON([entry], summary);
      const parsed = JSON.parse(json);
      expect(parsed.meta.reportType).toBe("COPILOT_GOVERNANCE_DPIA");
      expect(parsed.summary.totalRuns).toBe(1);
      expect(parsed.entries.length).toBe(1);
    });
  });
});

// =========================================================================
// 13. Explainability / Non-Hallucination Controls
// =========================================================================
describe("Explainability / Non-Hallucination Controls", () => {
  describe("Evidence-based response", () => {
    it("should include system attribution when evidence found", () => {
      const response = buildEvidenceBasedResponse({
        systemsSearched: ["EXCHANGE_ONLINE", "SHAREPOINT"],
        evidenceCount: 5,
        findingCount: 3,
        containsSpecialCategory: false,
        contentScanningUsed: false,
      });

      expect(response.content).toContain("EXCHANGE_ONLINE");
      expect(response.content).toContain("SHAREPOINT");
      expect(response.content).toContain("Found evidence");
      expect(response.basedOnSystems).toContain("EXCHANGE_ONLINE");
      expect(response.evidenceBased).toBe(true);
    });

    it("should use 'no evidence found' when nothing found", () => {
      const response = buildEvidenceBasedResponse({
        systemsSearched: ["EXCHANGE_ONLINE"],
        evidenceCount: 0,
        findingCount: 0,
        containsSpecialCategory: false,
        contentScanningUsed: false,
      });

      expect(response.content).toContain("No evidence found");
      expect(response.evidenceBased).toBe(false);
      expect(response.disclaimers.some((d) =>
        d.includes("does not guarantee"),
      )).toBe(true);
    });

    it("should include special category warning when detected", () => {
      const response = buildEvidenceBasedResponse({
        systemsSearched: ["WORKDAY"],
        evidenceCount: 2,
        findingCount: 1,
        containsSpecialCategory: true,
        contentScanningUsed: false,
      });

      expect(response.content).toContain("Art. 9");
      expect(response.disclaimers.some((d) =>
        d.includes("special category"),
      )).toBe(true);
    });

    it("should include content scan note when used", () => {
      const response = buildEvidenceBasedResponse({
        systemsSearched: ["EXCHANGE_ONLINE"],
        evidenceCount: 3,
        findingCount: 2,
        containsSpecialCategory: false,
        contentScanningUsed: true,
      });

      expect(response.disclaimers.some((d) =>
        d.includes("Content scanning was used"),
      )).toBe(true);
    });

    it("should include metadata-only note when not using content scan", () => {
      const response = buildEvidenceBasedResponse({
        systemsSearched: ["EXCHANGE_ONLINE"],
        evidenceCount: 1,
        findingCount: 1,
        containsSpecialCategory: false,
        contentScanningUsed: false,
      });

      expect(response.disclaimers.some((d) =>
        d.includes("metadata-only"),
      )).toBe(true);
    });
  });

  describe("Summary validation", () => {
    it("should pass for a valid summary", () => {
      const summary =
        "Based on evidence from EXCHANGE_ONLINE.\n" +
        "Disclaimer: This does not guarantee completeness.";
      const missing = validateSummaryExplainability(summary, {
        systemsSearched: ["EXCHANGE_ONLINE"],
        evidenceCount: 1,
        findingCount: 1,
        containsSpecialCategory: false,
        contentScanningUsed: false,
      });
      expect(missing.length).toBe(0);
    });

    it("should flag missing system reference", () => {
      const summary = "Some findings were detected.\nDisclaimer: This does not constitute advice.";
      const missing = validateSummaryExplainability(summary, {
        systemsSearched: ["EXCHANGE_ONLINE"],
        evidenceCount: 1,
        findingCount: 1,
        containsSpecialCategory: false,
        contentScanningUsed: false,
      });
      expect(missing.some((m) => m.includes("systems searched"))).toBe(true);
    });

    it("should flag absolute absence statements", () => {
      const summary =
        "Based on EXCHANGE_ONLINE.\n" +
        "No data exists for this person.\n" +
        "Disclaimer: This does not guarantee absence.";
      const missing = validateSummaryExplainability(summary, {
        systemsSearched: ["EXCHANGE_ONLINE"],
        evidenceCount: 0,
        findingCount: 0,
        containsSpecialCategory: false,
        contentScanningUsed: false,
      });
      expect(missing.some((m) => m.includes("absolute absence"))).toBe(true);
    });
  });

  describe("Template responses", () => {
    it("dataFoundResponse should mention systems and findings", () => {
      const response = dataFoundResponse(["EXCHANGE_ONLINE", "SHAREPOINT"], 3, 5);
      expect(response).toContain("EXCHANGE_ONLINE");
      expect(response).toContain("5 finding(s)");
      expect(response).toContain("3 data categories");
    });

    it("noEvidenceFoundResponse should NOT say 'no data exists'", () => {
      const response = noEvidenceFoundResponse(["EXCHANGE_ONLINE"]);
      expect(response).toContain("No evidence found");
      expect(response).toContain("does not guarantee");
      expect(response).not.toContain("no data exists");
    });
  });

  describe("Mandatory disclaimers exist", () => {
    it("should have all required disclaimers defined", () => {
      expect(MANDATORY_DISCLAIMERS.baseDisclaimer.length).toBeGreaterThan(10);
      expect(MANDATORY_DISCLAIMERS.noAbsoluteAbsence.length).toBeGreaterThan(10);
      expect(MANDATORY_DISCLAIMERS.specialCategoryWarning.length).toBeGreaterThan(10);
      expect(MANDATORY_DISCLAIMERS.contentScanNote.length).toBeGreaterThan(10);
      expect(MANDATORY_DISCLAIMERS.metadataOnlyNote.length).toBeGreaterThan(10);
    });
  });
});

// =========================================================================
// 14. RBAC Governance Permissions
// =========================================================================
describe("RBAC Governance Permissions", () => {
  describe("copilot_governance resource", () => {
    it("SUPER_ADMIN can manage copilot_governance", () => {
      expect(hasPermission("SUPER_ADMIN", "copilot_governance", "manage")).toBe(true);
    });

    it("DPO can manage copilot_governance", () => {
      expect(hasPermission("DPO", "copilot_governance", "manage")).toBe(true);
    });

    it("CASE_MANAGER can only read copilot_governance", () => {
      expect(hasPermission("CASE_MANAGER", "copilot_governance", "read")).toBe(true);
      expect(hasPermission("CASE_MANAGER", "copilot_governance", "manage")).toBe(false);
    });

    it("CONTRIBUTOR cannot access copilot_governance", () => {
      expect(hasPermission("CONTRIBUTOR", "copilot_governance", "read")).toBe(false);
    });
  });

  describe("legal_hold resource", () => {
    it("DPO can create legal_hold", () => {
      expect(hasPermission("DPO", "legal_hold", "create")).toBe(true);
    });

    it("CASE_MANAGER can only read legal_hold", () => {
      expect(hasPermission("CASE_MANAGER", "legal_hold", "read")).toBe(true);
      expect(hasPermission("CASE_MANAGER", "legal_hold", "create")).toBe(false);
    });

    it("CONTRIBUTOR cannot access legal_hold", () => {
      expect(hasPermission("CONTRIBUTOR", "legal_hold", "read")).toBe(false);
    });
  });

  describe("redaction resource", () => {
    it("DPO can update (review) redactions", () => {
      expect(hasPermission("DPO", "redaction", "update")).toBe(true);
    });

    it("CASE_MANAGER can only read redactions", () => {
      expect(hasPermission("CASE_MANAGER", "redaction", "read")).toBe(true);
      expect(hasPermission("CASE_MANAGER", "redaction", "update")).toBe(false);
    });
  });

  describe("governance_report resource", () => {
    it("DPO can read governance_report", () => {
      expect(hasPermission("DPO", "governance_report", "read")).toBe(true);
    });

    it("CASE_MANAGER cannot read governance_report", () => {
      expect(hasPermission("CASE_MANAGER", "governance_report", "read")).toBe(false);
    });

    it("READ_ONLY cannot read governance_report", () => {
      expect(hasPermission("READ_ONLY", "governance_report", "read")).toBe(false);
    });
  });

  describe("Helper functions", () => {
    it("canManageGovernance works correctly", () => {
      expect(canManageGovernance("SUPER_ADMIN")).toBe(true);
      expect(canManageGovernance("DPO")).toBe(true);
      expect(canManageGovernance("CASE_MANAGER")).toBe(false);
    });

    it("canViewGovernanceReport works correctly", () => {
      expect(canViewGovernanceReport("DPO")).toBe(true);
      expect(canViewGovernanceReport("CASE_MANAGER")).toBe(false);
    });

    it("canManageLegalHold works correctly", () => {
      expect(canManageLegalHold("DPO")).toBe(true);
      expect(canManageLegalHold("CASE_MANAGER")).toBe(false);
    });

    it("canReviewRedaction works correctly", () => {
      expect(canReviewRedaction("DPO")).toBe(true);
      expect(canReviewRedaction("CASE_MANAGER")).toBe(false);
    });
  });
});

// =========================================================================
// 15. Data Minimization / Identifier Masking
// =========================================================================
describe("Data Minimization (Identifier Masking for Logs)", () => {
  it("should mask email identifiers", () => {
    const masked = maskIdentifierForLog("EMAIL", "max@example.com");
    expect(masked).toContain("@example.com");
    expect(masked).toContain("*");
    expect(masked).not.toBe("max@example.com");
  });

  it("should mask phone identifiers", () => {
    const masked = maskIdentifierForLog("PHONE", "+49 170 1234567");
    expect(masked).toContain("*");
  });

  it("should mask name identifiers", () => {
    const masked = maskIdentifierForLog("name", "Max Mustermann");
    expect(masked).not.toBe("Max Mustermann");
  });

  it("should mask IBAN identifiers", () => {
    const masked = maskIdentifierForLog("IBAN", "DE89370400440532013000");
    expect(masked).toContain("*");
    expect(masked.startsWith("DE")).toBe(true);
  });

  it("should handle empty values", () => {
    expect(maskIdentifierForLog("EMAIL", "")).toBe("***");
  });

  it("should auto-detect email-like values", () => {
    const masked = maskIdentifierForLog("unknown", "test@example.com");
    expect(masked).toContain("@example.com");
    expect(masked).toContain("*");
  });
});

// =========================================================================
// 16. UX Guardrail Messages
// =========================================================================
describe("UX Guardrail Messages", () => {
  it("should have run start warning", () => {
    expect(UX_MESSAGES.runStartWarning).toContain("query connected systems");
    expect(UX_MESSAGES.runStartWarning).toContain("audit-logged");
  });

  it("should have run confirmation label", () => {
    expect(UX_MESSAGES.runConfirmationLabel).toContain("DSAR processing");
  });

  it("should have export warning", () => {
    expect(UX_MESSAGES.exportWarning).toContain("sensitive data");
  });

  it("should have no-evidence disclaimer", () => {
    expect(UX_MESSAGES.noEvidenceDisclaimer).toContain("does not guarantee");
  });
});
