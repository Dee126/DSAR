import { describe, it, expect } from "vitest";

// ─── Redaction Type Classification Tests ─────────────────────────────────────

const REDACTION_TYPES = [
  "FULL",
  "PARTIAL",
  "THIRD_PARTY",
  "ART9_SPECIAL",
  "LEGAL_PRIVILEGE",
  "TRADE_SECRET",
] as const;

const ART9_CATEGORIES = new Set([
  "HEALTH",
  "RELIGION",
  "UNION",
  "POLITICAL_OPINION",
  "OTHER_SPECIAL_CATEGORY",
]);

function isArt9Category(category: string): boolean {
  return ART9_CATEGORIES.has(category);
}

function getRequiredRedactionType(category: string): string | null {
  if (isArt9Category(category)) return "ART9_SPECIAL";
  return null;
}

describe("Redaction Type Classification", () => {
  it("should identify all Art. 9 special categories", () => {
    expect(isArt9Category("HEALTH")).toBe(true);
    expect(isArt9Category("RELIGION")).toBe(true);
    expect(isArt9Category("UNION")).toBe(true);
    expect(isArt9Category("POLITICAL_OPINION")).toBe(true);
    expect(isArt9Category("OTHER_SPECIAL_CATEGORY")).toBe(true);
  });

  it("should not classify regular categories as Art. 9", () => {
    expect(isArt9Category("IDENTIFICATION")).toBe(false);
    expect(isArt9Category("CONTACT")).toBe(false);
    expect(isArt9Category("CONTRACT")).toBe(false);
    expect(isArt9Category("PAYMENT")).toBe(false);
    expect(isArt9Category("COMMUNICATION")).toBe(false);
    expect(isArt9Category("HR")).toBe(false);
    expect(isArt9Category("ONLINE_TECHNICAL")).toBe(false);
    expect(isArt9Category("OTHER")).toBe(false);
  });

  it("should suggest ART9_SPECIAL redaction type for Art. 9 categories", () => {
    expect(getRequiredRedactionType("HEALTH")).toBe("ART9_SPECIAL");
    expect(getRequiredRedactionType("RELIGION")).toBe("ART9_SPECIAL");
  });

  it("should not suggest redaction type for regular categories", () => {
    expect(getRequiredRedactionType("CONTACT")).toBeNull();
    expect(getRequiredRedactionType("HR")).toBeNull();
  });

  it("should cover all 6 redaction types", () => {
    expect(REDACTION_TYPES).toHaveLength(6);
    expect(REDACTION_TYPES).toContain("FULL");
    expect(REDACTION_TYPES).toContain("PARTIAL");
    expect(REDACTION_TYPES).toContain("THIRD_PARTY");
    expect(REDACTION_TYPES).toContain("ART9_SPECIAL");
    expect(REDACTION_TYPES).toContain("LEGAL_PRIVILEGE");
    expect(REDACTION_TYPES).toContain("TRADE_SECRET");
  });
});

// ─── Legal Exception Type Tests ──────────────────────────────────────────────

const EXCEPTION_TYPES = [
  "ART_15_4_RIGHTS_OF_OTHERS",
  "ART_17_3_LEGAL_OBLIGATION",
  "ART_17_3_PUBLIC_INTEREST",
  "ART_17_3_LEGAL_CLAIMS",
  "ART_23_NATIONAL_SECURITY",
  "ART_23_PUBLIC_SECURITY",
  "ART_23_JUDICIAL_PROCEEDINGS",
  "TRADE_SECRET",
  "INTELLECTUAL_PROPERTY",
  "PROFESSIONAL_PRIVILEGE",
] as const;

