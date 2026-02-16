/**
 * Security Regression Tests — Sprint 9.2
 *
 * Tests for:
 * 1. Policy Engine (deny-by-default)
 * 2. Tenant Isolation (TenantGuard)
 * 3. RBAC per role
 * 4. Rate Limiting
 * 5. Public Portal Token Abuse
 */

import { describe, it, expect, beforeEach } from "vitest";

// ─── Policy Engine Tests ─────────────────────────────────────────────────────

import {
  canPerform,
  canManageGovernance,
  canCreateExports,
  enforcePolicy,
  type PolicyActor,
  type PolicyDecision,
} from "@/lib/security/policy-engine";

describe("Policy Engine — Deny by Default", () => {
  const admin: PolicyActor = { id: "u1", tenantId: "t1", role: "SUPER_ADMIN" };
  const tenantAdmin: PolicyActor = { id: "u2", tenantId: "t1", role: "TENANT_ADMIN" };
  const dpo: PolicyActor = { id: "u3", tenantId: "t1", role: "DPO" };
  const caseManager: PolicyActor = { id: "u4", tenantId: "t1", role: "CASE_MANAGER" };
  const analyst: PolicyActor = { id: "u5", tenantId: "t1", role: "ANALYST" };
  const auditor: PolicyActor = { id: "u6", tenantId: "t1", role: "AUDITOR" };
  const readOnly: PolicyActor = { id: "u7", tenantId: "t1", role: "READ_ONLY" };
  const contributor: PolicyActor = { id: "u8", tenantId: "t1", role: "CONTRIBUTOR" };
  const noRole: PolicyActor = { id: "u9", tenantId: "t1", role: "" };

  describe("canPerform — RBAC checks", () => {
    it("should deny access when no role is assigned", () => {
      const result = canPerform(noRole, "CASES_READ");
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("NO_ROLE");
    });

    it("should deny unknown role", () => {
      const unknown: PolicyActor = { id: "u99", tenantId: "t1", role: "NONEXISTENT" };
      const result = canPerform(unknown, "CASES_READ");
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("RBAC_DENY");
    });

    it("SUPER_ADMIN can do everything", () => {
      expect(canPerform(admin, "CASES_READ").allowed).toBe(true);
      expect(canPerform(admin, "CASES_DELETE").allowed).toBe(true);
      expect(canPerform(admin, "USER_MANAGEMENT").allowed).toBe(true);
      expect(canPerform(admin, "GOVERNANCE_EDIT_SETTINGS").allowed).toBe(true);
      expect(canPerform(admin, "EXPORT_DOWNLOAD").allowed).toBe(true);
    });

    it("READ_ONLY cannot create cases", () => {
      expect(canPerform(readOnly, "CASES_CREATE").allowed).toBe(false);
    });

    it("READ_ONLY can read cases", () => {
      expect(canPerform(readOnly, "CASES_READ").allowed).toBe(true);
    });

    it("AUDITOR cannot export", () => {
      expect(canPerform(auditor, "EXPORT_REQUEST").allowed).toBe(false);
      expect(canPerform(auditor, "EXPORT_GENERATE").allowed).toBe(false);
    });

    it("AUDITOR can read audit logs", () => {
      expect(canPerform(auditor, "AUDIT_LOGS_READ").allowed).toBe(true);
    });

    it("ANALYST cannot delete cases", () => {
      expect(canPerform(analyst, "CASES_DELETE").allowed).toBe(false);
    });

    it("ANALYST cannot manage users", () => {
      expect(canPerform(analyst, "USER_MANAGEMENT").allowed).toBe(false);
    });

    it("CASE_MANAGER cannot manage governance", () => {
      expect(canManageGovernance(caseManager).allowed).toBe(false);
    });

    it("DPO can manage governance", () => {
      expect(canManageGovernance(dpo).allowed).toBe(true);
    });

    it("CONTRIBUTOR cannot create exports", () => {
      expect(canCreateExports(contributor).allowed).toBe(false);
    });

    it("CASE_MANAGER can create exports", () => {
      expect(canCreateExports(caseManager).allowed).toBe(true);
    });
  });

  describe("enforcePolicy", () => {
    it("should not throw for allowed decisions", () => {
      expect(() => enforcePolicy({ allowed: true, reason: "ok", code: "OK" })).not.toThrow();
    });

    it("should throw ApiError(403) for RBAC denials", () => {
      try {
        enforcePolicy({ allowed: false, reason: "Missing permission", code: "RBAC_DENY" });
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
      }
    });

    it("should throw ApiError(404) for resource-scoped denials (prevent enumeration)", () => {
      try {
        enforcePolicy({ allowed: false, reason: "Not found", code: "ARTIFACT_NOT_FOUND" });
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
      }
    });

    it("should throw ApiError(404) for case access denials", () => {
      try {
        enforcePolicy({ allowed: false, reason: "No access", code: "CASE_ACCESS_DENY" });
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
      }
    });
  });
});

