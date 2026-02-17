/**
 * RBAC & Permission Matrix Tests — Privacy Copilot
 *
 * Comprehensive test suite verifying:
 *   1. Fine-grained permission system (8 roles × 38 permissions)
 *   2. Legacy backward-compatible resource/action API
 *   3. Case access model (global vs scoped)
 *   4. Export gate conditions (Art. 9, legal hold, two-person)
 *   5. Content scan gate (role + tenant settings)
 *   6. Cross-tenant isolation
 *   7. Role-specific permission boundaries
 *   8. Case team membership
 *   9. Two-person approval flow
 *  10. UI visibility alignment
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  has,
  enforce,
  getPermissions,
  hasGlobalCaseAccess,
  isReadOnly,
  hasPermission,
  checkPermission,
  canManageUsers,
  canAccessSettings,
  canExport,
  canManageIntegrations,
  canUseCopilot,
  canReadCopilot,
  canManageGovernance,
  canViewGovernance,
  canViewGovernanceReport,
  canManageLegalHold,
  canReviewRedaction,
  canApproveLegal,
  canApproveExportStep1,
  canApproveExportStep2,
  checkExportGate,
  checkContentScanGate,
  type Permission,
} from "../../src/lib/rbac";
import {
  canAccessCase,
  enforceCaseAccess,
  enforceCasePermission,
  addTeamMember,
  removeTeamMember,
  getTeamMembers,
  isTeamMember,
  getCasesForUser,
  resetCaseTeamStore,
} from "../../src/lib/case-access";

// ─── 1. Fine-Grained Permission System ─────────────────────────────────────

describe("Fine-Grained Permission System", () => {
  const ALL_ROLES = [
    "SUPER_ADMIN", "TENANT_ADMIN", "DPO", "CASE_MANAGER",
    "ANALYST", "AUDITOR", "CONTRIBUTOR", "READ_ONLY",
  ];

  describe("TENANT_ADMIN has all permissions", () => {
    const adminPerms: Permission[] = [
      "GOVERNANCE_VIEW", "GOVERNANCE_EDIT_SETTINGS", "GOVERNANCE_EXPORT_REPORT",
      "COPILOT_RUN_CREATE", "COPILOT_RUN_EXECUTE", "COPILOT_RUN_VIEW", "COPILOT_RUN_CANCEL",
      "COPILOT_ALLOW_CONTENT_SCAN", "COPILOT_ALLOW_OCR", "COPILOT_ALLOW_LLM_SUMMARIES",
      "COPILOT_LEGAL_APPROVE", "EXPORT_APPROVE_STEP1", "EXPORT_APPROVE_STEP2",
      "EXPORT_REQUEST", "EXPORT_GENERATE", "EXPORT_DOWNLOAD",
      "INTEGRATIONS_VIEW", "INTEGRATIONS_CONFIGURE", "INTEGRATIONS_TEST_CONNECTION", "INTEGRATIONS_DISABLE_ENABLE",
      "DOCUMENT_UPLOAD", "DOCUMENT_DOWNLOAD", "DOCUMENT_DELETE",
      "USER_MANAGEMENT", "ROLE_MANAGEMENT", "TENANT_SETTINGS_EDIT",
      "CASES_CREATE", "CASES_READ", "CASES_UPDATE", "CASES_DELETE",
      "TASKS_CREATE", "TASKS_READ", "TASKS_UPDATE",
      "CASE_TEAM_MANAGE",
    ];

    for (const perm of adminPerms) {
      it(`has ${perm}`, () => {
        expect(has("TENANT_ADMIN", perm)).toBe(true);
      });
    }
  });

  describe("DPO permissions", () => {
    it("can view and edit governance", () => {
      expect(has("DPO", "GOVERNANCE_VIEW")).toBe(true);
      expect(has("DPO", "GOVERNANCE_EDIT_SETTINGS")).toBe(true);
      expect(has("DPO", "GOVERNANCE_EXPORT_REPORT")).toBe(true);
    });

    it("can approve legal gate", () => {
      expect(has("DPO", "COPILOT_LEGAL_APPROVE")).toBe(true);
      expect(has("DPO", "EXPORT_APPROVE_STEP2")).toBe(true);
    });

    it("cannot manage users/roles/tenant by default", () => {
      expect(has("DPO", "USER_MANAGEMENT")).toBe(false);
      expect(has("DPO", "ROLE_MANAGEMENT")).toBe(false);
      expect(has("DPO", "TENANT_SETTINGS_EDIT")).toBe(false);
    });

    it("cannot delete cases", () => {
      expect(has("DPO", "CASES_DELETE")).toBe(false);
    });

    it("has full copilot advanced capabilities", () => {
      expect(has("DPO", "COPILOT_ALLOW_CONTENT_SCAN")).toBe(true);
      expect(has("DPO", "COPILOT_ALLOW_OCR")).toBe(true);
      expect(has("DPO", "COPILOT_ALLOW_LLM_SUMMARIES")).toBe(true);
    });
  });

  describe("CASE_MANAGER permissions", () => {
    it("can view governance but not edit", () => {
      expect(has("CASE_MANAGER", "GOVERNANCE_VIEW")).toBe(true);
      expect(has("CASE_MANAGER", "GOVERNANCE_EDIT_SETTINGS")).toBe(false);
      expect(has("CASE_MANAGER", "GOVERNANCE_EXPORT_REPORT")).toBe(false);
    });

    it("can create and execute copilot runs", () => {
      expect(has("CASE_MANAGER", "COPILOT_RUN_CREATE")).toBe(true);
      expect(has("CASE_MANAGER", "COPILOT_RUN_EXECUTE")).toBe(true);
      expect(has("CASE_MANAGER", "COPILOT_RUN_VIEW")).toBe(true);
      expect(has("CASE_MANAGER", "COPILOT_RUN_CANCEL")).toBe(true);
    });

    it("cannot use content scan/OCR/LLM", () => {
      expect(has("CASE_MANAGER", "COPILOT_ALLOW_CONTENT_SCAN")).toBe(false);
      expect(has("CASE_MANAGER", "COPILOT_ALLOW_OCR")).toBe(false);
      expect(has("CASE_MANAGER", "COPILOT_ALLOW_LLM_SUMMARIES")).toBe(false);
    });

    it("can approve step1 but not step2 or legal", () => {
      expect(has("CASE_MANAGER", "EXPORT_APPROVE_STEP1")).toBe(true);
      expect(has("CASE_MANAGER", "EXPORT_APPROVE_STEP2")).toBe(false);
      expect(has("CASE_MANAGER", "COPILOT_LEGAL_APPROVE")).toBe(false);
    });

    it("can request exports but not generate", () => {
      expect(has("CASE_MANAGER", "EXPORT_REQUEST")).toBe(true);
      expect(has("CASE_MANAGER", "EXPORT_GENERATE")).toBe(false);
      expect(has("CASE_MANAGER", "EXPORT_DOWNLOAD")).toBe(true);
    });

    it("cannot configure integrations", () => {
      expect(has("CASE_MANAGER", "INTEGRATIONS_VIEW")).toBe(true);
      expect(has("CASE_MANAGER", "INTEGRATIONS_CONFIGURE")).toBe(false);
    });

    it("cannot delete documents", () => {
      expect(has("CASE_MANAGER", "DOCUMENT_UPLOAD")).toBe(true);
      expect(has("CASE_MANAGER", "DOCUMENT_DOWNLOAD")).toBe(true);
      expect(has("CASE_MANAGER", "DOCUMENT_DELETE")).toBe(false);
    });
  });

  describe("ANALYST permissions", () => {
    it("has NO governance access", () => {
      expect(has("ANALYST", "GOVERNANCE_VIEW")).toBe(false);
      expect(has("ANALYST", "GOVERNANCE_EDIT_SETTINGS")).toBe(false);
    });

    it("can execute and view copilot but NOT create runs", () => {
      expect(has("ANALYST", "COPILOT_RUN_CREATE")).toBe(false);
      expect(has("ANALYST", "COPILOT_RUN_EXECUTE")).toBe(true);
      expect(has("ANALYST", "COPILOT_RUN_VIEW")).toBe(true);
    });

    it("has NO advanced capabilities", () => {
      expect(has("ANALYST", "COPILOT_ALLOW_CONTENT_SCAN")).toBe(false);
      expect(has("ANALYST", "COPILOT_ALLOW_OCR")).toBe(false);
      expect(has("ANALYST", "COPILOT_ALLOW_LLM_SUMMARIES")).toBe(false);
    });

    it("has NO approval permissions", () => {
      expect(has("ANALYST", "COPILOT_LEGAL_APPROVE")).toBe(false);
      expect(has("ANALYST", "EXPORT_APPROVE_STEP1")).toBe(false);
      expect(has("ANALYST", "EXPORT_APPROVE_STEP2")).toBe(false);
    });

    it("has NO export permissions", () => {
      expect(has("ANALYST", "EXPORT_REQUEST")).toBe(false);
      expect(has("ANALYST", "EXPORT_GENERATE")).toBe(false);
      expect(has("ANALYST", "EXPORT_DOWNLOAD")).toBe(false);
    });

    it("can upload and download documents", () => {
      expect(has("ANALYST", "DOCUMENT_UPLOAD")).toBe(true);
      expect(has("ANALYST", "DOCUMENT_DOWNLOAD")).toBe(true);
      expect(has("ANALYST", "DOCUMENT_DELETE")).toBe(false);
    });

    it("cannot manage users, roles, or tenant settings", () => {
      expect(has("ANALYST", "USER_MANAGEMENT")).toBe(false);
      expect(has("ANALYST", "ROLE_MANAGEMENT")).toBe(false);
      expect(has("ANALYST", "TENANT_SETTINGS_EDIT")).toBe(false);
    });
  });

  describe("AUDITOR permissions — strictly read-only", () => {
    it("can view governance", () => {
      expect(has("AUDITOR", "GOVERNANCE_VIEW")).toBe(true);
    });

    it("cannot edit governance settings", () => {
      expect(has("AUDITOR", "GOVERNANCE_EDIT_SETTINGS")).toBe(false);
    });

    it("can only view copilot runs (no create/execute/cancel)", () => {
      expect(has("AUDITOR", "COPILOT_RUN_VIEW")).toBe(true);
      expect(has("AUDITOR", "COPILOT_RUN_CREATE")).toBe(false);
      expect(has("AUDITOR", "COPILOT_RUN_EXECUTE")).toBe(false);
      expect(has("AUDITOR", "COPILOT_RUN_CANCEL")).toBe(false);
    });

    it("has NO advanced capabilities", () => {
      expect(has("AUDITOR", "COPILOT_ALLOW_CONTENT_SCAN")).toBe(false);
      expect(has("AUDITOR", "COPILOT_ALLOW_OCR")).toBe(false);
    });

    it("has NO approval permissions", () => {
      expect(has("AUDITOR", "COPILOT_LEGAL_APPROVE")).toBe(false);
      expect(has("AUDITOR", "EXPORT_APPROVE_STEP1")).toBe(false);
      expect(has("AUDITOR", "EXPORT_APPROVE_STEP2")).toBe(false);
    });

    it("has NO export permissions", () => {
      expect(has("AUDITOR", "EXPORT_REQUEST")).toBe(false);
      expect(has("AUDITOR", "EXPORT_GENERATE")).toBe(false);
      expect(has("AUDITOR", "EXPORT_DOWNLOAD")).toBe(false);
    });

    it("can download but not upload or delete documents", () => {
      expect(has("AUDITOR", "DOCUMENT_DOWNLOAD")).toBe(true);
      expect(has("AUDITOR", "DOCUMENT_UPLOAD")).toBe(false);
      expect(has("AUDITOR", "DOCUMENT_DELETE")).toBe(false);
    });

    it("can read audit logs", () => {
      expect(has("AUDITOR", "AUDIT_LOGS_READ")).toBe(true);
    });

    it("cannot create, update, or delete cases", () => {
      expect(has("AUDITOR", "CASES_CREATE")).toBe(false);
      expect(has("AUDITOR", "CASES_UPDATE")).toBe(false);
      expect(has("AUDITOR", "CASES_DELETE")).toBe(false);
    });

    it("can read cases", () => {
      expect(has("AUDITOR", "CASES_READ")).toBe(true);
    });

    it("cannot manage users", () => {
      expect(has("AUDITOR", "USER_MANAGEMENT")).toBe(false);
    });
  });

  describe("READ_ONLY — minimal permissions", () => {
    const allowedPerms: Permission[] = [
      "CASES_READ", "TASKS_READ", "DOCUMENT_DOWNLOAD",
      "COMMENTS_READ", "INTEGRATIONS_VIEW",
    ];

    for (const perm of allowedPerms) {
      it(`has ${perm}`, () => {
        expect(has("READ_ONLY", perm)).toBe(true);
      });
    }

    const deniedPerms: Permission[] = [
      "GOVERNANCE_VIEW", "COPILOT_RUN_CREATE", "COPILOT_RUN_VIEW",
      "EXPORT_REQUEST", "USER_MANAGEMENT", "DOCUMENT_UPLOAD",
      "CASES_CREATE", "CASES_UPDATE",
    ];

    for (const perm of deniedPerms) {
      it(`does NOT have ${perm}`, () => {
        expect(has("READ_ONLY", perm)).toBe(false);
      });
    }
  });

  describe("enforce() throws for denied permissions", () => {
    it("throws ApiError(403) for ANALYST trying governance edit", () => {
      expect(() => enforce("ANALYST", "GOVERNANCE_EDIT_SETTINGS")).toThrow();
    });

    it("throws ApiError(403) for AUDITOR trying copilot create", () => {
      expect(() => enforce("AUDITOR", "COPILOT_RUN_CREATE")).toThrow();
    });

    it("does not throw for TENANT_ADMIN", () => {
      expect(() => enforce("TENANT_ADMIN", "GOVERNANCE_EDIT_SETTINGS")).not.toThrow();
    });
  });

  describe("getPermissions()", () => {
    it("returns permissions for valid role", () => {
      const perms = getPermissions("ANALYST");
      expect(perms).toContain("COPILOT_RUN_VIEW");
      expect(perms).not.toContain("GOVERNANCE_VIEW");
    });

    it("returns empty array for unknown role", () => {
      expect(getPermissions("UNKNOWN")).toEqual([]);
    });
  });

  describe("hasGlobalCaseAccess()", () => {
    it("returns true for SUPER_ADMIN, TENANT_ADMIN, DPO", () => {
      expect(hasGlobalCaseAccess("SUPER_ADMIN")).toBe(true);
      expect(hasGlobalCaseAccess("TENANT_ADMIN")).toBe(true);
      expect(hasGlobalCaseAccess("DPO")).toBe(true);
    });

    it("returns false for CASE_MANAGER, ANALYST, AUDITOR", () => {
      expect(hasGlobalCaseAccess("CASE_MANAGER")).toBe(false);
      expect(hasGlobalCaseAccess("ANALYST")).toBe(false);
      expect(hasGlobalCaseAccess("AUDITOR")).toBe(false);
    });
  });

  describe("isReadOnly()", () => {
    it("AUDITOR is read-only", () => {
      expect(isReadOnly("AUDITOR")).toBe(true);
    });

    it("READ_ONLY is read-only", () => {
      expect(isReadOnly("READ_ONLY")).toBe(true);
    });

    it("CASE_MANAGER is NOT read-only", () => {
      expect(isReadOnly("CASE_MANAGER")).toBe(false);
    });
  });

  describe("Unknown role returns no permissions", () => {
    it("has() returns false for unknown role", () => {
      expect(has("UNKNOWN_ROLE", "CASES_READ")).toBe(false);
    });

    it("enforce() throws for unknown role", () => {
      expect(() => enforce("UNKNOWN_ROLE", "CASES_READ")).toThrow();
    });
  });
});

// ─── 2. Legacy Backward-Compatible API ──────────────────────────────────────

describe("Legacy Resource/Action API", () => {
  describe("backward compatibility with existing tests", () => {
    it("SUPER_ADMIN has copilot create", () => {
      expect(hasPermission("SUPER_ADMIN", "copilot", "create")).toBe(true);
    });

    it("DPO has copilot create and manage", () => {
      expect(hasPermission("DPO", "copilot", "create")).toBe(true);
      expect(hasPermission("DPO", "copilot", "manage")).toBe(true);
    });

    it("CASE_MANAGER has copilot create and read", () => {
      expect(hasPermission("CASE_MANAGER", "copilot", "create")).toBe(true);
      expect(hasPermission("CASE_MANAGER", "copilot", "read")).toBe(true);
    });

    it("CONTRIBUTOR cannot create copilot runs", () => {
      expect(hasPermission("CONTRIBUTOR", "copilot", "create")).toBe(false);
    });

    it("CONTRIBUTOR can read copilot", () => {
      expect(hasPermission("CONTRIBUTOR", "copilot", "read")).toBe(true);
    });

    it("READ_ONLY cannot access copilot", () => {
      expect(hasPermission("READ_ONLY", "copilot", "create")).toBe(false);
      expect(hasPermission("READ_ONLY", "copilot", "read")).toBe(false);
    });

    it("CONTRIBUTOR cannot access governance settings", () => {
      expect(hasPermission("CONTRIBUTOR", "copilot_governance", "read")).toBe(false);
    });

    it("CASE_MANAGER can view governance but not manage", () => {
      expect(hasPermission("CASE_MANAGER", "copilot_governance", "read")).toBe(true);
      expect(hasPermission("CASE_MANAGER", "copilot_governance", "manage")).toBe(false);
    });

    it("DPO can manage governance", () => {
      expect(hasPermission("DPO", "copilot_governance", "manage")).toBe(true);
    });

    it("checkPermission throws for unauthorized", () => {
      expect(() => checkPermission("READ_ONLY" as any, "copilot", "create")).toThrow();
    });

    it("ANALYST can read copilot via legacy API", () => {
      expect(hasPermission("ANALYST", "copilot", "read")).toBe(true);
    });

    it("AUDITOR can read copilot via legacy API", () => {
      expect(hasPermission("AUDITOR", "copilot", "read")).toBe(true);
    });

    it("AUDITOR can view governance via legacy API", () => {
      expect(hasPermission("AUDITOR", "copilot_governance", "read")).toBe(true);
    });

    it("ANALYST cannot access governance via legacy API", () => {
      expect(hasPermission("ANALYST", "copilot_governance", "read")).toBe(false);
    });
  });

  describe("legacy convenience helpers", () => {
    it("canManageUsers", () => {
      expect(canManageUsers("SUPER_ADMIN")).toBe(true);
      expect(canManageUsers("DPO")).toBe(false);
      expect(canManageUsers("ANALYST")).toBe(false);
    });

    it("canAccessSettings", () => {
      expect(canAccessSettings("TENANT_ADMIN")).toBe(true);
      expect(canAccessSettings("DPO")).toBe(false);
    });

    it("canExport", () => {
      expect(canExport("DPO")).toBe(true);
      expect(canExport("CASE_MANAGER")).toBe(true);
      expect(canExport("ANALYST")).toBe(false);
      expect(canExport("AUDITOR")).toBe(false);
    });

    it("canManageIntegrations", () => {
      expect(canManageIntegrations("DPO")).toBe(true);
      expect(canManageIntegrations("CASE_MANAGER")).toBe(false);
      expect(canManageIntegrations("ANALYST")).toBe(false);
    });

    it("canUseCopilot", () => {
      expect(canUseCopilot("DPO")).toBe(true);
      expect(canUseCopilot("CASE_MANAGER")).toBe(true);
      expect(canUseCopilot("ANALYST")).toBe(false);
      expect(canUseCopilot("AUDITOR")).toBe(false);
    });

    it("canReadCopilot", () => {
      expect(canReadCopilot("ANALYST")).toBe(true);
      expect(canReadCopilot("AUDITOR")).toBe(true);
      expect(canReadCopilot("READ_ONLY")).toBe(false);
    });

    it("canManageGovernance", () => {
      expect(canManageGovernance("TENANT_ADMIN")).toBe(true);
      expect(canManageGovernance("DPO")).toBe(true);
      expect(canManageGovernance("CASE_MANAGER")).toBe(false);
      expect(canManageGovernance("AUDITOR")).toBe(false);
    });

    it("canViewGovernance", () => {
      expect(canViewGovernance("CASE_MANAGER")).toBe(true);
      expect(canViewGovernance("AUDITOR")).toBe(true);
      expect(canViewGovernance("ANALYST")).toBe(false);
    });

    it("canViewGovernanceReport", () => {
      expect(canViewGovernanceReport("DPO")).toBe(true);
      expect(canViewGovernanceReport("CASE_MANAGER")).toBe(false);
      expect(canViewGovernanceReport("AUDITOR")).toBe(false);
    });

    it("canManageLegalHold", () => {
      expect(canManageLegalHold("DPO")).toBe(true);
      expect(canManageLegalHold("CASE_MANAGER")).toBe(false);
    });

    it("canReviewRedaction", () => {
      expect(canReviewRedaction("DPO")).toBe(true);
      expect(canReviewRedaction("ANALYST")).toBe(false);
    });

    it("canApproveLegal", () => {
      expect(canApproveLegal("DPO")).toBe(true);
      expect(canApproveLegal("TENANT_ADMIN")).toBe(true);
      expect(canApproveLegal("CASE_MANAGER")).toBe(false);
      expect(canApproveLegal("ANALYST")).toBe(false);
    });

    it("canApproveExportStep1 / Step2", () => {
      expect(canApproveExportStep1("CASE_MANAGER")).toBe(true);
      expect(canApproveExportStep1("ANALYST")).toBe(false);
      expect(canApproveExportStep2("DPO")).toBe(true);
      expect(canApproveExportStep2("CASE_MANAGER")).toBe(false);
    });
  });
});

// ─── 3. Case Access Model ──────────────────────────────────────────────────

describe("Case Access Model", () => {
  const TENANT = "tenant-1";
  const CASE = "case-1";

  beforeEach(() => {
    resetCaseTeamStore();
  });

  describe("Global access roles", () => {
    for (const role of ["SUPER_ADMIN", "TENANT_ADMIN", "DPO"]) {
      it(`${role} can access any case`, () => {
        expect(canAccessCase({
          userId: "user-1", userRole: role, tenantId: TENANT,
          caseId: CASE, assignedToUserId: null,
        })).toBe(true);
      });

      it(`${role} can write to any case`, () => {
        expect(canAccessCase({
          userId: "user-1", userRole: role, tenantId: TENANT,
          caseId: CASE, assignedToUserId: null,
        }, "write")).toBe(true);
      });
    }
  });

  describe("AUDITOR read-only access to all cases", () => {
    it("can read any case", () => {
      expect(canAccessCase({
        userId: "auditor-1", userRole: "AUDITOR", tenantId: TENANT,
        caseId: CASE, assignedToUserId: null,
      }, "read")).toBe(true);
    });

    it("cannot write to cases", () => {
      expect(canAccessCase({
        userId: "auditor-1", userRole: "AUDITOR", tenantId: TENANT,
        caseId: CASE, assignedToUserId: null,
      }, "write")).toBe(false);
    });

    it("cannot use copilot action on cases", () => {
      expect(canAccessCase({
        userId: "auditor-1", userRole: "AUDITOR", tenantId: TENANT,
        caseId: CASE, assignedToUserId: null,
      }, "copilot")).toBe(false);
    });

    it("cannot export from cases", () => {
      expect(canAccessCase({
        userId: "auditor-1", userRole: "AUDITOR", tenantId: TENANT,
        caseId: CASE, assignedToUserId: null,
      }, "export")).toBe(false);
    });
  });

  describe("CASE_MANAGER scoped access", () => {
    it("can access if assigned", () => {
      expect(canAccessCase({
        userId: "cm-1", userRole: "CASE_MANAGER", tenantId: TENANT,
        caseId: CASE, assignedToUserId: "cm-1",
      })).toBe(true);
    });

    it("cannot access if NOT assigned and NOT team member", () => {
      expect(canAccessCase({
        userId: "cm-1", userRole: "CASE_MANAGER", tenantId: TENANT,
        caseId: CASE, assignedToUserId: "other-user",
      })).toBe(false);
    });

    it("can access if team member", () => {
      addTeamMember(TENANT, CASE, "cm-1");
      expect(canAccessCase({
        userId: "cm-1", userRole: "CASE_MANAGER", tenantId: TENANT,
        caseId: CASE, assignedToUserId: "other-user",
      })).toBe(true);
    });

    it("can write if assigned", () => {
      expect(canAccessCase({
        userId: "cm-1", userRole: "CASE_MANAGER", tenantId: TENANT,
        caseId: CASE, assignedToUserId: "cm-1",
      }, "write")).toBe(true);
    });
  });

  describe("ANALYST scoped access", () => {
    it("can access if assigned", () => {
      expect(canAccessCase({
        userId: "analyst-1", userRole: "ANALYST", tenantId: TENANT,
        caseId: CASE, assignedToUserId: "analyst-1",
      })).toBe(true);
    });

    it("cannot access unassigned cases", () => {
      expect(canAccessCase({
        userId: "analyst-1", userRole: "ANALYST", tenantId: TENANT,
        caseId: CASE, assignedToUserId: "other",
      })).toBe(false);
    });

    it("can access if added to team", () => {
      addTeamMember(TENANT, CASE, "analyst-1");
      expect(canAccessCase({
        userId: "analyst-1", userRole: "ANALYST", tenantId: TENANT,
        caseId: CASE, assignedToUserId: "other",
      })).toBe(true);
    });
  });

  describe("enforceCaseAccess() throws on denial", () => {
    it("throws for unassigned CASE_MANAGER", () => {
      expect(() => enforceCaseAccess({
        userId: "cm-1", userRole: "CASE_MANAGER", tenantId: TENANT,
        caseId: CASE, assignedToUserId: "other",
      })).toThrow();
    });

    it("does not throw for assigned CASE_MANAGER", () => {
      expect(() => enforceCaseAccess({
        userId: "cm-1", userRole: "CASE_MANAGER", tenantId: TENANT,
        caseId: CASE, assignedToUserId: "cm-1",
      })).not.toThrow();
    });
  });

  describe("enforceCasePermission() checks both permission and access", () => {
    it("ANALYST cannot create copilot runs even if assigned", () => {
      expect(() => enforceCasePermission({
        userId: "analyst-1", userRole: "ANALYST", tenantId: TENANT,
        caseId: CASE, assignedToUserId: "analyst-1",
      }, "COPILOT_RUN_CREATE")).toThrow();
    });

    it("CASE_MANAGER can create copilot runs if assigned", () => {
      expect(() => enforceCasePermission({
        userId: "cm-1", userRole: "CASE_MANAGER", tenantId: TENANT,
        caseId: CASE, assignedToUserId: "cm-1",
      }, "COPILOT_RUN_CREATE")).not.toThrow();
    });

    it("CASE_MANAGER cannot create copilot runs if not assigned", () => {
      expect(() => enforceCasePermission({
        userId: "cm-1", userRole: "CASE_MANAGER", tenantId: TENANT,
        caseId: CASE, assignedToUserId: "other",
      }, "COPILOT_RUN_CREATE")).toThrow();
    });
  });
});

// ─── 4. Case Team Membership ───────────────────────────────────────────────

describe("Case Team Membership", () => {
  const T = "t1";
  const C1 = "c1";
  const C2 = "c2";
  const U1 = "u1";
  const U2 = "u2";

  beforeEach(() => {
    resetCaseTeamStore();
  });

  it("addTeamMember and isTeamMember work", () => {
    expect(isTeamMember(T, C1, U1)).toBe(false);
    addTeamMember(T, C1, U1);
    expect(isTeamMember(T, C1, U1)).toBe(true);
  });

  it("addTeamMember is idempotent", () => {
    addTeamMember(T, C1, U1);
    addTeamMember(T, C1, U1);
    expect(getTeamMembers(T, C1)).toHaveLength(1);
  });

  it("removeTeamMember works", () => {
    addTeamMember(T, C1, U1);
    removeTeamMember(T, C1, U1);
    expect(isTeamMember(T, C1, U1)).toBe(false);
  });

  it("getTeamMembers returns all members for a case", () => {
    addTeamMember(T, C1, U1);
    addTeamMember(T, C1, U2);
    const members = getTeamMembers(T, C1);
    expect(members).toHaveLength(2);
  });

  it("getCasesForUser returns cases user belongs to", () => {
    addTeamMember(T, C1, U1);
    addTeamMember(T, C2, U1);
    const cases = getCasesForUser(T, U1);
    expect(cases).toEqual([C1, C2]);
  });

  it("cross-tenant isolation: team member in T1 not visible in T2", () => {
    addTeamMember("t1", C1, U1);
    expect(isTeamMember("t2", C1, U1)).toBe(false);
  });
});

// ─── 5. Export Gate Conditions ──────────────────────────────────────────────

describe("Export Gate Conditions", () => {
  it("blocks export when Art. 9 not approved", () => {
    const result = checkExportGate({
      containsSpecialCategory: true,
      legalApprovalStatus: "PENDING",
      hasActiveLegalHold: false,
      exportApprovalPending: false,
      twoPersonApprovalRequired: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("ART9_APPROVAL_REQUIRED");
  });

  it("allows export when Art. 9 is approved", () => {
    const result = checkExportGate({
      containsSpecialCategory: true,
      legalApprovalStatus: "APPROVED",
      hasActiveLegalHold: false,
      exportApprovalPending: false,
      twoPersonApprovalRequired: false,
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks export when legal hold active", () => {
    const result = checkExportGate({
      containsSpecialCategory: false,
      legalApprovalStatus: "NOT_REQUIRED",
      hasActiveLegalHold: true,
      exportApprovalPending: false,
      twoPersonApprovalRequired: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("LEGAL_HOLD_ACTIVE");
  });

  it("blocks export when approval pending", () => {
    const result = checkExportGate({
      containsSpecialCategory: false,
      legalApprovalStatus: "NOT_REQUIRED",
      hasActiveLegalHold: false,
      exportApprovalPending: true,
      twoPersonApprovalRequired: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("EXPORT_APPROVAL_PENDING");
  });

  it("allows export when all gates clear", () => {
    const result = checkExportGate({
      containsSpecialCategory: false,
      legalApprovalStatus: "NOT_REQUIRED",
      hasActiveLegalHold: false,
      exportApprovalPending: false,
      twoPersonApprovalRequired: false,
    });
    expect(result.allowed).toBe(true);
  });

  it("Art. 9 check takes priority over legal hold", () => {
    const result = checkExportGate({
      containsSpecialCategory: true,
      legalApprovalStatus: "PENDING",
      hasActiveLegalHold: true,
      exportApprovalPending: true,
      twoPersonApprovalRequired: true,
    });
    expect(result.code).toBe("ART9_APPROVAL_REQUIRED");
  });
});

// ─── 6. Content Scan Gate ──────────────────────────────────────────────────

describe("Content Scan Gate", () => {
  it("blocks content scan for role without permission", () => {
    const result = checkContentScanGate({
      role: "CASE_MANAGER",
      tenantAllowsContentScanning: true,
      tenantAllowsOcr: true,
      tenantAllowsLlm: true,
    }, true, false, false);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("CONTENT_SCAN_ROLE_DENIED");
  });

  it("blocks content scan when tenant disables it", () => {
    const result = checkContentScanGate({
      role: "DPO",
      tenantAllowsContentScanning: false,
      tenantAllowsOcr: true,
      tenantAllowsLlm: true,
    }, true, false, false);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("CONTENT_SCAN_TENANT_DISABLED");
  });

  it("allows content scan for DPO when tenant allows", () => {
    const result = checkContentScanGate({
      role: "DPO",
      tenantAllowsContentScanning: true,
      tenantAllowsOcr: true,
      tenantAllowsLlm: true,
    }, true, false, false);
    expect(result.allowed).toBe(true);
  });

  it("blocks OCR for ANALYST", () => {
    const result = checkContentScanGate({
      role: "ANALYST",
      tenantAllowsContentScanning: true,
      tenantAllowsOcr: true,
      tenantAllowsLlm: true,
    }, false, true, false);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("OCR_ROLE_DENIED");
  });

  it("blocks OCR when tenant disables it", () => {
    const result = checkContentScanGate({
      role: "DPO",
      tenantAllowsContentScanning: true,
      tenantAllowsOcr: false,
      tenantAllowsLlm: true,
    }, false, true, false);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("OCR_TENANT_DISABLED");
  });

  it("blocks LLM for CASE_MANAGER", () => {
    const result = checkContentScanGate({
      role: "CASE_MANAGER",
      tenantAllowsContentScanning: true,
      tenantAllowsOcr: true,
      tenantAllowsLlm: true,
    }, false, false, true);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("LLM_ROLE_DENIED");
  });

  it("blocks LLM when tenant disables it", () => {
    const result = checkContentScanGate({
      role: "DPO",
      tenantAllowsContentScanning: true,
      tenantAllowsOcr: true,
      tenantAllowsLlm: false,
    }, false, false, true);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("LLM_TENANT_DISABLED");
  });

  it("allows when nothing requested", () => {
    const result = checkContentScanGate({
      role: "READ_ONLY",
      tenantAllowsContentScanning: false,
      tenantAllowsOcr: false,
      tenantAllowsLlm: false,
    }, false, false, false);
    expect(result.allowed).toBe(true);
  });
});

// ─── 7. Cross-Tenant Access Denied ─────────────────────────────────────────

describe("Cross-Tenant Isolation", () => {
  beforeEach(() => {
    resetCaseTeamStore();
  });

  it("team membership in tenant-A does not grant access in tenant-B", () => {
    addTeamMember("tenant-A", "case-1", "user-1");
    expect(canAccessCase({
      userId: "user-1", userRole: "CASE_MANAGER",
      tenantId: "tenant-B", caseId: "case-1", assignedToUserId: null,
    })).toBe(false);
  });
});

// ─── 8. Two-Person Approval Flow ───────────────────────────────────────────

describe("Two-Person Approval Flow", () => {
  it("step1 requires CASE_MANAGER or higher", () => {
    expect(canApproveExportStep1("CASE_MANAGER")).toBe(true);
    expect(canApproveExportStep1("ANALYST")).toBe(false);
    expect(canApproveExportStep1("AUDITOR")).toBe(false);
  });

  it("step2 requires DPO or higher", () => {
    expect(canApproveExportStep2("DPO")).toBe(true);
    expect(canApproveExportStep2("TENANT_ADMIN")).toBe(true);
    expect(canApproveExportStep2("CASE_MANAGER")).toBe(false);
    expect(canApproveExportStep2("ANALYST")).toBe(false);
  });

  it("case_manager cannot approve legal gate", () => {
    expect(canApproveLegal("CASE_MANAGER")).toBe(false);
  });
});

// ─── 9. Role Matrix Summary ────────────────────────────────────────────────

describe("Role Matrix Summary", () => {
  const matrix: Array<{ role: string; permission: Permission; expected: boolean }> = [
    // Governance
    { role: "TENANT_ADMIN", permission: "GOVERNANCE_EDIT_SETTINGS", expected: true },
    { role: "DPO", permission: "GOVERNANCE_EDIT_SETTINGS", expected: true },
    { role: "CASE_MANAGER", permission: "GOVERNANCE_EDIT_SETTINGS", expected: false },
    { role: "ANALYST", permission: "GOVERNANCE_VIEW", expected: false },
    { role: "AUDITOR", permission: "GOVERNANCE_VIEW", expected: true },
    // Copilot
    { role: "CASE_MANAGER", permission: "COPILOT_RUN_CREATE", expected: true },
    { role: "ANALYST", permission: "COPILOT_RUN_CREATE", expected: false },
    { role: "ANALYST", permission: "COPILOT_RUN_EXECUTE", expected: true },
    { role: "AUDITOR", permission: "COPILOT_RUN_CREATE", expected: false },
    { role: "AUDITOR", permission: "COPILOT_RUN_VIEW", expected: true },
    // Exports
    { role: "CASE_MANAGER", permission: "EXPORT_REQUEST", expected: true },
    { role: "ANALYST", permission: "EXPORT_REQUEST", expected: false },
    { role: "AUDITOR", permission: "EXPORT_DOWNLOAD", expected: false },
    // Documents
    { role: "ANALYST", permission: "DOCUMENT_UPLOAD", expected: true },
    { role: "AUDITOR", permission: "DOCUMENT_UPLOAD", expected: false },
    { role: "AUDITOR", permission: "DOCUMENT_DOWNLOAD", expected: true },
    // Admin
    { role: "DPO", permission: "USER_MANAGEMENT", expected: false },
    { role: "TENANT_ADMIN", permission: "USER_MANAGEMENT", expected: true },
  ];

  for (const { role, permission, expected } of matrix) {
    it(`${role} ${expected ? "has" : "lacks"} ${permission}`, () => {
      expect(has(role, permission)).toBe(expected);
    });
  }
});

// ─── 10. UI Visibility Alignment ───────────────────────────────────────────

describe("UI Visibility Alignment", () => {
  it("Governance menu visible for GOVERNANCE_VIEW holders", () => {
    const governanceVisible = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO", "CASE_MANAGER", "AUDITOR"];
    const governanceHidden = ["ANALYST", "CONTRIBUTOR", "READ_ONLY"];

    for (const role of governanceVisible) {
      expect(has(role, "GOVERNANCE_VIEW")).toBe(true);
    }
    for (const role of governanceHidden) {
      expect(has(role, "GOVERNANCE_VIEW")).toBe(false);
    }
  });

  it("Copilot Run Discovery button visible only for COPILOT_RUN_CREATE", () => {
    expect(has("CASE_MANAGER", "COPILOT_RUN_CREATE")).toBe(true);
    expect(has("ANALYST", "COPILOT_RUN_CREATE")).toBe(false);
    expect(has("AUDITOR", "COPILOT_RUN_CREATE")).toBe(false);
  });

  it("Content scan toggles visible only for COPILOT_ALLOW_CONTENT_SCAN", () => {
    expect(has("DPO", "COPILOT_ALLOW_CONTENT_SCAN")).toBe(true);
    expect(has("CASE_MANAGER", "COPILOT_ALLOW_CONTENT_SCAN")).toBe(false);
    expect(has("ANALYST", "COPILOT_ALLOW_CONTENT_SCAN")).toBe(false);
  });

  it("Approval buttons visible only with relevant permissions", () => {
    expect(has("DPO", "COPILOT_LEGAL_APPROVE")).toBe(true);
    expect(has("CASE_MANAGER", "COPILOT_LEGAL_APPROVE")).toBe(false);
  });

  it("Export generate button visible only for EXPORT_GENERATE holders", () => {
    expect(has("DPO", "EXPORT_GENERATE")).toBe(true);
    expect(has("CASE_MANAGER", "EXPORT_GENERATE")).toBe(false);
  });

  it("Settings edit visible only for GOVERNANCE_EDIT_SETTINGS", () => {
    expect(has("DPO", "GOVERNANCE_EDIT_SETTINGS")).toBe(true);
    expect(has("AUDITOR", "GOVERNANCE_EDIT_SETTINGS")).toBe(false);
  });
});