function getLegalBasisRef(exceptionType: string): string {
  const refs: Record<string, string> = {
    ART_15_4_RIGHTS_OF_OTHERS: "GDPR Art. 15(4)",
    ART_17_3_LEGAL_OBLIGATION: "GDPR Art. 17(3)(b)",
    ART_17_3_PUBLIC_INTEREST: "GDPR Art. 17(3)(d)",
    ART_17_3_LEGAL_CLAIMS: "GDPR Art. 17(3)(e)",
    ART_23_NATIONAL_SECURITY: "GDPR Art. 23(1)(a)",
    ART_23_PUBLIC_SECURITY: "GDPR Art. 23(1)(c)",
    ART_23_JUDICIAL_PROCEEDINGS: "GDPR Art. 23(1)(f)",
    TRADE_SECRET: "Trade Secrets Directive (EU 2016/943)",
    INTELLECTUAL_PROPERTY: "IP Rights / GDPR Art. 15(4)",
    PROFESSIONAL_PRIVILEGE: "Attorney-Client Privilege",
  };
  return refs[exceptionType] || "Unknown";
}

describe("Legal Exception Types", () => {
  it("should cover all 10 exception types", () => {
    expect(EXCEPTION_TYPES).toHaveLength(10);
  });

  it("should map each exception type to a legal basis reference", () => {
    for (const type of EXCEPTION_TYPES) {
      const ref = getLegalBasisRef(type);
      expect(ref).not.toBe("Unknown");
      expect(ref.length).toBeGreaterThan(0);
    }
  });

  it("should return correct GDPR articles for Art. 15(4) exceptions", () => {
    expect(getLegalBasisRef("ART_15_4_RIGHTS_OF_OTHERS")).toBe("GDPR Art. 15(4)");
  });

  it("should return correct GDPR articles for Art. 17(3) exceptions", () => {
    expect(getLegalBasisRef("ART_17_3_LEGAL_OBLIGATION")).toBe("GDPR Art. 17(3)(b)");
    expect(getLegalBasisRef("ART_17_3_PUBLIC_INTEREST")).toBe("GDPR Art. 17(3)(d)");
    expect(getLegalBasisRef("ART_17_3_LEGAL_CLAIMS")).toBe("GDPR Art. 17(3)(e)");
  });

  it("should return correct GDPR articles for Art. 23 exceptions", () => {
    expect(getLegalBasisRef("ART_23_NATIONAL_SECURITY")).toBe("GDPR Art. 23(1)(a)");
    expect(getLegalBasisRef("ART_23_PUBLIC_SECURITY")).toBe("GDPR Art. 23(1)(c)");
    expect(getLegalBasisRef("ART_23_JUDICIAL_PROCEEDINGS")).toBe("GDPR Art. 23(1)(f)");
  });
});

// ─── Redaction Gate / Workflow Blocking Tests ────────────────────────────────

interface GateInput {
  unapprovedRedactions: number;
  pendingSensitiveFlags: number;
  pendingExceptions: number;
  reviewState: string | null;
  hasAnyRedactions: boolean;
}

function checkGate(input: GateInput): { allowed: boolean; blockers: string[] } {
  const blockers: string[] = [];

  if (input.unapprovedRedactions > 0) {
    blockers.push(`${input.unapprovedRedactions} redaction(s) pending approval`);
  }
  if (input.pendingSensitiveFlags > 0) {
    blockers.push(`${input.pendingSensitiveFlags} sensitive data flag(s) pending review`);
  }
  if (input.pendingExceptions > 0) {
    blockers.push(`${input.pendingExceptions} legal exception(s) pending approval`);
  }
  if (input.hasAnyRedactions && input.reviewState !== "COMPLETED") {
    blockers.push("Redaction review has not been completed");
  }

  return { allowed: blockers.length === 0, blockers };
}