// ─── Tenant Guard Tests ──────────────────────────────────────────────────────

import {
  assertTenantScoped,
  tenantWhere,
  tenantEntityWhere,
  getTenantIdFromSession,
} from "@/lib/security/tenant-guard";

describe("Tenant Guard — Isolation", () => {
  describe("assertTenantScoped", () => {
    it("should pass for matching tenant", () => {
      const entity = { id: "e1", tenantId: "t1", name: "Test" };
      expect(() => assertTenantScoped(entity, "t1")).not.toThrow();
    });

    it("should throw 404 for mismatched tenant (prevents enumeration)", () => {
      const entity = { id: "e1", tenantId: "t2", name: "Other Tenant" };
      try {
        assertTenantScoped(entity, "t1", "Document");
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe("Document not found");
      }
    });

    it("should throw 404 for null entity", () => {
      try {
        assertTenantScoped(null, "t1", "Case");
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe("Case not found");
      }
    });

    it("should throw 404 for undefined entity", () => {
      try {
        assertTenantScoped(undefined, "t1");
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
      }
    });
  });

  describe("tenantWhere", () => {
    it("should always include tenantId in WHERE clause", () => {
      const where = tenantWhere("t1");
      expect(where.tenantId).toBe("t1");
    });

    it("should merge additional filters", () => {
      const where = tenantWhere("t1", { status: "NEW", priority: "HIGH" });
      expect(where.tenantId).toBe("t1");
      expect(where.status).toBe("NEW");
      expect(where.priority).toBe("HIGH");
    });
  });

  describe("tenantEntityWhere", () => {
    it("should include both id and tenantId", () => {
      const where = tenantEntityWhere("t1", "e1");
      expect(where.id).toBe("e1");
      expect(where.tenantId).toBe("t1");
    });

    it("should merge additional filters", () => {
      const where = tenantEntityWhere("t1", "e1", { deletedAt: null });
      expect(where.id).toBe("e1");
      expect(where.tenantId).toBe("t1");
      expect(where.deletedAt).toBeNull();
    });
  });

  describe("getTenantIdFromSession", () => {
    it("should return tenantId when present", () => {
      expect(getTenantIdFromSession({ tenantId: "t1" })).toBe("t1");
    });

    it("should throw 401 when tenantId is missing", () => {
      try {
        getTenantIdFromSession({});
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.statusCode).toBe(401);
      }
    });
  });
});

// ─── Multi-Tenant Leakage Tests ──────────────────────────────────────────────

