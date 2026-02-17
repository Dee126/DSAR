import { describe, it, expect, beforeEach } from "vitest";

/**
 * Governance Center Tests — API routes, approval flow, settings management,
 * activity log, report export, CopilotRun dialog, and end-to-end governance
 * enforcement.
 */

// ---------------------------------------------------------------------------
// Core governance imports
// ---------------------------------------------------------------------------
import {
  enforceCaseBinding,
  enforceJustification,
  enforceRunPermission,
  enforceContentScanPermission,
  enforceExportPermission,
  enforceSettingsPermission,
  enforceRateLimits,
  checkForAnomalies,
  checkTwoPersonApproval,
  runPreFlightChecks,
  maskIdentifierForLog,
  getCopilotRoleScope,
  DEFAULT_GOVERNANCE_SETTINGS,
  JUSTIFICATION_TEMPLATES,
  UX_MESSAGES,
} from "@/lib/copilot/governance";
import type {
  GovernanceSettings,
  RateLimitState,
  CopilotRunRequest,
  TwoPersonApprovalState,
} from "@/lib/copilot/governance";

// ---------------------------------------------------------------------------
// Settings service
// ---------------------------------------------------------------------------
import {
  validateSettingsUpdate,
  computeSettingsChanges,
  applySettingsUpdate,
  canModifySettings,
  getDefaultSettings,
} from "@/lib/copilot/governance-settings";
import type { GovernanceSettingsUpdate } from "@/lib/copilot/governance-settings";

// ---------------------------------------------------------------------------
// Report service
// ---------------------------------------------------------------------------
import {
  canViewGovernanceReport,
  canExportGovernanceReport,
  buildReportEntry,
  buildReportSummary,
  exportReportAsCSV,
  exportReportAsJSON,
} from "@/lib/copilot/governance-report";
import type { GovernanceReportEntry } from "@/lib/copilot/governance-report";

// ---------------------------------------------------------------------------
// Legal hold
// ---------------------------------------------------------------------------
import {
  checkLegalHoldForExport,
  checkLegalHoldForDeletion,
} from "@/lib/copilot/legal-hold";

