import { describe, it, expect, vi } from "vitest";

// ─── Mock Prisma before imports ─────────────────────────────────────────────
vi.mock("@/lib/prisma", () => ({
  prisma: {
    searchIndexEntry: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    dSARCase: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    incident: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    vendorRequest: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    document: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    system: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    intakeSubmission: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    responseDocument: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { maskEmail, getDeepLink } from "@/lib/search-index-service";
import { has, enforce, hasPermission } from "@/lib/rbac";
import {
  searchQuerySchema,
  createSavedSearchSchema,
  updateSavedSearchSchema,
  ediscoveryQuerySchema,
} from "@/lib/validation";

// ─── 1. SearchIndexService: maskEmail ───────────────────────────────────────

describe("SearchIndexService – maskEmail", () => {
  it("masks a standard email address", () => {
    expect(maskEmail("daniel.schormann@gmail.com")).toBe("da***@gmail.com");
  });

  it("masks a short local part", () => {
    // "ab" has length 2, so visible = local[0] = "a"
    expect(maskEmail("ab@domain.com")).toBe("a***@domain.com");
  });

  it("masks a single-char local part", () => {
    expect(maskEmail("x@test.org")).toBe("x***@test.org");
  });

  it("handles edge case with no @", () => {
    expect(maskEmail("noemail")).toBe("***");
  });

  it("handles @ at start", () => {
    expect(maskEmail("@domain.com")).toBe("***");
  });
});

// ─── 2. SearchIndexService: getDeepLink ────────────────────────────────────

describe("SearchIndexService – getDeepLink", () => {
  it("returns /cases/:id for CASE type", () => {
    expect(getDeepLink("CASE", "abc123")).toBe("/cases/abc123");
  });

  it("returns incident link for INCIDENT type", () => {
    expect(getDeepLink("INCIDENT", "inc1")).toBe("/governance/incidents?id=inc1");
  });

  it("returns system link for SYSTEM type", () => {
    expect(getDeepLink("SYSTEM", "sys1")).toBe("/data-inventory/sys1");
  });

  it("returns vendor link with caseId from metadata", () => {
    expect(getDeepLink("VENDOR_REQUEST", "vr1", { caseId: "c1" })).toBe("/cases/c1?tab=vendors");
  });

  it("returns generic vendor link without caseId", () => {
    expect(getDeepLink("VENDOR_REQUEST", "vr1")).toBe("/governance/vendors");
  });

  it("returns document link with caseId from metadata", () => {
    expect(getDeepLink("DOCUMENT", "d1", { caseId: "c1" })).toBe("/cases/c1?tab=documents");
  });

  it("returns intake link for INTAKE type", () => {
    expect(getDeepLink("INTAKE", "ink1")).toBe("/intake?id=ink1");
  });

  it("returns response link with caseId from metadata", () => {
    expect(getDeepLink("RESPONSE", "r1", { caseId: "c1" })).toBe("/cases/c1?tab=response");
  });

  it("returns audit link for AUDIT type", () => {
    expect(getDeepLink("AUDIT", "a1")).toBe("/governance/assurance?tab=audit");
  });

  it("returns /search for unknown type", () => {
    expect(getDeepLink("UNKNOWN" as any, "x")).toBe("/search");
  });
});

// ─── 3. RBAC – Fine-Grained Permissions ────────────────────────────────────

describe("RBAC – Search & eDiscovery Permissions", () => {
  // SUPER_ADMIN
  it("SUPER_ADMIN has SEARCH_GLOBAL", () => expect(has("SUPER_ADMIN", "SEARCH_GLOBAL")).toBe(true));
  it("SUPER_ADMIN has SEARCH_AUDIT", () => expect(has("SUPER_ADMIN", "SEARCH_AUDIT")).toBe(true));
  it("SUPER_ADMIN has EDISCOVERY_VIEW", () => expect(has("SUPER_ADMIN", "EDISCOVERY_VIEW")).toBe(true));
  it("SUPER_ADMIN has EDISCOVERY_EXPORT", () => expect(has("SUPER_ADMIN", "EDISCOVERY_EXPORT")).toBe(true));
  it("SUPER_ADMIN has SEARCH_INDEX_REBUILD", () => expect(has("SUPER_ADMIN", "SEARCH_INDEX_REBUILD")).toBe(true));
  it("SUPER_ADMIN has SEARCH_SAVED_MANAGE", () => expect(has("SUPER_ADMIN", "SEARCH_SAVED_MANAGE")).toBe(true));

  // TENANT_ADMIN
  it("TENANT_ADMIN has SEARCH_GLOBAL", () => expect(has("TENANT_ADMIN", "SEARCH_GLOBAL")).toBe(true));
  it("TENANT_ADMIN has SEARCH_INDEX_REBUILD", () => expect(has("TENANT_ADMIN", "SEARCH_INDEX_REBUILD")).toBe(true));

  // DPO
  it("DPO has SEARCH_GLOBAL", () => expect(has("DPO", "SEARCH_GLOBAL")).toBe(true));
  it("DPO has SEARCH_AUDIT", () => expect(has("DPO", "SEARCH_AUDIT")).toBe(true));
  it("DPO has EDISCOVERY_VIEW", () => expect(has("DPO", "EDISCOVERY_VIEW")).toBe(true));
  it("DPO does NOT have SEARCH_INDEX_REBUILD", () => expect(has("DPO", "SEARCH_INDEX_REBUILD")).toBe(false));

  // CASE_MANAGER
  it("CASE_MANAGER has SEARCH_GLOBAL", () => expect(has("CASE_MANAGER", "SEARCH_GLOBAL")).toBe(true));
  it("CASE_MANAGER has SEARCH_SAVED_CREATE", () => expect(has("CASE_MANAGER", "SEARCH_SAVED_CREATE")).toBe(true));
  it("CASE_MANAGER does NOT have SEARCH_AUDIT", () => expect(has("CASE_MANAGER", "SEARCH_AUDIT")).toBe(false));
  it("CASE_MANAGER does NOT have EDISCOVERY_VIEW", () => expect(has("CASE_MANAGER", "EDISCOVERY_VIEW")).toBe(false));

  // AUDITOR
  it("AUDITOR has SEARCH_GLOBAL", () => expect(has("AUDITOR", "SEARCH_GLOBAL")).toBe(true));
  it("AUDITOR has SEARCH_AUDIT", () => expect(has("AUDITOR", "SEARCH_AUDIT")).toBe(true));
  it("AUDITOR has EDISCOVERY_VIEW", () => expect(has("AUDITOR", "EDISCOVERY_VIEW")).toBe(true));
  it("AUDITOR has EDISCOVERY_EXPORT", () => expect(has("AUDITOR", "EDISCOVERY_EXPORT")).toBe(true));
  it("AUDITOR does NOT have SEARCH_SAVED_CREATE", () => expect(has("AUDITOR", "SEARCH_SAVED_CREATE")).toBe(false));

  // READ_ONLY
  it("READ_ONLY has SEARCH_GLOBAL", () => expect(has("READ_ONLY", "SEARCH_GLOBAL")).toBe(true));
  it("READ_ONLY has SEARCH_SAVED_VIEW", () => expect(has("READ_ONLY", "SEARCH_SAVED_VIEW")).toBe(true));
  it("READ_ONLY does NOT have SEARCH_AUDIT", () => expect(has("READ_ONLY", "SEARCH_AUDIT")).toBe(false));
  it("READ_ONLY does NOT have EDISCOVERY_VIEW", () => expect(has("READ_ONLY", "EDISCOVERY_VIEW")).toBe(false));
  it("READ_ONLY does NOT have SEARCH_SAVED_CREATE", () => expect(has("READ_ONLY", "SEARCH_SAVED_CREATE")).toBe(false));

  // CONTRIBUTOR
  it("CONTRIBUTOR has SEARCH_GLOBAL", () => expect(has("CONTRIBUTOR", "SEARCH_GLOBAL")).toBe(true));
  it("CONTRIBUTOR has SEARCH_SAVED_VIEW", () => expect(has("CONTRIBUTOR", "SEARCH_SAVED_VIEW")).toBe(true));
  it("CONTRIBUTOR does NOT have SEARCH_AUDIT", () => expect(has("CONTRIBUTOR", "SEARCH_AUDIT")).toBe(false));

  // ANALYST
  it("ANALYST has SEARCH_GLOBAL", () => expect(has("ANALYST", "SEARCH_GLOBAL")).toBe(true));
  it("ANALYST does NOT have SEARCH_AUDIT", () => expect(has("ANALYST", "SEARCH_AUDIT")).toBe(false));

  // enforce()
  it("enforce throws for READ_ONLY + SEARCH_AUDIT", () => {
    expect(() => enforce("READ_ONLY", "SEARCH_AUDIT")).toThrow("Forbidden");
  });
  it("enforce does not throw for TENANT_ADMIN + SEARCH_GLOBAL", () => {
    expect(() => enforce("TENANT_ADMIN", "SEARCH_GLOBAL")).not.toThrow();
  });
});

// ─── 4. Legacy RBAC Map ────────────────────────────────────────────────────

describe("RBAC – Legacy Map: search resources", () => {
  it("TENANT_ADMIN can read search", () => expect(hasPermission("TENANT_ADMIN", "search", "read")).toBe(true));
  it("TENANT_ADMIN can manage search", () => expect(hasPermission("TENANT_ADMIN", "search", "manage")).toBe(true));
  it("READ_ONLY can read search", () => expect(hasPermission("READ_ONLY", "search", "read")).toBe(true));
  it("READ_ONLY cannot manage search", () => expect(hasPermission("READ_ONLY", "search", "manage")).toBe(false));
  it("AUDITOR can read ediscovery", () => expect(hasPermission("AUDITOR", "ediscovery", "read")).toBe(true));
  it("CASE_MANAGER cannot read ediscovery", () => expect(hasPermission("CASE_MANAGER", "ediscovery", "read")).toBe(false));
  it("DPO can read search_audit", () => expect(hasPermission("DPO", "search_audit", "read")).toBe(true));
  it("READ_ONLY cannot read search_audit", () => expect(hasPermission("READ_ONLY", "search_audit", "read")).toBe(false));
  it("CASE_MANAGER can create saved_searches", () => expect(hasPermission("CASE_MANAGER", "saved_searches", "create")).toBe(true));
  it("READ_ONLY can read saved_searches", () => expect(hasPermission("READ_ONLY", "saved_searches", "read")).toBe(true));
  it("READ_ONLY cannot create saved_searches", () => expect(hasPermission("READ_ONLY", "saved_searches", "create")).toBe(false));
});

// ─── 5. Validation Schemas ─────────────────────────────────────────────────

describe("Validation – searchQuerySchema", () => {
  it("accepts empty query with defaults", () => {
    const result = searchQuerySchema.parse({});
    expect(result.q).toBe("");
    expect(result.scope).toBe("ALL");
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.sort).toBe("relevance");
  });

  it("accepts valid full query", () => {
    const result = searchQuerySchema.parse({
      q: "test search",
      scope: "CASES",
      sort: "updated_at",
      page: 2,
      pageSize: 50,
      filters: { status: "NEW", risk: "red" },
    });
    expect(result.q).toBe("test search");
    expect(result.scope).toBe("CASES");
    expect(result.filters.status).toBe("NEW");
    expect(result.filters.risk).toBe("red");
  });

  it("rejects invalid scope", () => {
    expect(() => searchQuerySchema.parse({ scope: "INVALID" })).toThrow();
  });

  it("rejects invalid sort", () => {
    expect(() => searchQuerySchema.parse({ sort: "invalid_sort" })).toThrow();
  });

  it("rejects pageSize > 100", () => {
    expect(() => searchQuerySchema.parse({ pageSize: 200 })).toThrow();
  });

  it("rejects q > 500 chars", () => {
    expect(() => searchQuerySchema.parse({ q: "x".repeat(501) })).toThrow();
  });
});

describe("Validation – createSavedSearchSchema", () => {
  it("accepts valid input", () => {
    const result = createSavedSearchSchema.parse({
      name: "My search",
      queryText: "test",
      visibility: "TEAM",
    });
    expect(result.name).toBe("My search");
    expect(result.visibility).toBe("TEAM");
  });

  it("requires name", () => {
    expect(() => createSavedSearchSchema.parse({})).toThrow();
  });

  it("rejects empty name", () => {
    expect(() => createSavedSearchSchema.parse({ name: "" })).toThrow();
  });

  it("defaults visibility to PRIVATE", () => {
    const result = createSavedSearchSchema.parse({ name: "test" });
    expect(result.visibility).toBe("PRIVATE");
  });

  it("defaults pinned to false", () => {
    const result = createSavedSearchSchema.parse({ name: "test" });
    expect(result.pinned).toBe(false);
  });
});

describe("Validation – updateSavedSearchSchema", () => {
  it("accepts partial updates", () => {
    const result = updateSavedSearchSchema.parse({ pinned: true });
    expect(result.pinned).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updateSavedSearchSchema.parse({});
    expect(result).toBeDefined();
  });
});

describe("Validation – ediscoveryQuerySchema", () => {
  it("accepts valid case-based query", () => {
    const result = ediscoveryQuerySchema.parse({
      caseId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.caseId).toBeDefined();
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
  });

  it("accepts valid incident-based query", () => {
    const result = ediscoveryQuerySchema.parse({
      incidentId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.incidentId).toBeDefined();
  });

  it("accepts export format csv", () => {
    const result = ediscoveryQuerySchema.parse({
      caseId: "550e8400-e29b-41d4-a716-446655440000",
      exportFormat: "csv",
    });
    expect(result.exportFormat).toBe("csv");
  });

  it("accepts export format json", () => {
    const result = ediscoveryQuerySchema.parse({
      caseId: "550e8400-e29b-41d4-a716-446655440000",
      exportFormat: "json",
    });
    expect(result.exportFormat).toBe("json");
  });

  it("rejects invalid export format", () => {
    expect(() =>
      ediscoveryQuerySchema.parse({
        caseId: "550e8400-e29b-41d4-a716-446655440000",
        exportFormat: "xml",
      })
    ).toThrow();
  });

  it("accepts event type filters", () => {
    const result = ediscoveryQuerySchema.parse({
      caseId: "550e8400-e29b-41d4-a716-446655440000",
      eventTypes: ["CASE_CREATED", "STATUS_CHANGE"],
    });
    expect(result.eventTypes).toHaveLength(2);
  });
});

// ─── 6. Data Minimization Tests ────────────────────────────────────────────

describe("Data Minimization", () => {
  it("never includes full email in masked output", () => {
    const masked = maskEmail("john.doe@company.com");
    expect(masked).not.toContain("john.doe");
    expect(masked).toContain("@company.com");
    expect(masked).toContain("***");
  });

  it("preserves domain for audit traceability", () => {
    expect(maskEmail("user@example.org")).toContain("@example.org");
  });

  it("handles corporate email patterns", () => {
    const masked = maskEmail("firstname.lastname@corp.co.uk");
    expect(masked).toContain("@corp.co.uk");
    expect(masked).not.toContain("firstname.lastname");
  });
});

// ─── 7. AUDIT Scope Filtering ──────────────────────────────────────────────

describe("AUDIT scope filtering by role", () => {
  const ALL_TYPES = ["CASE", "INCIDENT", "VENDOR_REQUEST", "DOCUMENT", "SYSTEM", "INTAKE", "RESPONSE", "AUDIT"];

  it("READ_ONLY cannot see AUDIT results", () => {
    const filtered = ALL_TYPES.filter((t) => t !== "AUDIT" || has("READ_ONLY", "SEARCH_AUDIT"));
    expect(filtered).not.toContain("AUDIT");
    expect(filtered).toHaveLength(7);
  });

  it("TENANT_ADMIN can see AUDIT results", () => {
    const filtered = ALL_TYPES.filter((t) => t !== "AUDIT" || has("TENANT_ADMIN", "SEARCH_AUDIT"));
    expect(filtered).toContain("AUDIT");
    expect(filtered).toHaveLength(8);
  });

  it("DPO can see AUDIT results", () => {
    const filtered = ALL_TYPES.filter((t) => t !== "AUDIT" || has("DPO", "SEARCH_AUDIT"));
    expect(filtered).toContain("AUDIT");
    expect(filtered).toHaveLength(8);
  });

  it("CASE_MANAGER cannot see AUDIT results", () => {
    const filtered = ALL_TYPES.filter((t) => t !== "AUDIT" || has("CASE_MANAGER", "SEARCH_AUDIT"));
    expect(filtered).not.toContain("AUDIT");
    expect(filtered).toHaveLength(7);
  });

  it("AUDITOR can see AUDIT results", () => {
    const filtered = ALL_TYPES.filter((t) => t !== "AUDIT" || has("AUDITOR", "SEARCH_AUDIT"));
    expect(filtered).toContain("AUDIT");
    expect(filtered).toHaveLength(8);
  });
});
