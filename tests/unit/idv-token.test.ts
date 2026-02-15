import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generatePortalToken,
  validatePortalToken,
  tokenExpiryFromDays,
} from "@/lib/idv-token";

/* ── generatePortalToken & validatePortalToken ─────────────────────── */

describe("IDV Portal Token", () => {
  const requestId = "req-123-abc";
  const tenantId = "tenant-456-def";

  describe("generatePortalToken", () => {
    it("generates a string token with two parts", () => {
      const token = generatePortalToken(requestId, tenantId, new Date("2030-01-01"));
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(2);
    });

    it("generates different tokens for different inputs", () => {
      const exp = new Date("2030-01-01");
      const t1 = generatePortalToken("req-1", tenantId, exp);
      const t2 = generatePortalToken("req-2", tenantId, exp);
      expect(t1).not.toBe(t2);
    });

    it("generates different tokens for different tenants", () => {
      const exp = new Date("2030-01-01");
      const t1 = generatePortalToken(requestId, "tenant-a", exp);
      const t2 = generatePortalToken(requestId, "tenant-b", exp);
      expect(t1).not.toBe(t2);
    });
  });

  describe("validatePortalToken", () => {
    it("validates a valid token", () => {
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      const token = generatePortalToken(requestId, tenantId, expires);

      const payload = validatePortalToken(token);
      expect(payload).not.toBeNull();
      expect(payload!.requestId).toBe(requestId);
      expect(payload!.tenantId).toBe(tenantId);
    });

    it("rejects an expired token", () => {
      const expired = new Date("2020-01-01");
      const token = generatePortalToken(requestId, tenantId, expired);

      const payload = validatePortalToken(token);
      expect(payload).toBeNull();
    });

    it("rejects a tampered payload", () => {
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      const token = generatePortalToken(requestId, tenantId, expires);

      const parts = token.split(".");
      // Tamper with the payload by changing a character
      const tampered = parts[0].slice(0, -1) + "X" + "." + parts[1];
      const payload = validatePortalToken(tampered);
      expect(payload).toBeNull();
    });

    it("rejects a tampered signature", () => {
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      const token = generatePortalToken(requestId, tenantId, expires);

      const parts = token.split(".");
      const tampered = parts[0] + "." + parts[1] + "TAMPERED";
      const payload = validatePortalToken(tampered);
      expect(payload).toBeNull();
    });

    it("rejects malformed tokens", () => {
      expect(validatePortalToken("")).toBeNull();
      expect(validatePortalToken("no-dots-here")).toBeNull();
      expect(validatePortalToken("a.b.c")).toBeNull();
      expect(validatePortalToken("..")).toBeNull();
    });

    it("rejects token with invalid JSON payload", () => {
      // Create token with invalid base64
      const payload = validatePortalToken("INVALIDBASE64.INVALIDSIG");
      expect(payload).toBeNull();
    });
  });
});

/* ── tokenExpiryFromDays ───────────────────────────────────────────── */

describe("tokenExpiryFromDays", () => {
  it("returns a date in the future", () => {
    const expiry = tokenExpiryFromDays(7);
    const now = new Date();
    expect(expiry.getTime()).toBeGreaterThan(now.getTime());
  });

  it("returns a date approximately N days from now", () => {
    const days = 7;
    const expiry = tokenExpiryFromDays(days);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // Allow some tolerance for test execution time
    expect(diffDays).toBeGreaterThanOrEqual(6.99);
    expect(diffDays).toBeLessThanOrEqual(7.01);
  });

  it("works for 1 day", () => {
    const expiry = tokenExpiryFromDays(1);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(0.99);
    expect(diffDays).toBeLessThanOrEqual(1.01);
  });

  it("works for 90 days", () => {
    const expiry = tokenExpiryFromDays(90);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(89.99);
    expect(diffDays).toBeLessThanOrEqual(90.01);
  });
});