// =========================================================================
// 1. Governance Settings CRUD
// =========================================================================
describe("Governance Settings CRUD", () => {
  describe("Full settings lifecycle", () => {
    it("should start with sensible defaults", () => {
      const defaults = getDefaultSettings();
      expect(defaults.copilotEnabled).toBe(true);
      expect(defaults.defaultExecutionMode).toBe("METADATA_ONLY");
      expect(defaults.requireJustification).toBe(true);
      expect(defaults.requireConfirmation).toBe(true);
      expect(defaults.twoPersonApprovalForExport).toBe(false);
      expect(defaults.allowContentScanning).toBe(false);
      expect(defaults.allowOcr).toBe(false);
      expect(defaults.allowLlmSummaries).toBe(false);
    });

    it("should validate all 16 settings fields exist", () => {
      const defaults = getDefaultSettings();
      const keys = Object.keys(defaults);
      expect(keys).toContain("copilotEnabled");
      expect(keys).toContain("allowedProviderPhases");
      expect(keys).toContain("defaultExecutionMode");
      expect(keys).toContain("allowContentScanning");
      expect(keys).toContain("allowOcr");
      expect(keys).toContain("allowLlmSummaries");
      expect(keys).toContain("maxRunsPerDayTenant");
      expect(keys).toContain("maxRunsPerDayUser");
      expect(keys).toContain("maxEvidenceItemsPerRun");
      expect(keys).toContain("maxContentScanBytes");
      expect(keys).toContain("maxConcurrentRuns");
      expect(keys).toContain("dueSoonWindowDays");
      expect(keys).toContain("artifactRetentionDays");
      expect(keys).toContain("twoPersonApprovalForExport");
      expect(keys).toContain("requireJustification");
      expect(keys).toContain("requireConfirmation");
      expect(keys.length).toBe(16);
    });

    it("should apply partial update correctly", () => {
      const current = getDefaultSettings();
      const update: GovernanceSettingsUpdate = {
        copilotEnabled: false,
        maxRunsPerDayTenant: 50,
      };
      const updated = applySettingsUpdate(current, update);

      expect(updated.copilotEnabled).toBe(false);
      expect(updated.maxRunsPerDayTenant).toBe(50);
      // Unchanged fields preserved
      expect(updated.defaultExecutionMode).toBe("METADATA_ONLY");
      expect(updated.requireJustification).toBe(true);
    });

    it("should compute changelog for modified fields only", () => {
      const current = getDefaultSettings();
      const update: GovernanceSettingsUpdate = {
        copilotEnabled: false,
        allowContentScanning: true,
        requireJustification: true, // unchanged
      };
      const changes = computeSettingsChanges(current, update);

      expect(changes.length).toBe(2);
      expect(changes.find((c) => c.field === "copilotEnabled")).toBeTruthy();
      expect(changes.find((c) => c.field === "allowContentScanning")).toBeTruthy();
      expect(changes.find((c) => c.field === "requireJustification")).toBeFalsy();
    });

    it("should ignore undefined fields in update", () => {
      const current = getDefaultSettings();
      const update: GovernanceSettingsUpdate = {
        maxRunsPerDayTenant: undefined,
      };
      const changes = computeSettingsChanges(current, update);
      expect(changes.length).toBe(0);
    });
  });

  describe("Settings validation boundaries", () => {
    it("should accept valid execution modes", () => {
      expect(validateSettingsUpdate({ defaultExecutionMode: "METADATA_ONLY" })).toBeNull();
      expect(validateSettingsUpdate({ defaultExecutionMode: "CONTENT_SCAN" })).toBeNull();
      expect(validateSettingsUpdate({ defaultExecutionMode: "FULL_CONTENT" })).toBeNull();
    });

    it("should reject invalid execution mode", () => {
      expect(validateSettingsUpdate({ defaultExecutionMode: "INVALID_MODE" })).not.toBeNull();
    });

    it("should accept valid provider phases", () => {
      expect(validateSettingsUpdate({ allowedProviderPhases: [1, 2, 3, 4] })).toBeNull();
    });

    it("should reject invalid provider phases", () => {
      expect(validateSettingsUpdate({ allowedProviderPhases: [0] })).not.toBeNull();
      expect(validateSettingsUpdate({ allowedProviderPhases: [5] })).not.toBeNull();
    });

    it("should enforce maxRunsPerDayTenant range [1, 10000]", () => {
      expect(validateSettingsUpdate({ maxRunsPerDayTenant: 1 })).toBeNull();
      expect(validateSettingsUpdate({ maxRunsPerDayTenant: 10000 })).toBeNull();
      expect(validateSettingsUpdate({ maxRunsPerDayTenant: 0 })).not.toBeNull();
      expect(validateSettingsUpdate({ maxRunsPerDayTenant: 10001 })).not.toBeNull();
    });

    it("should enforce maxRunsPerDayUser range [1, 1000]", () => {
      expect(validateSettingsUpdate({ maxRunsPerDayUser: 1 })).toBeNull();
      expect(validateSettingsUpdate({ maxRunsPerDayUser: 1000 })).toBeNull();
      expect(validateSettingsUpdate({ maxRunsPerDayUser: 0 })).not.toBeNull();
      expect(validateSettingsUpdate({ maxRunsPerDayUser: 1001 })).not.toBeNull();
    });

    it("should enforce maxConcurrentRuns range [1, 50]", () => {
      expect(validateSettingsUpdate({ maxConcurrentRuns: 1 })).toBeNull();
      expect(validateSettingsUpdate({ maxConcurrentRuns: 50 })).toBeNull();
      expect(validateSettingsUpdate({ maxConcurrentRuns: 0 })).not.toBeNull();
      expect(validateSettingsUpdate({ maxConcurrentRuns: 51 })).not.toBeNull();
    });

    it("should enforce maxEvidenceItemsPerRun range [1, 100000]", () => {
      expect(validateSettingsUpdate({ maxEvidenceItemsPerRun: 1 })).toBeNull();
      expect(validateSettingsUpdate({ maxEvidenceItemsPerRun: 100000 })).toBeNull();
      expect(validateSettingsUpdate({ maxEvidenceItemsPerRun: 0 })).not.toBeNull();
      expect(validateSettingsUpdate({ maxEvidenceItemsPerRun: 100001 })).not.toBeNull();
    });

    it("should enforce maxContentScanBytes range [1024, 10000000]", () => {
      expect(validateSettingsUpdate({ maxContentScanBytes: 1024 })).toBeNull();
      expect(validateSettingsUpdate({ maxContentScanBytes: 10000000 })).toBeNull();
      expect(validateSettingsUpdate({ maxContentScanBytes: 1023 })).not.toBeNull();
      expect(validateSettingsUpdate({ maxContentScanBytes: 10000001 })).not.toBeNull();
    });

    it("should enforce artifactRetentionDays range [1, 3650]", () => {
      expect(validateSettingsUpdate({ artifactRetentionDays: 1 })).toBeNull();
      expect(validateSettingsUpdate({ artifactRetentionDays: 3650 })).toBeNull();
      expect(validateSettingsUpdate({ artifactRetentionDays: 0 })).not.toBeNull();
      expect(validateSettingsUpdate({ artifactRetentionDays: 3651 })).not.toBeNull();
    });

    it("should enforce dueSoonWindowDays range [1, 365]", () => {
      expect(validateSettingsUpdate({ dueSoonWindowDays: 1 })).toBeNull();
      expect(validateSettingsUpdate({ dueSoonWindowDays: 365 })).toBeNull();
      expect(validateSettingsUpdate({ dueSoonWindowDays: 0 })).not.toBeNull();
      expect(validateSettingsUpdate({ dueSoonWindowDays: 366 })).not.toBeNull();
    });

    it("should accept boolean toggles without validation errors", () => {
      expect(validateSettingsUpdate({ copilotEnabled: true })).toBeNull();
      expect(validateSettingsUpdate({ copilotEnabled: false })).toBeNull();
      expect(validateSettingsUpdate({ twoPersonApprovalForExport: true })).toBeNull();
      expect(validateSettingsUpdate({ requireJustification: false })).toBeNull();
      expect(validateSettingsUpdate({ requireConfirmation: false })).toBeNull();
    });
  });

  describe("Settings role-based access", () => {
    it("DPO can modify settings", () => {
      expect(canModifySettings("DPO")).toBe(true);
    });

    it("TENANT_ADMIN can modify settings", () => {
      expect(canModifySettings("TENANT_ADMIN")).toBe(true);
    });

    it("SUPER_ADMIN can modify settings", () => {
      expect(canModifySettings("SUPER_ADMIN")).toBe(true);
    });

    it("CASE_MANAGER cannot modify settings", () => {
      expect(canModifySettings("CASE_MANAGER")).toBe(false);
    });

    it("CONTRIBUTOR cannot modify settings", () => {
      expect(canModifySettings("CONTRIBUTOR")).toBe(false);
    });

    it("READ_ONLY cannot modify settings", () => {
      expect(canModifySettings("READ_ONLY")).toBe(false);
    });

    it("unknown role cannot modify settings", () => {
      expect(canModifySettings("UNKNOWN")).toBe(false);
    });
  });
});

