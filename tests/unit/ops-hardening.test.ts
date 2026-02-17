/**
 * Sprint 9.5: Ops/Production-Readiness Tests
 *
 * Tests for environment validation, feature flags, metrics, and error reporting.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════════
// Environment Validation Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Environment Validation", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("passes when all required vars are set", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.NEXTAUTH_SECRET = "test-secret-value";
    process.env.NODE_ENV = "development";

    const { validateEnv } = await import("@/lib/env");
    const result = validateEnv();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    process.env.NEXTAUTH_SECRET = "test-secret-value";
    process.env.NODE_ENV = "test";

    const { validateEnv } = await import("@/lib/env");
    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("DATABASE_URL"))).toBe(true);
  });

  it("fails when NEXTAUTH_SECRET is missing", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    delete process.env.NEXTAUTH_SECRET;
    process.env.NODE_ENV = "test";

    const { validateEnv } = await import("@/lib/env");
    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("NEXTAUTH_SECRET"))).toBe(true);
  });

  it("requires PRIVACYPILOT_SECRET in production", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.NEXTAUTH_SECRET = "real-secret-value";
    process.env.NODE_ENV = "production";
    delete process.env.PRIVACYPILOT_SECRET;

    const { validateEnv } = await import("@/lib/env");
    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("PRIVACYPILOT_SECRET"))).toBe(true);
  });

  it("rejects default NEXTAUTH_SECRET in production", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.NEXTAUTH_SECRET = "change-me-to-a-random-secret-in-production";
    process.env.NODE_ENV = "production";
    process.env.PRIVACYPILOT_SECRET = "some-secret";

    const { validateEnv } = await import("@/lib/env");
    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("default value"))).toBe(true);
  });

  it("requires S3 vars when STORAGE_TYPE=s3", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.NEXTAUTH_SECRET = "test-secret-value";
    process.env.STORAGE_TYPE = "s3";
    delete process.env.S3_BUCKET;
    delete process.env.S3_REGION;
    process.env.NODE_ENV = "test";

    const { validateEnv } = await import("@/lib/env");
    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("S3_BUCKET"))).toBe(true);
  });

  it("ensureEnv throws on missing required vars", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.NEXTAUTH_SECRET;
    process.env.NODE_ENV = "test";

    const { ensureEnv } = await import("@/lib/env");
    expect(() => ensureEnv()).toThrow("Environment validation failed");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Typed Env Accessors Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Typed env accessors", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("provides typed access to DATABASE_URL", async () => {
    process.env.DATABASE_URL = "postgresql://test@localhost/db";
    const { env } = await import("@/lib/env");
    expect(env.DATABASE_URL).toBe("postgresql://test@localhost/db");
  });

  it("provides DEFAULT_SLA_DAYS as number with default", async () => {
    delete process.env.DEFAULT_SLA_DAYS;
    const { env } = await import("@/lib/env");
    expect(env.DEFAULT_SLA_DAYS).toBe(30);
  });

  it("detects production environment", async () => {
    process.env.NODE_ENV = "production";
    const { env } = await import("@/lib/env");
    expect(env.isProduction).toBe(true);
    expect(env.isDevelopment).toBe(false);
  });

  it("detects development environment", async () => {
    process.env.NODE_ENV = "development";
    const { env } = await import("@/lib/env");
    expect(env.isProduction).toBe(false);
    expect(env.isDevelopment).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Feature Flags Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Feature Flags", () => {
  it("has all feature keys defined", async () => {
    const { FEATURE_KEYS, FEATURE_DEFINITIONS } = await import("@/lib/feature-flags");
    const keys = Object.values(FEATURE_KEYS);
    expect(keys.length).toBeGreaterThanOrEqual(10);

    // Every key has a definition
    for (const key of keys) {
      const def = FEATURE_DEFINITIONS.find((d) => d.key === key);
      expect(def).toBeTruthy();
      expect(def!.label).toBeTruthy();
      expect(def!.description).toBeTruthy();
      expect(def!.category).toBeTruthy();
    }
  });

  it("has unique feature keys", async () => {
    const { FEATURE_DEFINITIONS } = await import("@/lib/feature-flags");
    const keys = FEATURE_DEFINITIONS.map((d) => d.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("core features default to enabled", async () => {
    const { FEATURE_DEFINITIONS } = await import("@/lib/feature-flags");
    const coreFeatures = FEATURE_DEFINITIONS.filter((d) => d.category === "core");
    expect(coreFeatures.length).toBeGreaterThan(0);
    for (const f of coreFeatures) {
      expect(f.defaultEnabled).toBe(true);
    }
  });

  it("integration connectors default to disabled", async () => {
    const { FEATURE_DEFINITIONS } = await import("@/lib/feature-flags");
    const integrations = FEATURE_DEFINITIONS.filter((d) => d.category === "integration");
    expect(integrations.length).toBeGreaterThan(0);
    for (const f of integrations) {
      expect(f.defaultEnabled).toBe(false);
    }
  });

  it("categories are valid", async () => {
    const { FEATURE_DEFINITIONS } = await import("@/lib/feature-flags");
    const validCategories = ["core", "portal", "integration", "advanced"];
    for (const def of FEATURE_DEFINITIONS) {
      expect(validCategories).toContain(def.category);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Metrics Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Metrics Collector", () => {
  beforeEach(async () => {
    const { metrics } = await import("@/lib/metrics");
    metrics._reset();
  });

  it("records requests and returns snapshot", async () => {
    const { metrics } = await import("@/lib/metrics");

    metrics.recordRequest("/api/cases", 200, 50);
    metrics.recordRequest("/api/cases", 200, 30);
    metrics.recordRequest("/api/cases", 500, 100);

    const snapshot = metrics.getSnapshot();
    expect(snapshot.routes["/api/cases"]).toBeDefined();
    expect(snapshot.routes["/api/cases"].requests_total).toBe(3);
    expect(snapshot.routes["/api/cases"].errors_total).toBe(1);
    expect(snapshot.routes["/api/cases"].avg_latency_ms).toBe(60); // (50+30+100)/3
    expect(snapshot.routes["/api/cases"].errors_by_code["HTTP_500"]).toBe(1);
  });

  it("records errors with codes", async () => {
    const { metrics } = await import("@/lib/metrics");

    metrics.recordError("/api/webhooks", "TIMEOUT");
    metrics.recordError("/api/webhooks", "TIMEOUT");
    metrics.recordError("/api/webhooks", "CONNECTION_REFUSED");

    const snapshot = metrics.getSnapshot();
    expect(snapshot.routes["/api/webhooks"].errors_total).toBe(3);
    expect(snapshot.routes["/api/webhooks"].errors_by_code["TIMEOUT"]).toBe(2);
    expect(snapshot.routes["/api/webhooks"].errors_by_code["CONNECTION_REFUSED"]).toBe(1);
  });

  it("records job metrics", async () => {
    const { metrics } = await import("@/lib/metrics");

    metrics.recordJob("export", true, 500);
    metrics.recordJob("export", true, 300);
    metrics.recordJob("export", false, 1000);

    const snapshot = metrics.getSnapshot();
    expect(snapshot.jobs["export"]).toBeDefined();
    expect(snapshot.jobs["export"].runs_total).toBe(3);
    expect(snapshot.jobs["export"].success_total).toBe(2);
    expect(snapshot.jobs["export"].failure_total).toBe(1);
    expect(snapshot.jobs["export"].avg_duration_ms).toBe(600); // (500+300+1000)/3
  });

  it("tracks uptime", async () => {
    const { metrics } = await import("@/lib/metrics");
    const snapshot = metrics.getSnapshot();
    expect(snapshot.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(snapshot.started_at).toBeTruthy();
    expect(new Date(snapshot.started_at).getTime()).toBeGreaterThan(0);
  });

  it("resets all metrics", async () => {
    const { metrics } = await import("@/lib/metrics");

    metrics.recordRequest("/api/test", 200, 10);
    metrics.recordJob("test-job", true, 100);
    metrics._reset();

    const snapshot = metrics.getSnapshot();
    expect(Object.keys(snapshot.routes)).toHaveLength(0);
    expect(Object.keys(snapshot.jobs)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Error Reporter Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Error Reporter", () => {
  beforeEach(async () => {
    const { ErrorReporter } = await import("@/lib/error-reporter");
    ErrorReporter._reset();
  });

  it("captures errors with console by default", async () => {
    const { ErrorReporter } = await import("@/lib/error-reporter");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    ErrorReporter.capture(new Error("test error"), { route: "/api/test" });

    expect(consoleSpy).toHaveBeenCalled();
    const callArg = consoleSpy.mock.calls[0].join(" ");
    expect(callArg).toContain("test error");
    consoleSpy.mockRestore();
  });

  it("allows custom reporter", async () => {
    const { ErrorReporter } = await import("@/lib/error-reporter");
    const captured: Array<{ error: unknown; context: unknown }> = [];

    ErrorReporter.setReporter({
      capture(error, context) {
        captured.push({ error, context });
      },
    });

    ErrorReporter.capture(new Error("custom"), { route: "/test" });

    expect(captured).toHaveLength(1);
    expect((captured[0].error as Error).message).toBe("custom");
    expect(captured[0].context).toEqual({ route: "/test" });
  });

  it("never throws from capture", async () => {
    const { ErrorReporter } = await import("@/lib/error-reporter");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    ErrorReporter.setReporter({
      capture() {
        throw new Error("reporter crashed");
      },
    });

    // Should not throw
    expect(() => ErrorReporter.capture(new Error("test"))).not.toThrow();
    consoleSpy.mockRestore();
  });

  it("resets to console reporter", async () => {
    const { ErrorReporter } = await import("@/lib/error-reporter");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    ErrorReporter.setReporter({ capture: vi.fn() });
    ErrorReporter._reset();
    ErrorReporter.capture(new Error("after reset"));

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Migration Preflight Patterns Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Destructive SQL Detection", () => {
  const DESTRUCTIVE_PATTERNS = [
    /DROP\s+TABLE/i,
    /DROP\s+COLUMN/i,
    /DROP\s+INDEX/i,
    /ALTER\s+TABLE\s+.*\s+DROP/i,
    /TRUNCATE/i,
    /DELETE\s+FROM/i,
  ];

  function isDestructive(sql: string): boolean {
    return DESTRUCTIVE_PATTERNS.some((p) => p.test(sql));
  }

  it("detects DROP TABLE", () => {
    expect(isDestructive("DROP TABLE users;")).toBe(true);
    expect(isDestructive("drop table IF EXISTS users;")).toBe(true);
  });

  it("detects DROP COLUMN", () => {
    expect(isDestructive("ALTER TABLE users DROP COLUMN email;")).toBe(true);
  });

  it("detects TRUNCATE", () => {
    expect(isDestructive("TRUNCATE TABLE audit_logs;")).toBe(true);
  });

  it("detects DELETE FROM", () => {
    expect(isDestructive("DELETE FROM users WHERE active = false;")).toBe(true);
  });

  it("allows safe operations", () => {
    expect(isDestructive("CREATE TABLE IF NOT EXISTS users (id TEXT);")).toBe(false);
    expect(isDestructive("ALTER TABLE users ADD COLUMN name TEXT;")).toBe(false);
    expect(isDestructive("CREATE INDEX idx_users ON users(email);")).toBe(false);
    expect(isDestructive("INSERT INTO users (id) VALUES ('1');")).toBe(false);
  });
});