describe("Multi-Tenant Leakage Prevention", () => {
  it("tenant1 user's entity should be invisible to tenant2", () => {
    const tenant1Entity = { id: "doc1", tenantId: "tenant-1" };
    const tenant2User = { tenantId: "tenant-2" };

    expect(() =>
      assertTenantScoped(tenant1Entity, tenant2User.tenantId, "Document")
    ).toThrow();

    try {
      assertTenantScoped(tenant1Entity, tenant2User.tenantId, "Document");
    } catch (err: any) {
      // Must return 404, not 403 — no information leakage
      expect(err.statusCode).toBe(404);
      expect(err.message).not.toContain("tenant");
      expect(err.message).not.toContain("forbidden");
    }
  });

  it("tenantWhere always scopes queries to tenant", () => {
    const where = tenantWhere("tenant-1", { status: "NEW" });
    expect(where.tenantId).toBe("tenant-1");
    // Cannot accidentally query across tenants
    expect(Object.keys(where)).toContain("tenantId");
  });
});

// ─── Rate Limiter Tests ──────────────────────────────────────────────────────

import {
  checkRateLimit,
  hashIpForRateLimit,
  rateKey,
  RATE_LIMITS,
} from "@/lib/security/rate-limiter";

describe("Rate Limiter", () => {
  describe("hashIpForRateLimit", () => {
    it("should produce consistent hashes", () => {
      const hash1 = hashIpForRateLimit("192.168.1.1");
      const hash2 = hashIpForRateLimit("192.168.1.1");
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different IPs", () => {
      const hash1 = hashIpForRateLimit("192.168.1.1");
      const hash2 = hashIpForRateLimit("10.0.0.1");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("rateKey", () => {
    it("should combine parts with colons", () => {
      expect(rateKey("intake", "tenant1", "abc123")).toBe("intake:tenant1:abc123");
    });

    it("should skip empty parts", () => {
      expect(rateKey("intake", "", "abc")).toBe("intake:abc");
    });
  });

  describe("checkRateLimit", () => {
    it("should allow requests within limit", () => {
      const bucket = `test-${Date.now()}-allow`;
      const config = { windowMs: 60_000, maxRequests: 5 };

      const result = checkRateLimit(bucket, "key1", config);
      expect(result.remaining).toBe(4);
    });

    it("should decrement remaining count", () => {
      const bucket = `test-${Date.now()}-decrement`;
      const config = { windowMs: 60_000, maxRequests: 5 };

      checkRateLimit(bucket, "key1", config);
      checkRateLimit(bucket, "key1", config);
      const result = checkRateLimit(bucket, "key1", config);
      expect(result.remaining).toBe(2);
    });

    it("should throw 429 when limit exceeded", () => {
      const bucket = `test-${Date.now()}-exceed`;
      const config = { windowMs: 60_000, maxRequests: 3 };

      checkRateLimit(bucket, "key1", config); // 1
      checkRateLimit(bucket, "key1", config); // 2
      checkRateLimit(bucket, "key1", config); // 3

      try {
        checkRateLimit(bucket, "key1", config); // 4 — should throw
        expect.fail("Should have thrown 429");
      } catch (err: any) {
        expect(err.statusCode).toBe(429);
        expect(err.code).toBe("RATE_LIMIT_EXCEEDED");
      }
    });

    it("should apply lockout when configured", () => {
      const bucket = `test-${Date.now()}-lockout`;
      const config = { windowMs: 60_000, maxRequests: 2, lockoutMs: 300_000 };

      checkRateLimit(bucket, "key1", config); // 1
      checkRateLimit(bucket, "key1", config); // 2

      try {
        checkRateLimit(bucket, "key1", config); // 3 — should lock
        expect.fail("Should have thrown 429");
      } catch (err: any) {
        expect(err.statusCode).toBe(429);
        expect(err.code).toBe("RATE_LIMIT_LOCKOUT");
      }
    });

    it("should track different keys independently", () => {
      const bucket = `test-${Date.now()}-independent`;
      const config = { windowMs: 60_000, maxRequests: 2 };

      checkRateLimit(bucket, "keyA", config);
      checkRateLimit(bucket, "keyA", config);
      // keyA is now at limit

      // keyB should still have room
      const result = checkRateLimit(bucket, "keyB", config);
      expect(result.remaining).toBe(1);
    });
  });

  describe("RATE_LIMITS presets", () => {
    it("INTAKE_SUBMIT allows 5 requests per minute", () => {
      expect(RATE_LIMITS.INTAKE_SUBMIT.maxRequests).toBe(5);
      expect(RATE_LIMITS.INTAKE_SUBMIT.windowMs).toBe(60_000);
    });

    it("OTP_VERIFY has lockout configured", () => {
      expect(RATE_LIMITS.OTP_VERIFY.lockoutMs).toBeDefined();
      expect(RATE_LIMITS.OTP_VERIFY.lockoutMs).toBeGreaterThan(0);
    });

    it("OTP_SEND limits to 3 per 15 minutes", () => {
      expect(RATE_LIMITS.OTP_SEND.maxRequests).toBe(3);
      expect(RATE_LIMITS.OTP_SEND.windowMs).toBe(15 * 60_000);
    });
  });
});

// ─── RBAC Per-Role Tests ─────────────────────────────────────────────────────

import { has, enforce, hasPermission, checkPermission } from "@/lib/rbac";

describe("RBAC — Role Permission Matrix", () => {
  describe("READ_ONLY role", () => {
    const role = "READ_ONLY";

    it("can read cases", () => expect(has(role, "CASES_READ")).toBe(true));
    it("cannot create cases", () => expect(has(role, "CASES_CREATE")).toBe(false));
    it("cannot update cases", () => expect(has(role, "CASES_UPDATE")).toBe(false));
    it("cannot delete cases", () => expect(has(role, "CASES_DELETE")).toBe(false));
    it("can download documents", () => expect(has(role, "DOCUMENT_DOWNLOAD")).toBe(true));
    it("cannot upload documents", () => expect(has(role, "DOCUMENT_UPLOAD")).toBe(false));
    it("cannot manage users", () => expect(has(role, "USER_MANAGEMENT")).toBe(false));
    it("cannot manage governance", () => expect(has(role, "GOVERNANCE_EDIT_SETTINGS")).toBe(false));
    it("cannot export", () => expect(has(role, "EXPORT_REQUEST")).toBe(false));
  });

  describe("AUDITOR role", () => {
    const role = "AUDITOR";

    it("can read cases", () => expect(has(role, "CASES_READ")).toBe(true));
    it("cannot create cases", () => expect(has(role, "CASES_CREATE")).toBe(false));
    it("cannot update cases", () => expect(has(role, "CASES_UPDATE")).toBe(false));
    it("can read audit logs", () => expect(has(role, "AUDIT_LOGS_READ")).toBe(true));
    it("cannot manage users", () => expect(has(role, "USER_MANAGEMENT")).toBe(false));
    it("cannot export", () => expect(has(role, "EXPORT_REQUEST")).toBe(false));
    it("can view assurance", () => expect(has(role, "ASSURANCE_VIEW")).toBe(true));
    it("can verify audit trail", () => expect(has(role, "ASSURANCE_AUDIT_VERIFY")).toBe(true));
    it("cannot manage SoD", () => expect(has(role, "ASSURANCE_SOD_MANAGE")).toBe(false));
  });

  describe("CASE_MANAGER role", () => {
    const role = "CASE_MANAGER";

    it("can create cases", () => expect(has(role, "CASES_CREATE")).toBe(true));
    it("can update cases", () => expect(has(role, "CASES_UPDATE")).toBe(true));
    it("cannot delete cases", () => expect(has(role, "CASES_DELETE")).toBe(false));
    it("can upload documents", () => expect(has(role, "DOCUMENT_UPLOAD")).toBe(true));
    it("cannot manage governance", () => expect(has(role, "GOVERNANCE_EDIT_SETTINGS")).toBe(false));
    it("cannot manage users", () => expect(has(role, "USER_MANAGEMENT")).toBe(false));
    it("can manage case teams", () => expect(has(role, "CASE_TEAM_MANAGE")).toBe(true));
  });

  describe("DPO role", () => {
    const role = "DPO";

    it("can manage governance", () => expect(has(role, "GOVERNANCE_EDIT_SETTINGS")).toBe(true));
    it("can approve legal", () => expect(has(role, "COPILOT_LEGAL_APPROVE")).toBe(true));
    it("cannot manage users", () => expect(has(role, "USER_MANAGEMENT")).toBe(false));
    it("can approve responses", () => expect(has(role, "RESPONSE_APPROVE")).toBe(true));
    it("can manage case teams", () => expect(has(role, "CASE_TEAM_MANAGE")).toBe(true));
  });

  describe("enforce — throws on denied", () => {
    it("should throw 403 for denied permission", () => {
      try {
        enforce("READ_ONLY", "CASES_CREATE");
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.message).toContain("CASES_CREATE");
      }
    });

    it("should not throw for allowed permission", () => {
      expect(() => enforce("SUPER_ADMIN", "CASES_CREATE")).not.toThrow();
    });
  });

  describe("legacy checkPermission compatibility", () => {
    it("should allow SUPER_ADMIN to manage cases", () => {
      expect(() => checkPermission("SUPER_ADMIN", "cases", "manage")).not.toThrow();
    });

    it("should deny READ_ONLY from creating cases", () => {
      try {
        checkPermission("READ_ONLY", "cases", "create");
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
      }
    });
  });
});

// ─── Public Portal Token Abuse Tests ─────────────────────────────────────────

import { generatePortalToken, validatePortalToken, tokenExpiryFromDays } from "@/lib/idv-token";

describe("IDV Portal Token Security", () => {
  it("should generate and validate a valid token", () => {
    const expiry = tokenExpiryFromDays(7);
    const token = generatePortalToken("req-1", "tenant-1", expiry);
    const payload = validatePortalToken(token);

    expect(payload).not.toBeNull();
    expect(payload!.requestId).toBe("req-1");
    expect(payload!.tenantId).toBe("tenant-1");
  });

  it("should reject expired tokens", () => {
    const expiry = new Date(Date.now() - 1000); // Already expired
    const token = generatePortalToken("req-1", "tenant-1", expiry);
    const payload = validatePortalToken(token);

    expect(payload).toBeNull();
  });

  it("should reject tampered tokens", () => {
    const expiry = tokenExpiryFromDays(7);
    const token = generatePortalToken("req-1", "tenant-1", expiry);
    // Tamper with the payload
    const tampered = "X" + token.slice(1);
    const payload = validatePortalToken(tampered);

    expect(payload).toBeNull();
  });

  it("should reject malformed tokens", () => {
    expect(validatePortalToken("")).toBeNull();
    expect(validatePortalToken("not.a.valid.token")).toBeNull();
    expect(validatePortalToken("abc")).toBeNull();
  });

  it("should reject tokens with modified signature", () => {
    const expiry = tokenExpiryFromDays(7);
    const token = generatePortalToken("req-1", "tenant-1", expiry);
    const [payload, sig] = token.split(".");
    // Modify the signature
    const modifiedSig = sig.split("").reverse().join("");
    const tampered = `${payload}.${modifiedSig}`;

    expect(validatePortalToken(tampered)).toBeNull();
  });
});

// ─── Delivery Token Security Tests ───────────────────────────────────────────

import { generateToken, hashToken } from "@/lib/delivery-link-service";

describe("Delivery Link Token Security", () => {
  it("should generate cryptographically random tokens", () => {
    const token1 = generateToken();
    const token2 = generateToken();

    expect(token1).not.toBe(token2);
    expect(token1.length).toBeGreaterThan(20); // 32 bytes = ~43 chars base64url
  });

  it("should produce different hashes with different salts", () => {
    const token = generateToken();
    const hash1 = hashToken(token, "salt1");
    const hash2 = hashToken(token, "salt2");

    expect(hash1).not.toBe(hash2);
  });

  it("should produce consistent hashes with same salt", () => {
    const token = generateToken();
    const hash1 = hashToken(token, "salt1");
    const hash2 = hashToken(token, "salt1");

    expect(hash1).toBe(hash2);
  });
});