// =========================================================================
// 2. Approval Flow (Art. 9 + Two-Person Export)
// =========================================================================
describe("Approval Flow", () => {
  describe("Art. 9 legal review", () => {
    it("DPO single approval should be sufficient for Art. 9", () => {
      // Art. 9 reviews require single DPO approval
      const scope = getCopilotRoleScope("DPO");
      expect(scope.canApproveArt9).toBe(true);
    });

    it("CASE_MANAGER cannot approve Art. 9", () => {
      const scope = getCopilotRoleScope("CASE_MANAGER");
      expect(scope.canApproveArt9).toBe(false);
    });

    it("CONTRIBUTOR cannot approve Art. 9", () => {
      const scope = getCopilotRoleScope("CONTRIBUTOR");
      expect(scope.canApproveArt9).toBe(false);
    });
  });

  describe("Two-person export approval", () => {
    const twoPersonSettings: GovernanceSettings = {
      ...DEFAULT_GOVERNANCE_SETTINGS,
      twoPersonApprovalForExport: true,
    };

    it("should require 2 approvals when enabled", () => {
      const state: TwoPersonApprovalState = {
        approvals: [{ userId: "user-2", role: "DPO", approved: true }],
      };
      const result = checkTwoPersonApproval(state, "user-1", twoPersonSettings);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("TWO_PERSON_APPROVAL_REQUIRED");
    });

    it("should not count requester as approver", () => {
      const state: TwoPersonApprovalState = {
        approvals: [
          { userId: "user-1", role: "DPO", approved: true }, // Requester
          { userId: "user-2", role: "DPO", approved: true },
        ],
      };
      const result = checkTwoPersonApproval(state, "user-1", twoPersonSettings);
      expect(result.allowed).toBe(false);
    });

    it("should require at least one DPO/Admin approver", () => {
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

    it("should accept TENANT_ADMIN as qualified approver", () => {
      const state: TwoPersonApprovalState = {
        approvals: [
          { userId: "user-2", role: "TENANT_ADMIN", approved: true },
          { userId: "user-3", role: "CASE_MANAGER", approved: true },
        ],
      };
      const result = checkTwoPersonApproval(state, "user-1", twoPersonSettings);
      expect(result.allowed).toBe(true);
    });

    it("should accept SUPER_ADMIN as qualified approver", () => {
      const state: TwoPersonApprovalState = {
        approvals: [
          { userId: "user-2", role: "SUPER_ADMIN", approved: true },
          { userId: "user-3", role: "CASE_MANAGER", approved: true },
        ],
      };
      const result = checkTwoPersonApproval(state, "user-1", twoPersonSettings);
      expect(result.allowed).toBe(true);
    });

    it("should not count rejected approvals", () => {
      const state: TwoPersonApprovalState = {
        approvals: [
          { userId: "user-2", role: "DPO", approved: false }, // Rejected
          { userId: "user-3", role: "DPO", approved: true },
        ],
      };
      const result = checkTwoPersonApproval(state, "user-1", twoPersonSettings);
      expect(result.allowed).toBe(false);
    });

    it("should bypass when two-person approval is disabled", () => {
      const state: TwoPersonApprovalState = { approvals: [] };
      const result = checkTwoPersonApproval(state, "user-1", DEFAULT_GOVERNANCE_SETTINGS);
      expect(result.allowed).toBe(true);
    });
  });

  describe("Export approval role matrix", () => {
    it("DPO can approve exports", () => {
      expect(getCopilotRoleScope("DPO").canApproveExport).toBe(true);
    });

    it("TENANT_ADMIN can approve exports", () => {
      expect(getCopilotRoleScope("TENANT_ADMIN").canApproveExport).toBe(true);
    });

    it("SUPER_ADMIN can approve exports", () => {
      expect(getCopilotRoleScope("SUPER_ADMIN").canApproveExport).toBe(true);
    });

    it("CASE_MANAGER cannot approve exports", () => {
      expect(getCopilotRoleScope("CASE_MANAGER").canApproveExport).toBe(false);
    });

    it("CONTRIBUTOR cannot approve exports", () => {
      expect(getCopilotRoleScope("CONTRIBUTOR").canApproveExport).toBe(false);
    });
  });
});

// =========================================================================
// 3. CopilotRun Pre-Flight Enforcement
// =========================================================================
describe("CopilotRun Pre-Flight Enforcement", () => {
  const settings = DEFAULT_GOVERNANCE_SETTINGS;
  const okRate: RateLimitState = { tenantRunsToday: 0, userRunsToday: 0, concurrentRuns: 0 };

  function makeRequest(overrides?: Partial<CopilotRunRequest>): CopilotRunRequest {
    return {
      tenantId: "t1",
      caseId: "c1",
      userId: "u1",
      userRole: "DPO",
      justification: "Art. 15 access request for response preparation",
      ...overrides,
    };
  }

  it("should pass all checks for valid DPO request", () => {
    const result = runPreFlightChecks(makeRequest(), settings, okRate, true);
    expect(result.allowed).toBe(true);
  });

  it("should pass for CASE_MANAGER", () => {
    const result = runPreFlightChecks(
      makeRequest({ userRole: "CASE_MANAGER" }),
      settings, okRate, true,
    );
    expect(result.allowed).toBe(true);
  });

  it("should block when copilot is disabled (global killswitch)", () => {
    const disabled = { ...settings, copilotEnabled: false };
    const result = runPreFlightChecks(makeRequest(), disabled, okRate, true);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("COPILOT_DISABLED");
  });

  it("should block missing caseId (case-only enforcement)", () => {
    const result = runPreFlightChecks(makeRequest({ caseId: "" }), settings, okRate, true);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_CASE_ID");
  });

  it("should block missing tenantId", () => {
    const result = runPreFlightChecks(makeRequest({ tenantId: "" }), settings, okRate, true);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_TENANT_ID");
  });

  it("should block when subject not linked", () => {
    const result = runPreFlightChecks(makeRequest(), settings, okRate, false);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("SUBJECT_NOT_LINKED");
  });

  it("should block insufficient justification", () => {
    const result = runPreFlightChecks(
      makeRequest({ justification: "short" }),
      settings, okRate, true,
    );
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_JUSTIFICATION");
  });

  it("should block CONTRIBUTOR role", () => {
    const result = runPreFlightChecks(
      makeRequest({ userRole: "CONTRIBUTOR" }),
      settings, okRate, true,
    );
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("ROLE_FORBIDDEN");
  });

  it("should block READ_ONLY role", () => {
    const result = runPreFlightChecks(
      makeRequest({ userRole: "READ_ONLY" }),
      settings, okRate, true,
    );
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("ROLE_FORBIDDEN");
  });

  it("should block when concurrency limit reached", () => {
    const maxRate: RateLimitState = { tenantRunsToday: 0, userRunsToday: 0, concurrentRuns: 3 };
    const result = runPreFlightChecks(makeRequest(), settings, maxRate, true);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("CONCURRENCY_LIMIT");
  });

  it("should block when tenant daily limit reached", () => {
    const maxRate: RateLimitState = { tenantRunsToday: 100, userRunsToday: 0, concurrentRuns: 0 };
    const result = runPreFlightChecks(makeRequest(), settings, maxRate, true);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("TENANT_DAILY_LIMIT");
  });

  it("should block when user daily limit reached", () => {
    const maxRate: RateLimitState = { tenantRunsToday: 0, userRunsToday: 20, concurrentRuns: 0 };
    const result = runPreFlightChecks(makeRequest(), settings, maxRate, true);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("USER_DAILY_LIMIT");
  });

  it("should block content scan for CASE_MANAGER even if requested", () => {
    const enabledScan = { ...settings, allowContentScanning: true };
    const result = enforceContentScanPermission("CASE_MANAGER", true, enabledScan);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("CONTENT_SCAN_FORBIDDEN");
  });

  it("should block content scan when tenant has disabled it", () => {
    const result = enforceContentScanPermission("DPO", true, settings);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("CONTENT_SCAN_DISABLED");
  });

  it("should allow content scan for DPO when tenant allows", () => {
    const enabledScan = { ...settings, allowContentScanning: true };
    const result = enforceContentScanPermission("DPO", true, enabledScan);
    expect(result.allowed).toBe(true);
  });
});

// =========================================================================
// 4. Activity Log & Report Building
// =========================================================================
describe("Activity Log & Report Building", () => {
  function makeEntry(overrides?: Partial<Parameters<typeof buildReportEntry>[0]>): GovernanceReportEntry {
    return buildReportEntry({
      runId: "r1",
      caseId: "c1",
      caseNumber: "DSAR-2025-001",
      actorUserId: "u1",
      actorName: "Test DPO",
      actorRole: "DPO",
      startedAt: new Date("2025-01-15T10:00:00Z"),
      completedAt: new Date("2025-01-15T10:05:00Z"),
      status: "COMPLETED",
      justification: "Art. 15 GDPR access request",
      subjectIdentifierType: "EMAIL",
      subjectIdentifierValue: "max@example.com",
      systemsSearched: ["EXCHANGE_ONLINE", "SHAREPOINT"],
      contentScanningUsed: false,
      ocrUsed: false,
      art9Suspected: false,
      specialCategories: [],
      totalFindings: 3,
      totalEvidenceItems: 5,
      exportGenerated: false,
      exportApprovedBy: null,
      legalApprovalStatus: "NOT_REQUIRED",
      ...overrides,
    });
  }

  describe("Entry building", () => {
    it("should always mask subject identifier", () => {
      const entry = makeEntry();
      expect(entry.subjectIdentifier).not.toBe("max@example.com");
      expect(entry.subjectIdentifier).toContain("*");
      expect(entry.subjectIdentifier).toContain("@example.com");
    });

    it("should mask phone subject identifiers", () => {
      const entry = makeEntry({
        subjectIdentifierType: "PHONE",
        subjectIdentifierValue: "+49 170 1234567",
      });
      expect(entry.subjectIdentifier).not.toBe("+49 170 1234567");
      expect(entry.subjectIdentifier).toContain("*");
    });

    it("should mask name subject identifiers", () => {
      const entry = makeEntry({
        subjectIdentifierType: "name",
        subjectIdentifierValue: "Max Mustermann",
      });
      expect(entry.subjectIdentifier).not.toBe("Max Mustermann");
    });

    it("should preserve all non-PII fields", () => {
      const entry = makeEntry();
      expect(entry.runId).toBe("r1");
      expect(entry.caseNumber).toBe("DSAR-2025-001");
      expect(entry.actorRole).toBe("DPO");
      expect(entry.totalFindings).toBe(3);
      expect(entry.systemsSearched).toEqual(["EXCHANGE_ONLINE", "SHAREPOINT"]);
    });

    it("should handle null dates", () => {
      const entry = makeEntry({ startedAt: null, completedAt: null });
      expect(entry.startedAt).toBeNull();
      expect(entry.completedAt).toBeNull();
    });

    it("should flag Art. 9 entries", () => {
      const entry = makeEntry({
        art9Suspected: true,
        specialCategories: ["HEALTH", "BIOMETRIC"],
      });
      expect(entry.art9Suspected).toBe(true);
      expect(entry.specialCategories).toEqual(["HEALTH", "BIOMETRIC"]);
    });
  });

  describe("Summary computation", () => {
    it("should compute correct totals", () => {
      const entries = [
        makeEntry({ status: "COMPLETED", art9Suspected: false, exportGenerated: true }),
        makeEntry({ runId: "r2", caseId: "c2", actorUserId: "u2", status: "COMPLETED", art9Suspected: true }),
        makeEntry({ runId: "r3", caseId: "c1", status: "FAILED" }),
      ];
      const summary = buildReportSummary(entries, new Date("2025-01-01"), new Date("2025-01-31"));

      expect(summary.totalRuns).toBe(3);
      expect(summary.completedRuns).toBe(2);
      expect(summary.failedRuns).toBe(1);
      expect(summary.art9DetectedRuns).toBe(1);
      expect(summary.totalExports).toBe(1);
      expect(summary.uniqueUsers).toBe(2);
      expect(summary.uniqueCases).toBe(2);
    });

    it("should handle empty entries", () => {
      const summary = buildReportSummary([], new Date(), new Date());
      expect(summary.totalRuns).toBe(0);
      expect(summary.uniqueUsers).toBe(0);
    });
  });

  describe("CSV export", () => {
    it("should produce header + data rows", () => {
      const entries = [makeEntry(), makeEntry({ runId: "r2" })];
      const csv = exportReportAsCSV(entries);
      const lines = csv.split("\n");
      expect(lines.length).toBe(3); // header + 2 rows
    });

    it("should contain all column headers", () => {
      const csv = exportReportAsCSV([makeEntry()]);
      const header = csv.split("\n")[0];
      expect(header).toContain("RunId");
      expect(header).toContain("CaseNumber");
      expect(header).toContain("Justification");
      expect(header).toContain("SubjectIdentifier");
      expect(header).toContain("Art9Suspected");
      expect(header).toContain("LegalApprovalStatus");
    });

    it("should escape commas in values", () => {
      const entry = makeEntry({ justification: "This, contains, commas" });
      const csv = exportReportAsCSV([entry]);
      expect(csv).toContain('"This, contains, commas"');
    });

    it("should include masked identifier, not raw PII", () => {
      const csv = exportReportAsCSV([makeEntry()]);
      expect(csv).not.toContain("max@example.com");
      expect(csv).toContain("@example.com"); // Domain preserved
    });
  });

  describe("JSON export", () => {
    it("should produce valid parseable JSON", () => {
      const entries = [makeEntry()];
      const summary = buildReportSummary(entries, new Date(), new Date());
      const json = exportReportAsJSON(entries, summary);
      const parsed = JSON.parse(json);

      expect(parsed.meta).toBeDefined();
      expect(parsed.meta.reportType).toBe("COPILOT_GOVERNANCE_DPIA");
      expect(parsed.meta.version).toBe("1.0");
      expect(parsed.summary.totalRuns).toBe(1);
      expect(parsed.entries.length).toBe(1);
    });

    it("should include generatedAt timestamp in meta", () => {
      const entries = [makeEntry()];
      const summary = buildReportSummary(entries, new Date(), new Date());
      const parsed = JSON.parse(exportReportAsJSON(entries, summary));
      expect(parsed.meta.generatedAt).toBeDefined();
    });
  });

  describe("Report role access", () => {
    it("DPO can view and export reports", () => {
      expect(canViewGovernanceReport("DPO")).toBe(true);
      expect(canExportGovernanceReport("DPO")).toBe(true);
    });

    it("TENANT_ADMIN can view and export reports", () => {
      expect(canViewGovernanceReport("TENANT_ADMIN")).toBe(true);
      expect(canExportGovernanceReport("TENANT_ADMIN")).toBe(true);
    });

    it("CASE_MANAGER cannot view or export reports", () => {
      expect(canViewGovernanceReport("CASE_MANAGER")).toBe(false);
      expect(canExportGovernanceReport("CASE_MANAGER")).toBe(false);
    });

    it("CONTRIBUTOR cannot view reports", () => {
      expect(canViewGovernanceReport("CONTRIBUTOR")).toBe(false);
    });
  });
});

// =========================================================================
// 5. Data Masking & Pseudonymization
// =========================================================================
describe("Data Masking & Pseudonymization", () => {
  it("should mask email addresses", () => {
    const masked = maskIdentifierForLog("EMAIL", "max.mustermann@example.com");
    expect(masked).not.toBe("max.mustermann@example.com");
    expect(masked).toContain("@example.com");
    expect(masked).toContain("*");
  });

  it("should mask phone numbers", () => {
    const masked = maskIdentifierForLog("PHONE", "+49 170 1234567");
    expect(masked).toContain("*");
    expect(masked).not.toBe("+49 170 1234567");
  });

  it("should mask IBAN", () => {
    const masked = maskIdentifierForLog("IBAN", "DE89370400440532013000");
    expect(masked).toContain("*");
    expect(masked.startsWith("DE")).toBe(true);
  });

  it("should mask employee IDs", () => {
    const masked = maskIdentifierForLog("EMPLOYEE_ID", "EMP-123456");
    expect(masked).not.toBe("EMP-123456");
  });

  it("should mask names", () => {
    const masked = maskIdentifierForLog("name", "Max Mustermann");
    expect(masked).not.toBe("Max Mustermann");
  });

  it("should auto-detect email format even with unknown type", () => {
    const masked = maskIdentifierForLog("unknown", "test@example.com");
    expect(masked).toContain("@example.com");
    expect(masked).toContain("*");
  });

  it("should return *** for empty values", () => {
    expect(maskIdentifierForLog("EMAIL", "")).toBe("***");
    expect(maskIdentifierForLog("name", "")).toBe("***");
  });

  it("should mask case-insensitive email type", () => {
    const masked = maskIdentifierForLog("email", "user@test.com");
    expect(masked).toContain("@test.com");
    expect(masked).toContain("*");
  });

  it("should mask case-insensitive phone type", () => {
    const masked = maskIdentifierForLog("phone", "+1 555 1234567");
    expect(masked).toContain("*");
  });
});

// =========================================================================
// 6. Justification Templates
// =========================================================================
describe("Justification Templates", () => {
  it("should have at least 5 templates", () => {
    expect(JUSTIFICATION_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it("each template should have id, label, and text", () => {
    for (const template of JUSTIFICATION_TEMPLATES) {
      expect(template.id).toBeDefined();
      expect(template.id.length).toBeGreaterThan(0);
      expect(template.label).toBeDefined();
      expect(template.label.length).toBeGreaterThan(0);
      expect(template.text).toBeDefined();
      expect(template.text.length).toBeGreaterThanOrEqual(10);
    }
  });

  it("should include GDPR article references", () => {
    const texts = JUSTIFICATION_TEMPLATES.map((t) => t.text);
    expect(texts.some((t) => t.includes("Art. 15"))).toBe(true);
    expect(texts.some((t) => t.includes("Art. 17"))).toBe(true);
    expect(texts.some((t) => t.includes("Art. 16"))).toBe(true);
    expect(texts.some((t) => t.includes("Art. 20"))).toBe(true);
  });

  it("all templates should satisfy minimum justification length", () => {
    for (const template of JUSTIFICATION_TEMPLATES) {
      const result = enforceJustification(template.text, DEFAULT_GOVERNANCE_SETTINGS);
      expect(result.allowed).toBe(true);
    }
  });
});

// =========================================================================
// 7. UX Guardrails
// =========================================================================
describe("UX Guardrails", () => {
  it("run start warning should mention audit logging", () => {
    expect(UX_MESSAGES.runStartWarning).toContain("audit-logged");
  });

  it("run confirmation should reference DSAR", () => {
    expect(UX_MESSAGES.runConfirmationLabel).toContain("DSAR processing");
  });

  it("export warning should mention sensitive data", () => {
    expect(UX_MESSAGES.exportWarning).toContain("sensitive data");
  });

  it("export reason should be required", () => {
    expect(UX_MESSAGES.exportReasonRequired).toContain("reason");
  });

  it("special category warning should reference Art. 9", () => {
    expect(UX_MESSAGES.specialCategoryWarning).toContain("Art. 9");
    expect(UX_MESSAGES.specialCategoryWarning).toContain("Legal review");
  });

  it("no-evidence disclaimer should explain limitations", () => {
    expect(UX_MESSAGES.noEvidenceDisclaimer).toContain("does not guarantee");
    expect(UX_MESSAGES.noEvidenceDisclaimer).toContain("systems queried");
  });
});

// =========================================================================
// 8. Role Scope Matrix (complete coverage)
// =========================================================================
describe("Role Scope Matrix", () => {
  const roles = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO", "CASE_MANAGER", "CONTRIBUTOR", "READ_ONLY"];

  it("all defined roles should have scopes", () => {
    for (const role of roles) {
      const scope = getCopilotRoleScope(role);
      expect(scope).toBeDefined();
      expect(typeof scope.canStartRun).toBe("boolean");
      expect(typeof scope.canConfigureRun).toBe("boolean");
      expect(typeof scope.metadataOnly).toBe("boolean");
      expect(typeof scope.canRequestContentScan).toBe("boolean");
      expect(typeof scope.canGenerateSummaries).toBe("boolean");
      expect(typeof scope.canRequestExport).toBe("boolean");
      expect(typeof scope.canApproveExport).toBe("boolean");
      expect(typeof scope.canApproveArt9).toBe("boolean");
      expect(typeof scope.canChangeSettings).toBe("boolean");
      expect(typeof scope.canViewGovernanceReport).toBe("boolean");
    }
  });

  it("unknown role should fall back to READ_ONLY", () => {
    const scope = getCopilotRoleScope("INVALID_ROLE");
    const readOnly = getCopilotRoleScope("READ_ONLY");
    expect(scope).toEqual(readOnly);
  });

  it("SUPER_ADMIN should have all permissions", () => {
    const scope = getCopilotRoleScope("SUPER_ADMIN");
    expect(scope.canStartRun).toBe(true);
    expect(scope.canConfigureRun).toBe(true);
    expect(scope.metadataOnly).toBe(false);
    expect(scope.canRequestContentScan).toBe(true);
    expect(scope.canGenerateSummaries).toBe(true);
    expect(scope.canRequestExport).toBe(true);
    expect(scope.canApproveExport).toBe(true);
    expect(scope.canApproveArt9).toBe(true);
    expect(scope.canChangeSettings).toBe(true);
    expect(scope.canViewGovernanceReport).toBe(true);
  });

  it("CASE_MANAGER should have limited permissions", () => {
    const scope = getCopilotRoleScope("CASE_MANAGER");
    expect(scope.canStartRun).toBe(true);
    expect(scope.canConfigureRun).toBe(true);
    expect(scope.canRequestContentScan).toBe(false);
    expect(scope.canApproveExport).toBe(false);
    expect(scope.canApproveArt9).toBe(false);
    expect(scope.canChangeSettings).toBe(false);
    expect(scope.canViewGovernanceReport).toBe(false);
  });

  it("CONTRIBUTOR should be metadata-only", () => {
    const scope = getCopilotRoleScope("CONTRIBUTOR");
    expect(scope.metadataOnly).toBe(true);
    expect(scope.canStartRun).toBe(false);
    expect(scope.canRequestExport).toBe(false);
  });

  it("READ_ONLY should have no operational permissions", () => {
    const scope = getCopilotRoleScope("READ_ONLY");
    expect(scope.canStartRun).toBe(false);
    expect(scope.canConfigureRun).toBe(false);
    expect(scope.canRequestContentScan).toBe(false);
    expect(scope.canGenerateSummaries).toBe(false);
    expect(scope.canRequestExport).toBe(false);
    expect(scope.canApproveExport).toBe(false);
    expect(scope.canApproveArt9).toBe(false);
    expect(scope.canChangeSettings).toBe(false);
    expect(scope.canViewGovernanceReport).toBe(false);
  });
});

// =========================================================================
// 9. Anomaly Detection (Break-Glass)
// =========================================================================
describe("Anomaly Detection (Break-Glass Events)", () => {
  it("should trigger on high run frequency", () => {
    const result = checkForAnomalies({
      userId: "u1", tenantId: "t1",
      runsInLastHour: 12,
      distinctSubjectsInLastHour: 1,
      permissionDeniedInLastHour: 0,
    });
    expect(result.isAnomaly).toBe(true);
    expect(result.eventType).toBe("ANOMALY_MANY_RUNS");
  });

  it("should trigger on many distinct subjects", () => {
    const result = checkForAnomalies({
      userId: "u1", tenantId: "t1",
      runsInLastHour: 3,
      distinctSubjectsInLastHour: 7,
      permissionDeniedInLastHour: 0,
    });
    expect(result.isAnomaly).toBe(true);
    expect(result.eventType).toBe("ANOMALY_MANY_SUBJECTS");
  });

  it("should trigger on many permission denials", () => {
    const result = checkForAnomalies({
      userId: "u1", tenantId: "t1",
      runsInLastHour: 1,
      distinctSubjectsInLastHour: 1,
      permissionDeniedInLastHour: 6,
    });
    expect(result.isAnomaly).toBe(true);
    expect(result.eventType).toBe("ANOMALY_PERMISSION_DENIED");
  });

  it("should not trigger on normal usage", () => {
    const result = checkForAnomalies({
      userId: "u1", tenantId: "t1",
      runsInLastHour: 3,
      distinctSubjectsInLastHour: 2,
      permissionDeniedInLastHour: 0,
    });
    expect(result.isAnomaly).toBe(false);
    expect(result.eventType).toBeUndefined();
  });

  it("should include description when anomaly detected", () => {
    const result = checkForAnomalies({
      userId: "u1", tenantId: "t1",
      runsInLastHour: 15,
      distinctSubjectsInLastHour: 1,
      permissionDeniedInLastHour: 0,
    });
    expect(result.description).toBeDefined();
    expect(result.description).toContain("u1");
  });
});

// =========================================================================
// 10. Rate Limiting
// =========================================================================
describe("Rate Limiting Enforcement", () => {
  it("should allow within all limits", () => {
    const state: RateLimitState = { tenantRunsToday: 5, userRunsToday: 2, concurrentRuns: 0 };
    const result = enforceRateLimits(state, DEFAULT_GOVERNANCE_SETTINGS);
    expect(result.allowed).toBe(true);
  });

  it("should block at exact concurrent limit", () => {
    const state: RateLimitState = { tenantRunsToday: 0, userRunsToday: 0, concurrentRuns: 3 };
    const result = enforceRateLimits(state, DEFAULT_GOVERNANCE_SETTINGS);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("CONCURRENCY_LIMIT");
  });

  it("should block at exact tenant daily limit", () => {
    const state: RateLimitState = { tenantRunsToday: 100, userRunsToday: 0, concurrentRuns: 0 };
    const result = enforceRateLimits(state, DEFAULT_GOVERNANCE_SETTINGS);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("TENANT_DAILY_LIMIT");
  });

  it("should block at exact user daily limit", () => {
    const state: RateLimitState = { tenantRunsToday: 0, userRunsToday: 20, concurrentRuns: 0 };
    const result = enforceRateLimits(state, DEFAULT_GOVERNANCE_SETTINGS);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("USER_DAILY_LIMIT");
  });

  it("should allow just under concurrent limit", () => {
    const state: RateLimitState = { tenantRunsToday: 0, userRunsToday: 0, concurrentRuns: 2 };
    const result = enforceRateLimits(state, DEFAULT_GOVERNANCE_SETTINGS);
    expect(result.allowed).toBe(true);
  });

  it("should respect custom limits", () => {
    const customSettings: GovernanceSettings = {
      ...DEFAULT_GOVERNANCE_SETTINGS,
      maxConcurrentRuns: 10,
      maxRunsPerDayTenant: 500,
      maxRunsPerDayUser: 50,
    };
    const state: RateLimitState = { tenantRunsToday: 200, userRunsToday: 30, concurrentRuns: 8 };
    const result = enforceRateLimits(state, customSettings);
    expect(result.allowed).toBe(true);
  });

  it("concurrency check takes priority", () => {
    const state: RateLimitState = { tenantRunsToday: 200, userRunsToday: 30, concurrentRuns: 3 };
    const result = enforceRateLimits(state, DEFAULT_GOVERNANCE_SETTINGS);
    expect(result.code).toBe("CONCURRENCY_LIMIT");
  });
});

// =========================================================================
// 11. Legal Hold Integration with Export
// =========================================================================
describe("Legal Hold & Export Integration", () => {
  it("should block export when legal hold is active", () => {
    const result = checkLegalHoldForExport({
      enabled: true,
      reason: "Litigation pending",
      enabledAt: new Date(),
      enabledByUserId: "dpo-1",
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("LEGAL_HOLD_EXPORT_BLOCKED");
  });

  it("should allow export when legal hold is inactive", () => {
    const result = checkLegalHoldForExport({ enabled: false });
    expect(result.allowed).toBe(true);
  });

  it("should block deletion when legal hold is active", () => {
    const result = checkLegalHoldForDeletion({
      enabled: true,
      reason: "Investigation ongoing",
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("LEGAL_HOLD_DELETION_BLOCKED");
  });

  it("should allow deletion when legal hold is inactive", () => {
    const result = checkLegalHoldForDeletion({ enabled: false });
    expect(result.allowed).toBe(true);
  });
});

// =========================================================================
// 12. End-to-End Governance Scenarios
// =========================================================================
describe("End-to-End Governance Scenarios", () => {
  const settings = DEFAULT_GOVERNANCE_SETTINGS;
  const okRate: RateLimitState = { tenantRunsToday: 0, userRunsToday: 0, concurrentRuns: 0 };

  it("Scenario: CASE_MANAGER runs valid DSAR discovery", () => {
    const request: CopilotRunRequest = {
      tenantId: "acme-corp",
      caseId: "case-1234",
      userId: "cm-user",
      userRole: "CASE_MANAGER",
      justification: "Art. 15 GDPR access request – locating personal data for response preparation",
    };
    const result = runPreFlightChecks(request, settings, okRate, true);
    expect(result.allowed).toBe(true);
  });

  it("Scenario: Rogue user tries discovery without case", () => {
    const request: CopilotRunRequest = {
      tenantId: "acme-corp",
      caseId: "",
      userId: "rogue-user",
      userRole: "DPO",
      justification: "Just looking around",
    };
    const result = runPreFlightChecks(request, settings, okRate, true);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("MISSING_CASE_ID");
  });

  it("Scenario: Bulk surveillance attempt triggers anomaly", () => {
    const anomaly = checkForAnomalies({
      userId: "suspect-user",
      tenantId: "acme-corp",
      runsInLastHour: 15,
      distinctSubjectsInLastHour: 12,
      permissionDeniedInLastHour: 0,
    });
    expect(anomaly.isAnomaly).toBe(true);
    // Should trigger on ANOMALY_MANY_RUNS first
    expect(anomaly.eventType).toBe("ANOMALY_MANY_RUNS");
  });

  it("Scenario: Export with two-person approval", () => {
    const twoPersonSettings: GovernanceSettings = {
      ...settings,
      twoPersonApprovalForExport: true,
    };

    // Step 1: Export requester requests (not yet approved)
    const state0: TwoPersonApprovalState = { approvals: [] };
    expect(checkTwoPersonApproval(state0, "requester-1", twoPersonSettings).allowed).toBe(false);

    // Step 2: First DPO approves
    const state1: TwoPersonApprovalState = {
      approvals: [{ userId: "dpo-1", role: "DPO", approved: true }],
    };
    expect(checkTwoPersonApproval(state1, "requester-1", twoPersonSettings).allowed).toBe(false);

    // Step 3: Second approver (Admin) approves
    const state2: TwoPersonApprovalState = {
      approvals: [
        { userId: "dpo-1", role: "DPO", approved: true },
        { userId: "admin-1", role: "TENANT_ADMIN", approved: true },
      ],
    };
    expect(checkTwoPersonApproval(state2, "requester-1", twoPersonSettings).allowed).toBe(true);
  });

  it("Scenario: Art. 9 data blocks export until approval", () => {
    // Verify that CASE_MANAGER can request exports
    expect(enforceExportPermission("CASE_MANAGER").allowed).toBe(true);

    // But cannot approve Art. 9 review
    const scope = getCopilotRoleScope("CASE_MANAGER");
    expect(scope.canApproveArt9).toBe(false);
    expect(scope.canApproveExport).toBe(false);

    // DPO can approve
    const dpoScope = getCopilotRoleScope("DPO");
    expect(dpoScope.canApproveArt9).toBe(true);
  });

  it("Scenario: Settings change by non-admin is blocked", () => {
    expect(enforceSettingsPermission("CASE_MANAGER").allowed).toBe(false);
    expect(enforceSettingsPermission("CONTRIBUTOR").allowed).toBe(false);
    expect(enforceSettingsPermission("READ_ONLY").allowed).toBe(false);
  });

  it("Scenario: All report entries have masked PII", () => {
    const entry = buildReportEntry({
      runId: "r1",
      caseId: "c1",
      caseNumber: "DSAR-2025-001",
      actorUserId: "u1",
      actorName: "Test User",
      actorRole: "DPO",
      startedAt: new Date(),
      completedAt: new Date(),
      status: "COMPLETED",
      justification: "GDPR request",
      subjectIdentifierType: "EMAIL",
      subjectIdentifierValue: "sensitive@company.com",
      systemsSearched: ["S1"],
      contentScanningUsed: false,
      ocrUsed: false,
      art9Suspected: false,
      specialCategories: [],
      totalFindings: 1,
      totalEvidenceItems: 1,
      exportGenerated: false,
      exportApprovedBy: null,
      legalApprovalStatus: "NOT_REQUIRED",
    });

    // Must not contain raw email
    const csv = exportReportAsCSV([entry]);
    expect(csv).not.toContain("sensitive@company.com");

    const summary = buildReportSummary([entry], new Date(), new Date());
    const json = exportReportAsJSON([entry], summary);
    expect(json).not.toContain("sensitive@company.com");
  });
});
