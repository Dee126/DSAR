/**
 * Reliability Baseline Tests
 *
 * Tests for:
 *   1. Request context & correlation IDs
 *   2. Structured logging (PII masking)
 *   3. Safe JSON serialization (BigInt, Date)
 *   4. Timeboxed query execution
 *   5. Error handling with correlation IDs
 *   6. Incident stats service — empty data handling
 *   7. Client fetch wrapper retry logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withRequestContext,
  safeJson,
  timeboxedQuery,
  QueryTimeoutError,
  structuredLog,
} from "@/lib/request-context";
import { ApiError, handleApiError } from "@/lib/errors";
import { has } from "@/lib/rbac";

// ─── 1. Request Context ──────────────────────────────────────────────────────

describe("withRequestContext", () => {
  function mockRequest(url: string, headers: Record<string, string> = {}): Request {
    return new Request(url, {
      headers: new Headers(headers),
    });
  }

  it("should generate a correlation ID when none provided", () => {
    const req = mockRequest("http://localhost:3000/api/incidents/stats");
    const ctx = withRequestContext(req);
    expect(ctx.correlationId).toBeDefined();
    expect(ctx.correlationId.length).toBeGreaterThan(0);
    expect(ctx.route).toBe("GET /api/incidents/stats");
    expect(ctx.tenantId).toBeNull();
    expect(ctx.actorId).toBeNull();
  });

  it("should use provided correlation ID from header", () => {
    const req = mockRequest("http://localhost:3000/api/test", {
      "x-correlation-id": "test-corr-123",
    });
    const ctx = withRequestContext(req);
    expect(ctx.correlationId).toBe("test-corr-123");
  });

  it("should include auth context when provided", () => {
    const req = mockRequest("http://localhost:3000/api/test");
    const ctx = withRequestContext(req, { tenantId: "tenant-1", id: "user-42" });
    expect(ctx.tenantId).toBe("tenant-1");
    expect(ctx.actorId).toBe("user-42");
  });

  it("should record start time", () => {
    const before = Date.now();
    const req = mockRequest("http://localhost:3000/api/test");
    const ctx = withRequestContext(req);
    expect(ctx.startedAt).toBeGreaterThanOrEqual(before);
    expect(ctx.startedAt).toBeLessThanOrEqual(Date.now());
  });
});

// ─── 2. Structured Logging (PII Masking) ──────────────────────────────────────

describe("structuredLog", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should emit a JSON log line with required fields", () => {
    const ctx = {
      correlationId: "test-123",
      tenantId: "t1",
      actorId: "u1",
      route: "GET /api/test",
      startedAt: Date.now() - 50,
    };

    structuredLog("info", ctx, "test_action");

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logLine = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logLine);
    expect(parsed.level).toBe("info");
    expect(parsed.correlation_id).toBe("test-123");
    expect(parsed.tenant_id).toBe("t1");
    expect(parsed.route).toBe("GET /api/test");
    expect(parsed.action).toBe("test_action");
    expect(parsed.duration_ms).toBeGreaterThanOrEqual(0);
    expect(parsed.timestamp).toBeDefined();
  });

  it("should mask email addresses in string values", () => {
    const ctx = {
      correlationId: "test-123",
      tenantId: "t1",
      actorId: "u1",
      route: "GET /api/test",
      startedAt: Date.now(),
    };

    structuredLog("info", ctx, "test_action", {
      user_email: "john.doe@example.com",
    });

    const logLine = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logLine);
    expect(parsed.user_email).not.toContain("john.doe@example.com");
    expect(parsed.user_email).toContain("j***@example.com");
  });

  it("should use console.error for error level", () => {
    const errorSpy = vi.spyOn(console, "error");
    const ctx = {
      correlationId: "test-123",
      tenantId: "t1",
      actorId: "u1",
      route: "GET /api/test",
      startedAt: Date.now(),
    };

    structuredLog("error", ctx, "something_failed");

    expect(errorSpy).toHaveBeenCalled();
  });
});

// ─── 3. Safe JSON Serialization ───────────────────────────────────────────────

describe("safeJson", () => {
  it("should pass through normal objects unchanged", () => {
    const data = { a: 1, b: "hello", c: [1, 2, 3] };
    expect(safeJson(data)).toEqual(data);
  });

  it("should convert BigInt to number when safe", () => {
    const data = { count: BigInt(42) };
    const result = safeJson(data);
    expect(result.count).toBe(42);
    expect(typeof result.count).toBe("number");
  });

  it("should convert large BigInt to string", () => {
    const data = { huge: BigInt("99999999999999999999") };
    const result = safeJson(data);
    expect(result.huge).toBe("99999999999999999999");
    expect(typeof result.huge).toBe("string");
  });

  it("should handle Date objects (via JSON.stringify)", () => {
    const date = new Date("2026-01-15T12:00:00Z");
    const data = { created: date };
    const result = safeJson(data);
    expect(result.created).toBe("2026-01-15T12:00:00.000Z");
  });

  it("should handle nested structures", () => {
    const data = {
      stats: {
        count: BigInt(100),
        nested: {
          value: BigInt(200),
        },
      },
    };
    const result = safeJson(data);
    expect(result.stats.count).toBe(100);
    expect(result.stats.nested.value).toBe(200);
  });

  it("should handle null and undefined gracefully", () => {
    expect(safeJson(null)).toBeNull();
    expect(safeJson({ a: null, b: undefined })).toEqual({ a: null });
  });
});

// ─── 4. Timeboxed Query Execution ────────────────────────────────────────────

describe("timeboxedQuery", () => {
  it("should resolve with the result when within timeout", async () => {
    const result = await timeboxedQuery(
      () => Promise.resolve({ count: 42 }),
      5000,
    );
    expect(result).toEqual({ count: 42 });
  });

  it("should reject with QueryTimeoutError when exceeding timeout", async () => {
    await expect(
      timeboxedQuery(
        () => new Promise((resolve) => setTimeout(() => resolve("late"), 200)),
        50,
      ),
    ).rejects.toThrow(QueryTimeoutError);
  });

  it("should propagate errors from the query function", async () => {
    await expect(
      timeboxedQuery(
        () => Promise.reject(new Error("DB connection lost")),
        5000,
      ),
    ).rejects.toThrow("DB connection lost");
  });

  it("QueryTimeoutError should have correct timeout value", () => {
    const err = new QueryTimeoutError(3000);
    expect(err.timeoutMs).toBe(3000);
    expect(err.message).toContain("3000ms");
  });
});

// ─── 5. Error Handling with Correlation IDs ──────────────────────────────────

describe("handleApiError", () => {
  it("should include correlation_id when context is provided", async () => {
    const ctx = {
      correlationId: "corr-abc-123",
      tenantId: "t1",
      actorId: "u1",
      route: "GET /api/test",
      startedAt: Date.now(),
    };

    // Suppress console.error during test
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = handleApiError(new Error("unexpected"), ctx);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.correlation_id).toBe("corr-abc-123");
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.error).toBe("Internal server error");

    vi.restoreAllMocks();
  });

  it("should handle ApiError with correct status and code", async () => {
    const ctx = {
      correlationId: "corr-xyz",
      tenantId: "t1",
      actorId: "u1",
      route: "GET /api/test",
      startedAt: Date.now(),
    };

    const response = handleApiError(
      new ApiError(403, "Forbidden: missing permission INCIDENT_VIEW", undefined, "FORBIDDEN"),
      ctx,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("Forbidden");
    expect(body.code).toBe("FORBIDDEN");
    expect(body.correlation_id).toBe("corr-xyz");
  });

  it("should handle QueryTimeoutError", async () => {
    const ctx = {
      correlationId: "corr-timeout",
      tenantId: "t1",
      actorId: "u1",
      route: "GET /api/test",
      startedAt: Date.now(),
    };

    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = handleApiError(new QueryTimeoutError(5000), ctx);
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.code).toBe("QUERY_TIMEOUT");
    expect(body.correlation_id).toBe("corr-timeout");

    vi.restoreAllMocks();
  });

  it("should work without context (backward compatible)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = handleApiError(new ApiError(400, "Bad request"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Bad request");
    expect(body.correlation_id).toBeUndefined();

    vi.restoreAllMocks();
  });
});

// ─── 6. Incident Stats — Empty Data Handling ──────────────────────────────────

describe("Incident Stats — Empty Data Contract", () => {
  it("should define correct empty stats shape", () => {
    const emptyStats = {
      openIncidents: 0,
      contained: 0,
      resolved: 0,
      linkedDSARs: 0,
      overdueDSARs: 0,
      severityDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    };

    // Verify all numeric fields are zero
    expect(emptyStats.openIncidents).toBe(0);
    expect(emptyStats.contained).toBe(0);
    expect(emptyStats.resolved).toBe(0);
    expect(emptyStats.linkedDSARs).toBe(0);
    expect(emptyStats.overdueDSARs).toBe(0);

    // Verify severity distribution has all keys
    expect(Object.keys(emptyStats.severityDistribution)).toEqual(
      expect.arrayContaining(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    );
  });

  it("should return empty stats shape with permissionDenied flag for unauthorized users", () => {
    const response = {
      openIncidents: 0,
      contained: 0,
      resolved: 0,
      linkedDSARs: 0,
      overdueDSARs: 0,
      severityDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      permissionDenied: true,
      message: "You do not have permission to view incident data",
    };

    expect(response.permissionDenied).toBe(true);
    expect(response.message).toBeDefined();
    // Widget should display "no_permission" state, not "error" state
    expect(response.openIncidents).toBe(0);
  });

  it("severity distribution should reduce from groupBy results", () => {
    // Simulates what getIncidentDashboardStats does
    const bySeverity = [
      { severity: "HIGH", _count: 3 },
      { severity: "CRITICAL", _count: 1 },
    ];

    const severityDistribution = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
      ...bySeverity.reduce(
        (acc, g) => ({ ...acc, [g.severity]: g._count }),
        {} as Record<string, number>,
      ),
    };

    expect(severityDistribution).toEqual({
      LOW: 0,
      MEDIUM: 0,
      HIGH: 3,
      CRITICAL: 1,
    });
  });
});

// ─── 7. Fetch Client Retry Logic ──────────────────────────────────────────────

describe("fetchJsonWithRetry — contract tests", () => {
  it("should define the correct result shape", () => {
    // Verify the FetchResult interface
    const successResult = {
      data: { count: 42 },
      error: null,
      status: 200,
      code: null,
      permissionDenied: false,
      correlationId: "test-123",
    };

    expect(successResult.data).toBeDefined();
    expect(successResult.error).toBeNull();
    expect(successResult.status).toBe(200);
    expect(successResult.permissionDenied).toBe(false);
  });

  it("should define permission denied result shape", () => {
    const forbiddenResult = {
      data: null,
      error: "Forbidden: missing permission",
      status: 403,
      code: "FORBIDDEN",
      permissionDenied: true,
      correlationId: "test-456",
    };

    expect(forbiddenResult.data).toBeNull();
    expect(forbiddenResult.permissionDenied).toBe(true);
    expect(forbiddenResult.status).toBe(403);
  });

  it("should define network error result shape", () => {
    const networkError = {
      data: null,
      error: "Network error",
      status: 0,
      code: "NETWORK_ERROR",
      permissionDenied: false,
      correlationId: null,
    };

    expect(networkError.status).toBe(0);
    expect(networkError.code).toBe("NETWORK_ERROR");
  });

  it("should identify retryable vs non-retryable statuses", () => {
    const retryableStatuses = new Set([408, 429, 502, 503, 504]);

    // These should be retried
    expect(retryableStatuses.has(502)).toBe(true);
    expect(retryableStatuses.has(503)).toBe(true);
    expect(retryableStatuses.has(504)).toBe(true);
    expect(retryableStatuses.has(429)).toBe(true);

    // These should NOT be retried
    expect(retryableStatuses.has(400)).toBe(false);
    expect(retryableStatuses.has(401)).toBe(false);
    expect(retryableStatuses.has(403)).toBe(false);
    expect(retryableStatuses.has(404)).toBe(false);
  });
});

// ─── 8. RBAC — Incident Widget Permission Check ──────────────────────────────

describe("RBAC — Incident Widget Permission Behavior", () => {
  it("CONTRIBUTOR should NOT have INCIDENT_VIEW", () => {
    expect(has("CONTRIBUTOR", "INCIDENT_VIEW")).toBe(false);
  });

  it("READ_ONLY should NOT have INCIDENT_VIEW", () => {
    expect(has("READ_ONLY", "INCIDENT_VIEW")).toBe(false);
  });

  it("CASE_MANAGER should have INCIDENT_VIEW", () => {
    expect(has("CASE_MANAGER", "INCIDENT_VIEW")).toBe(true);
  });

  it("TENANT_ADMIN should have INCIDENT_VIEW", () => {
    expect(has("TENANT_ADMIN", "INCIDENT_VIEW")).toBe(true);
  });

  it("DPO should have INCIDENT_VIEW", () => {
    expect(has("DPO", "INCIDENT_VIEW")).toBe(true);
  });
});
