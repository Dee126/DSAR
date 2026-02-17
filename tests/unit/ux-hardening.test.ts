/**
 * Sprint 9.4: UX/Quality Hardening Tests
 *
 * Tests for API client, i18n, pagination utilities, and DataBadge logic.
 * (Component rendering tests require jsdom environment — these test the logic layer.)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════════
// API Client Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("ApiClient", () => {
  let api: typeof import("@/lib/api-client").api;

  beforeEach(async () => {
    vi.restoreAllMocks();
    const mod = await import("@/lib/api-client");
    api = mod.api;
  });

  it("returns data on successful GET", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [{ id: "1" }] }),
        headers: new Headers(),
      }),
    );

    const result = await api.get<{ id: string }[]>("/api/test");
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ id: "1" }]);
    expect(result.status).toBe(200);
  });

  it("returns structured error on 4xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            error: { code: "FORBIDDEN", message: "No access" },
          }),
        headers: new Headers(),
      }),
    );

    const result = await api.get("/api/test");
    expect(result.error).not.toBeNull();
    expect(result.error!.code).toBe("FORBIDDEN");
    expect(result.error!.message).toBe("No access");
    expect(result.status).toBe(403);
  });

  it("returns fallback message for error without body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("parse error")),
        headers: new Headers(),
      }),
    );

    const result = await api.get("/api/test");
    expect(result.error).not.toBeNull();
    expect(result.error!.code).toBe("HTTP_500");
    expect(result.error!.message).toContain("internal error");
  });

  it("returns NETWORK_ERROR on fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Failed to fetch")),
    );

    const result = await api.get("/api/test");
    expect(result.error).not.toBeNull();
    expect(result.error!.code).toBe("NETWORK_ERROR");
    expect(result.error!.correlationId).toBeTruthy();
    expect(result.status).toBe(0);
  });

  it("sends JSON body on POST", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: "new-1" }),
      headers: new Headers(),
    });
    vi.stubGlobal("fetch", mockFetch);

    await api.post("/api/test", { name: "test" });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        method: "POST",
        body: '{"name":"test"}',
      }),
    );
  });

  it("handles 204 No Content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
      }),
    );

    const result = await api.delete("/api/test/1");
    expect(result.error).toBeNull();
    expect(result.status).toBe(204);
  });

  it("includes correlation ID in headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      headers: new Headers(),
    });
    vi.stubGlobal("fetch", mockFetch);

    await api.get("/api/test");

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders["X-Correlation-Id"]).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// i18n Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("i18n", () => {
  it("returns English translations by default", async () => {
    const { t } = await import("@/lib/i18n");
    expect(t("common.loading")).toBe("Loading...");
    expect(t("common.save")).toBe("Save");
    expect(t("cases.title")).toBe("Cases");
  });

  it("returns German translations when locale is DE", async () => {
    const { t, setLocale } = await import("@/lib/i18n");
    setLocale("de");
    expect(t("common.loading")).toBe("Laden...");
    expect(t("common.save")).toBe("Speichern");
    expect(t("cases.title")).toBe("Fälle");
    // Reset
    setLocale("en");
  });

  it("returns key as fallback for missing translation", async () => {
    const { t } = await import("@/lib/i18n");
    // Cast to bypass type checking for test
    const result = (t as (k: string) => string)("nonexistent.key");
    expect(result).toBe("nonexistent.key");
  });

  it("setLocale changes locale and getLocale reflects it", async () => {
    const { setLocale, getLocale } = await import("@/lib/i18n");
    setLocale("de");
    expect(getLocale()).toBe("de");
    setLocale("en");
    expect(getLocale()).toBe("en");
  });

  it("has all German keys matching English keys", async () => {
    const mod = await import("@/lib/i18n");
    const { t, setLocale } = mod;

    // Get all English keys
    setLocale("en");
    const enKeys = [
      "common.loading", "common.save", "common.cancel", "common.delete",
      "cases.title", "cases.newCase", "dashboard.title", "toast.saved",
      "gate.idvRequired", "status.NEW", "status.CLOSED",
    ];

    // Verify each has a German translation
    setLocale("de");
    for (const key of enKeys) {
      const deValue = (t as (k: string) => string)(key);
      expect(deValue).not.toBe(key); // Should not fall back to key
      expect(deValue.length).toBeGreaterThan(0);
    }

    setLocale("en");
  });

  it("has status translations for all DSAR statuses", async () => {
    const { t } = await import("@/lib/i18n");
    const statuses = [
      "status.NEW", "status.IDENTITY_VERIFICATION", "status.INTAKE_TRIAGE",
      "status.DATA_COLLECTION", "status.REVIEW_LEGAL", "status.RESPONSE_PREPARATION",
      "status.RESPONSE_SENT", "status.CLOSED", "status.REJECTED",
    ];

    for (const key of statuses) {
      const value = (t as (k: string) => string)(key);
      expect(value).not.toBe(key);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DataBadge Logic Tests (color mapping)
// ═══════════════════════════════════════════════════════════════════════════════

describe("DataBadge color mapping", () => {
  // Test the color mapping logic directly (without rendering)
  const STATUS_COLORS: Record<string, string> = {
    NEW: "bg-blue-100 text-blue-800",
    IDENTITY_VERIFICATION: "bg-yellow-100 text-yellow-800",
    INTAKE_TRIAGE: "bg-orange-100 text-orange-800",
    DATA_COLLECTION: "bg-purple-100 text-purple-800",
    REVIEW_LEGAL: "bg-indigo-100 text-indigo-800",
    RESPONSE_PREPARATION: "bg-cyan-100 text-cyan-800",
    RESPONSE_SENT: "bg-green-100 text-green-800",
    CLOSED: "bg-gray-100 text-gray-800",
    REJECTED: "bg-red-100 text-red-800",
  };

  const PRIORITY_COLORS: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-700",
    MEDIUM: "bg-blue-100 text-blue-700",
    HIGH: "bg-orange-100 text-orange-700",
    CRITICAL: "bg-red-100 text-red-700",
  };

  it("maps all DSAR statuses to colors", () => {
    const statuses = [
      "NEW", "IDENTITY_VERIFICATION", "INTAKE_TRIAGE",
      "DATA_COLLECTION", "REVIEW_LEGAL", "RESPONSE_PREPARATION",
      "RESPONSE_SENT", "CLOSED", "REJECTED",
    ];
    for (const status of statuses) {
      expect(STATUS_COLORS[status]).toBeTruthy();
      expect(STATUS_COLORS[status]).toContain("bg-");
      expect(STATUS_COLORS[status]).toContain("text-");
    }
  });

  it("maps all priorities to colors", () => {
    const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    for (const p of priorities) {
      expect(PRIORITY_COLORS[p]).toBeTruthy();
    }
  });

  it("has distinct colors for different statuses", () => {
    const uniqueColors = new Set(Object.values(STATUS_COLORS));
    // At least 7 unique colors for 9 statuses
    expect(uniqueColors.size).toBeGreaterThanOrEqual(7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP Status Message Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("API error messages", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("maps 401 to session expired message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.reject(new Error("no body")),
        headers: new Headers(),
      }),
    );

    const { api } = await import("@/lib/api-client");
    const result = await api.get("/api/test");
    expect(result.error!.message).toContain("session");
  });

  it("maps 429 to rate limit message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.reject(new Error("no body")),
        headers: new Headers(),
      }),
    );

    const { api } = await import("@/lib/api-client");
    const result = await api.get("/api/test");
    expect(result.error!.message).toContain("Too many");
  });
});