describe("Redaction Gate (Workflow Blocking)", () => {
  it("should allow when no redaction items exist", () => {
    const result = checkGate({
      unapprovedRedactions: 0,
      pendingSensitiveFlags: 0,
      pendingExceptions: 0,
      reviewState: null,
      hasAnyRedactions: false,
    });
    expect(result.allowed).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("should block when unapproved redactions exist", () => {
    const result = checkGate({
      unapprovedRedactions: 3,
      pendingSensitiveFlags: 0,
      pendingExceptions: 0,
      reviewState: "COMPLETED",
      hasAnyRedactions: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("3 redaction(s) pending approval");
  });

  it("should block when pending sensitive data flags exist", () => {
    const result = checkGate({
      unapprovedRedactions: 0,
      pendingSensitiveFlags: 2,
      pendingExceptions: 0,
      reviewState: "COMPLETED",
      hasAnyRedactions: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("2 sensitive data flag(s) pending review");
  });

  it("should block when pending legal exceptions exist", () => {
    const result = checkGate({
      unapprovedRedactions: 0,
      pendingSensitiveFlags: 0,
      pendingExceptions: 1,
      reviewState: "COMPLETED",
      hasAnyRedactions: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("1 legal exception(s) pending approval");
  });

  it("should block when review state is not completed and redactions exist", () => {
    const result = checkGate({
      unapprovedRedactions: 0,
      pendingSensitiveFlags: 0,
      pendingExceptions: 0,
      reviewState: "IN_REVIEW",
      hasAnyRedactions: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("Redaction review has not been completed");
  });

  it("should allow when all redactions approved and review completed", () => {
    const result = checkGate({
      unapprovedRedactions: 0,
      pendingSensitiveFlags: 0,
      pendingExceptions: 0,
      reviewState: "COMPLETED",
      hasAnyRedactions: true,
    });
    expect(result.allowed).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("should accumulate multiple blockers", () => {
    const result = checkGate({
      unapprovedRedactions: 2,
      pendingSensitiveFlags: 1,
      pendingExceptions: 3,
      reviewState: "PENDING",
      hasAnyRedactions: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toHaveLength(4);
  });
});

// ─── Legal Hold Erasure Blocking Tests ──────────────────────────────────────

interface LegalHoldState {
  enabled: boolean;
  reason?: string;
}

function checkLegalHoldBlocksErasure(holdState: LegalHoldState): { blocked: boolean; reason?: string } {
  if (holdState.enabled) {
    return {
      blocked: true,
      reason: `Legal hold is active: ${holdState.reason}. Erasure operations are blocked.`,
    };
  }
  return { blocked: false };
}

describe("Legal Hold — Erasure Blocking", () => {
  it("should block erasure when legal hold is active", () => {
    const result = checkLegalHoldBlocksErasure({
      enabled: true,
      reason: "Pending litigation reference LIT-2024-001",
    });
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("Legal hold is active");
    expect(result.reason).toContain("LIT-2024-001");
  });

  it("should allow erasure when legal hold is not active", () => {
    const result = checkLegalHoldBlocksErasure({ enabled: false });
    expect(result.blocked).toBe(false);
    expect(result.reason).toBeUndefined();
  });
});

// ─── Partial Denial Status Flow Tests ───────────────────────────────────────

const PARTIAL_DENIAL_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

function canTransitionDenial(from: string, to: string): boolean {
  return (PARTIAL_DENIAL_TRANSITIONS[from] || []).includes(to);
}

describe("Partial Denial Status Flow", () => {
  it("should allow DRAFT → SUBMITTED", () => {
    expect(canTransitionDenial("DRAFT", "SUBMITTED")).toBe(true);
  });

  it("should allow SUBMITTED → APPROVED", () => {
    expect(canTransitionDenial("SUBMITTED", "APPROVED")).toBe(true);
  });

  it("should allow SUBMITTED → REJECTED", () => {
    expect(canTransitionDenial("SUBMITTED", "REJECTED")).toBe(true);
  });

  it("should not allow DRAFT → APPROVED directly", () => {
    expect(canTransitionDenial("DRAFT", "APPROVED")).toBe(false);
  });

  it("should not allow APPROVED → any transition", () => {
    expect(canTransitionDenial("APPROVED", "DRAFT")).toBe(false);
    expect(canTransitionDenial("APPROVED", "REJECTED")).toBe(false);
  });

  it("should not allow REJECTED → any transition", () => {
    expect(canTransitionDenial("REJECTED", "DRAFT")).toBe(false);
    expect(canTransitionDenial("REJECTED", "APPROVED")).toBe(false);
  });
});

// ─── Legal Exception Status Flow Tests ──────────────────────────────────────

const EXCEPTION_TRANSITIONS: Record<string, string[]> = {
  PROPOSED: ["APPROVED", "REJECTED", "WITHDRAWN"],
  APPROVED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

function canTransitionException(from: string, to: string): boolean {
  return (EXCEPTION_TRANSITIONS[from] || []).includes(to);
}

describe("Legal Exception Status Flow", () => {
  it("should allow PROPOSED → APPROVED", () => {
    expect(canTransitionException("PROPOSED", "APPROVED")).toBe(true);
  });

  it("should allow PROPOSED → REJECTED", () => {
    expect(canTransitionException("PROPOSED", "REJECTED")).toBe(true);
  });

  it("should allow PROPOSED → WITHDRAWN", () => {
    expect(canTransitionException("PROPOSED", "WITHDRAWN")).toBe(true);
  });

  it("should not allow APPROVED → any transition", () => {
    expect(canTransitionException("APPROVED", "PROPOSED")).toBe(false);
    expect(canTransitionException("APPROVED", "REJECTED")).toBe(false);
  });

  it("should not allow REJECTED → any transition", () => {
    expect(canTransitionException("REJECTED", "PROPOSED")).toBe(false);
    expect(canTransitionException("REJECTED", "APPROVED")).toBe(false);
  });

  it("should not allow WITHDRAWN → any transition", () => {
    expect(canTransitionException("WITHDRAWN", "PROPOSED")).toBe(false);
    expect(canTransitionException("WITHDRAWN", "APPROVED")).toBe(false);
  });
});

// ─── Sensitive Data Review Status Flow Tests ────────────────────────────────

const SENSITIVE_DATA_TRANSITIONS: Record<string, string[]> = {
  FLAGGED: ["UNDER_REVIEW", "CLEARED", "REQUIRES_REDACTION"],
  UNDER_REVIEW: ["CLEARED", "REQUIRES_REDACTION"],
  CLEARED: [],
  REQUIRES_REDACTION: [],
};

function canTransitionSensitiveFlag(from: string, to: string): boolean {
  return (SENSITIVE_DATA_TRANSITIONS[from] || []).includes(to);
}

describe("Sensitive Data Flag Status Flow", () => {
  it("should allow FLAGGED → UNDER_REVIEW", () => {
    expect(canTransitionSensitiveFlag("FLAGGED", "UNDER_REVIEW")).toBe(true);
  });

  it("should allow FLAGGED → CLEARED", () => {
    expect(canTransitionSensitiveFlag("FLAGGED", "CLEARED")).toBe(true);
  });

  it("should allow FLAGGED → REQUIRES_REDACTION", () => {
    expect(canTransitionSensitiveFlag("FLAGGED", "REQUIRES_REDACTION")).toBe(true);
  });

  it("should allow UNDER_REVIEW → CLEARED", () => {
    expect(canTransitionSensitiveFlag("UNDER_REVIEW", "CLEARED")).toBe(true);
  });

  it("should allow UNDER_REVIEW → REQUIRES_REDACTION", () => {
    expect(canTransitionSensitiveFlag("UNDER_REVIEW", "REQUIRES_REDACTION")).toBe(true);
  });

  it("should not allow CLEARED → any transition", () => {
    expect(canTransitionSensitiveFlag("CLEARED", "FLAGGED")).toBe(false);
    expect(canTransitionSensitiveFlag("CLEARED", "UNDER_REVIEW")).toBe(false);
  });

  it("should not allow REQUIRES_REDACTION → any transition", () => {
    expect(canTransitionSensitiveFlag("REQUIRES_REDACTION", "FLAGGED")).toBe(false);
    expect(canTransitionSensitiveFlag("REQUIRES_REDACTION", "CLEARED")).toBe(false);
  });
});

// ─── RBAC Permission Tests ──────────────────────────────────────────────────

const ROLE_REDACTION_PERMISSIONS: Record<string, Set<string>> = {
  SUPER_ADMIN: new Set(["SENSITIVE_DATA_VIEW", "SENSITIVE_DATA_FLAG", "SENSITIVE_DATA_REVIEW",
    "LEGAL_EXCEPTION_VIEW", "LEGAL_EXCEPTION_PROPOSE", "LEGAL_EXCEPTION_APPROVE",
    "PARTIAL_DENIAL_VIEW", "PARTIAL_DENIAL_CREATE", "PARTIAL_DENIAL_APPROVE",
    "REDACTION_REVIEW_STATE_VIEW", "REDACTION_REVIEW_STATE_MANAGE"]),
  TENANT_ADMIN: new Set(["SENSITIVE_DATA_VIEW", "SENSITIVE_DATA_FLAG", "SENSITIVE_DATA_REVIEW",
    "LEGAL_EXCEPTION_VIEW", "LEGAL_EXCEPTION_PROPOSE", "LEGAL_EXCEPTION_APPROVE",
    "PARTIAL_DENIAL_VIEW", "PARTIAL_DENIAL_CREATE", "PARTIAL_DENIAL_APPROVE",
    "REDACTION_REVIEW_STATE_VIEW", "REDACTION_REVIEW_STATE_MANAGE"]),
  DPO: new Set(["SENSITIVE_DATA_VIEW", "SENSITIVE_DATA_FLAG", "SENSITIVE_DATA_REVIEW",
    "LEGAL_EXCEPTION_VIEW", "LEGAL_EXCEPTION_PROPOSE", "LEGAL_EXCEPTION_APPROVE",
    "PARTIAL_DENIAL_VIEW", "PARTIAL_DENIAL_CREATE", "PARTIAL_DENIAL_APPROVE",
    "REDACTION_REVIEW_STATE_VIEW", "REDACTION_REVIEW_STATE_MANAGE"]),
  CASE_MANAGER: new Set(["SENSITIVE_DATA_VIEW", "SENSITIVE_DATA_FLAG",
    "LEGAL_EXCEPTION_VIEW", "LEGAL_EXCEPTION_PROPOSE",
    "PARTIAL_DENIAL_VIEW", "PARTIAL_DENIAL_CREATE",
    "REDACTION_REVIEW_STATE_VIEW"]),
  ANALYST: new Set(["SENSITIVE_DATA_VIEW", "LEGAL_EXCEPTION_VIEW",
    "PARTIAL_DENIAL_VIEW", "REDACTION_REVIEW_STATE_VIEW"]),
  AUDITOR: new Set(["SENSITIVE_DATA_VIEW", "LEGAL_EXCEPTION_VIEW",
    "PARTIAL_DENIAL_VIEW", "REDACTION_REVIEW_STATE_VIEW"]),
  READ_ONLY: new Set([]),
};

describe("RBAC — Redaction Permissions", () => {
  it("should give SUPER_ADMIN all 11 redaction permissions", () => {
    expect(ROLE_REDACTION_PERMISSIONS.SUPER_ADMIN.size).toBe(11);
  });

  it("should give DPO all 11 redaction permissions", () => {
    expect(ROLE_REDACTION_PERMISSIONS.DPO.size).toBe(11);
  });

  it("should give CASE_MANAGER 7 redaction permissions (no approve/manage)", () => {
    expect(ROLE_REDACTION_PERMISSIONS.CASE_MANAGER.size).toBe(7);
    expect(ROLE_REDACTION_PERMISSIONS.CASE_MANAGER.has("LEGAL_EXCEPTION_APPROVE")).toBe(false);
    expect(ROLE_REDACTION_PERMISSIONS.CASE_MANAGER.has("PARTIAL_DENIAL_APPROVE")).toBe(false);
    expect(ROLE_REDACTION_PERMISSIONS.CASE_MANAGER.has("SENSITIVE_DATA_REVIEW")).toBe(false);
    expect(ROLE_REDACTION_PERMISSIONS.CASE_MANAGER.has("REDACTION_REVIEW_STATE_MANAGE")).toBe(false);
  });

  it("should give ANALYST view-only permissions (4)", () => {
    expect(ROLE_REDACTION_PERMISSIONS.ANALYST.size).toBe(4);
    expect(ROLE_REDACTION_PERMISSIONS.ANALYST.has("SENSITIVE_DATA_VIEW")).toBe(true);
    expect(ROLE_REDACTION_PERMISSIONS.ANALYST.has("SENSITIVE_DATA_FLAG")).toBe(false);
  });

  it("should give READ_ONLY no redaction permissions", () => {
    expect(ROLE_REDACTION_PERMISSIONS.READ_ONLY.size).toBe(0);
  });

  it("should allow DPO to review sensitive data", () => {
    expect(ROLE_REDACTION_PERMISSIONS.DPO.has("SENSITIVE_DATA_REVIEW")).toBe(true);
  });

  it("should allow TENANT_ADMIN to approve legal exceptions", () => {
    expect(ROLE_REDACTION_PERMISSIONS.TENANT_ADMIN.has("LEGAL_EXCEPTION_APPROVE")).toBe(true);
  });

  it("should allow CASE_MANAGER to propose legal exceptions but not approve", () => {
    expect(ROLE_REDACTION_PERMISSIONS.CASE_MANAGER.has("LEGAL_EXCEPTION_PROPOSE")).toBe(true);
    expect(ROLE_REDACTION_PERMISSIONS.CASE_MANAGER.has("LEGAL_EXCEPTION_APPROVE")).toBe(false);
  });
});

// ─── Redaction Summary Builder Tests ────────────────────────────────────────

interface RedactionSummary {
  totalRedactions: number;
  approvedRedactions: number;
  redactionTypes: string[];
  totalSensitiveFlags: number;
  pendingSensitiveFlags: number;
  legalExceptions: Array<{ type: string; status: string; scope: string }>;
  partialDenials: Array<{ sectionKey: string; status: string; legalBasis: string }>;
  reviewState: string | null;
}

function isRedactionSummaryClear(summary: RedactionSummary): boolean {
  return (
    summary.totalRedactions === summary.approvedRedactions &&
    summary.pendingSensitiveFlags === 0 &&
    summary.legalExceptions.every((e) => e.status !== "PROPOSED") &&
    summary.reviewState === "COMPLETED"
  );
}

describe("Redaction Summary", () => {
  it("should report clear when all items resolved", () => {
    const summary: RedactionSummary = {
      totalRedactions: 5,
      approvedRedactions: 5,
      redactionTypes: ["FULL", "THIRD_PARTY"],
      totalSensitiveFlags: 3,
      pendingSensitiveFlags: 0,
      legalExceptions: [
        { type: "ART_15_4_RIGHTS_OF_OTHERS", status: "APPROVED", scope: "email data" },
      ],
      partialDenials: [
        { sectionKey: "data_summary", status: "APPROVED", legalBasis: "Art. 15(4)" },
      ],
      reviewState: "COMPLETED",
    };
    expect(isRedactionSummaryClear(summary)).toBe(true);
  });

  it("should report not clear when redactions are unapproved", () => {
    const summary: RedactionSummary = {
      totalRedactions: 5,
      approvedRedactions: 3,
      redactionTypes: [],
      totalSensitiveFlags: 0,
      pendingSensitiveFlags: 0,
      legalExceptions: [],
      partialDenials: [],
      reviewState: "COMPLETED",
    };
    expect(isRedactionSummaryClear(summary)).toBe(false);
  });

  it("should report not clear when sensitive flags are pending", () => {
    const summary: RedactionSummary = {
      totalRedactions: 0,
      approvedRedactions: 0,
      redactionTypes: [],
      totalSensitiveFlags: 2,
      pendingSensitiveFlags: 1,
      legalExceptions: [],
      partialDenials: [],
      reviewState: "COMPLETED",
    };
    expect(isRedactionSummaryClear(summary)).toBe(false);
  });

  it("should report not clear when exceptions are proposed", () => {
    const summary: RedactionSummary = {
      totalRedactions: 0,
      approvedRedactions: 0,
      redactionTypes: [],
      totalSensitiveFlags: 0,
      pendingSensitiveFlags: 0,
      legalExceptions: [
        { type: "TRADE_SECRET", status: "PROPOSED", scope: "algorithm" },
      ],
      partialDenials: [],
      reviewState: "COMPLETED",
    };
    expect(isRedactionSummaryClear(summary)).toBe(false);
  });

  it("should report not clear when review state is not COMPLETED", () => {
    const summary: RedactionSummary = {
      totalRedactions: 2,
      approvedRedactions: 2,
      redactionTypes: ["FULL"],
      totalSensitiveFlags: 0,
      pendingSensitiveFlags: 0,
      legalExceptions: [],
      partialDenials: [],
      reviewState: "IN_REVIEW",
    };
    expect(isRedactionSummaryClear(summary)).toBe(false);
  });
});
