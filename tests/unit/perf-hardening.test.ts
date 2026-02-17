/**
 * Sprint 9.3: Performance & Stability Hardening Tests
 *
 * Tests for CacheService, JobRunner, pagination, and query profiler.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  cache,
  cacheKey,
  CacheTTL,
  invalidateTenantCache,
  invalidateWidgetCache,
} from "@/lib/cache-service";
import {
  runJob,
  RetryPolicies,
  _resetLocks,
  _isLocked,
} from "@/lib/job-runner";
import { parsePagination, paginationMeta, PAGE_SIZE_MAX } from "@/lib/pagination";
import { createRequestProfiler } from "@/lib/query-profiler";

// ─── Mock Prisma ────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobRun: {
      create: vi.fn().mockResolvedValue({ id: "jr-1" }),
      update: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CacheService Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("CacheService", () => {
  beforeEach(() => {
    cache._reset();
  });

  afterEach(() => {
    cache._reset();
  });

  describe("get/set", () => {
    it("returns null for missing key", async () => {
      const result = await cache.get("nonexistent");
      expect(result).toBeNull();
    });

    it("stores and retrieves a value", async () => {
      await cache.set("key1", { data: "hello" }, 60);
      const result = await cache.get<{ data: string }>("key1");
      expect(result).toEqual({ data: "hello" });
    });

    it("returns null for expired key", async () => {
      // Set with 0-second TTL (immediately expired)
      await cache.set("expired", "value", 0);
      // Small delay to ensure expiry
      await new Promise((r) => setTimeout(r, 10));
      const result = await cache.get("expired");
      expect(result).toBeNull();
    });

    it("tracks hit/miss stats", async () => {
      await cache.get("miss1");
      await cache.get("miss2");
      await cache.set("hit1", "v", 60);
      await cache.get("hit1");

      const stats = cache.stats();
      expect(stats.misses).toBe(2);
      expect(stats.hits).toBe(1);
      expect(stats.size).toBe(1);
    });
  });

  describe("invalidate", () => {
    it("removes a specific key", async () => {
      await cache.set("key1", "v1", 60);
      await cache.set("key2", "v2", 60);
      await cache.invalidate("key1");
      expect(await cache.get("key1")).toBeNull();
      expect(await cache.get("key2")).toBe("v2");
    });

    it("invalidatePattern removes matching keys", async () => {
      await cache.set("t:tenant1:kpi", "v1", 60);
      await cache.set("t:tenant1:search", "v2", 60);
      await cache.set("t:tenant2:kpi", "v3", 60);

      const count = await cache.invalidatePattern("t:tenant1:");
      expect(count).toBe(2);
      expect(await cache.get("t:tenant1:kpi")).toBeNull();
      expect(await cache.get("t:tenant2:kpi")).toBe("v3");
    });
  });

  describe("cacheKey", () => {
    it("builds key with tenant and widget", () => {
      const key = cacheKey("t1", "kpi");
      expect(key).toBe("t:t1:kpi");
    });

    it("includes sorted filters", () => {
      const key = cacheKey("t1", "kpi", { end: "2026-02", start: "2026-01" });
      expect(key).toBe("t:t1:kpi:end=2026-02&start=2026-01");
    });

    it("excludes undefined filters", () => {
      const key = cacheKey("t1", "kpi", { a: "1", b: undefined });
      expect(key).toBe("t:t1:kpi:a=1");
    });
  });

  describe("invalidation helpers", () => {
    it("invalidateTenantCache removes all tenant keys", async () => {
      await cache.set("t:abc:kpi", "v1", 60);
      await cache.set("t:abc:search", "v2", 60);
      await cache.set("t:xyz:kpi", "v3", 60);

      const count = await invalidateTenantCache("abc");
      expect(count).toBe(2);
    });

    it("invalidateWidgetCache removes specific widget keys", async () => {
      await cache.set("t:abc:kpi:start=1", "v1", 60);
      await cache.set("t:abc:kpi:start=2", "v2", 60);
      await cache.set("t:abc:search", "v3", 60);

      const count = await invalidateWidgetCache("abc", "kpi");
      expect(count).toBe(2);
    });
  });

  describe("TTL constants", () => {
    it("has expected values", () => {
      expect(CacheTTL.DASHBOARD_WIDGET).toBe(60);
      expect(CacheTTL.EXECUTIVE_KPI).toBe(120);
      expect(CacheTTL.SEARCH_FACETS).toBe(30);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// JobRunner Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("JobRunner", () => {
  beforeEach(() => {
    _resetLocks();
    vi.clearAllMocks();
  });

  describe("concurrency guard", () => {
    it("prevents concurrent runs of same job+tenant", async () => {
      // Start a long-running job
      let resolveJob!: () => void;
      const longJob = new Promise<void>((r) => { resolveJob = r; });

      const job1Promise = runJob(
        { jobName: "test_job", tenantId: "t1" },
        () => longJob,
      );

      // Small delay to ensure lock is acquired
      await new Promise((r) => setTimeout(r, 10));

      // Attempt concurrent run
      const job2 = await runJob(
        { jobName: "test_job", tenantId: "t1" },
        async () => "should not run",
      );

      expect(job2.status).toBe("FAILED");
      expect(job2.error).toContain("already running");

      // Cleanup
      resolveJob();
      await job1Promise;
    });

    it("allows concurrent runs for different tenants", async () => {
      const job1 = await runJob(
        { jobName: "test_job", tenantId: "t1" },
        async () => "result1",
      );
      const job2 = await runJob(
        { jobName: "test_job", tenantId: "t2" },
        async () => "result2",
      );

      expect(job1.status).toBe("SUCCESS");
      expect(job2.status).toBe("SUCCESS");
    });

    it("releases lock after completion", async () => {
      await runJob(
        { jobName: "test_job", tenantId: "t1" },
        async () => "done",
      );

      expect(_isLocked("test_job", "t1")).toBe(false);
    });

    it("releases lock after failure", async () => {
      await runJob(
        { jobName: "test_job", tenantId: "t1" },
        async () => { throw new Error("fail"); },
      );

      expect(_isLocked("test_job", "t1")).toBe(false);
    });
  });

  describe("execution", () => {
    it("returns SUCCESS with data on success", async () => {
      const result = await runJob(
        { jobName: "test_job", tenantId: "t1" },
        async () => ({ count: 42 }),
      );

      expect(result.status).toBe("SUCCESS");
      expect(result.data).toEqual({ count: 42 });
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.jobRunId).toBeTruthy();
    });

    it("returns FAILED with error on failure", async () => {
      const result = await runJob(
        { jobName: "test_job", tenantId: "t1" },
        async () => { throw new Error("something broke"); },
      );

      expect(result.status).toBe("FAILED");
      expect(result.error).toBe("something broke");
    });

    it("tracks attempt count", async () => {
      const result = await runJob(
        { jobName: "test_job", tenantId: "t1" },
        async () => "ok",
      );

      expect(result.attempt).toBe(1);
    });
  });

  describe("retry policy", () => {
    it("retries on failure up to maxRetries", async () => {
      let attempts = 0;
      const result = await runJob(
        {
          jobName: "retry_job",
          tenantId: "t1",
          retry: { maxRetries: 2, initialDelayMs: 10, maxDelayMs: 50 },
        },
        async () => {
          attempts++;
          if (attempts < 3) throw new Error("not yet");
          return "success";
        },
      );

      expect(result.status).toBe("SUCCESS");
      expect(attempts).toBe(3);
      expect(result.attempt).toBe(3);
    });

    it("fails after exhausting retries", async () => {
      const result = await runJob(
        {
          jobName: "fail_job",
          tenantId: "t1",
          retry: { maxRetries: 1, initialDelayMs: 10, maxDelayMs: 50 },
        },
        async () => { throw new Error("always fails"); },
      );

      expect(result.status).toBe("FAILED");
      expect(result.attempt).toBe(2); // 1 initial + 1 retry
    });
  });

  describe("retry policies", () => {
    it("WEBHOOK policy has correct values", () => {
      expect(RetryPolicies.WEBHOOK.maxRetries).toBe(3);
      expect(RetryPolicies.WEBHOOK.initialDelayMs).toBe(5000);
    });

    it("RETENTION policy has correct values", () => {
      expect(RetryPolicies.RETENTION.maxRetries).toBe(2);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Pagination Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Pagination", () => {
  function makeParams(params: Record<string, string>) {
    return new URLSearchParams(params);
  }

  it("returns defaults when no params", () => {
    const result = parsePagination(makeParams({}));
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.skip).toBe(0);
    expect(result.take).toBe(20);
  });

  it("parses page and pageSize", () => {
    const result = parsePagination(makeParams({ page: "3", pageSize: "10" }));
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
    expect(result.skip).toBe(20);
  });

  it("clamps pageSize to max", () => {
    const result = parsePagination(makeParams({ pageSize: "200" }));
    expect(result.pageSize).toBe(PAGE_SIZE_MAX);
  });

  it("accepts limit param as alias", () => {
    const result = parsePagination(makeParams({ limit: "15" }));
    expect(result.pageSize).toBe(15);
  });

  it("clamps page minimum to 1", () => {
    const result = parsePagination(makeParams({ page: "-5" }));
    expect(result.page).toBe(1);
  });

  it("paginationMeta calculates totalPages", () => {
    const params = parsePagination(makeParams({ pageSize: "10" }));
    const meta = paginationMeta(45, params);
    expect(meta.totalPages).toBe(5);
    expect(meta.total).toBe(45);
  });

  it("respects custom maxPageSize", () => {
    const result = parsePagination(makeParams({ pageSize: "100" }), { maxPageSize: 25 });
    expect(result.pageSize).toBe(25);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Query Profiler Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("QueryProfiler", () => {
  it("creates a profiler with zero initial stats", () => {
    const profiler = createRequestProfiler();
    const stats = profiler.getStats();
    expect(stats.queryCount).toBe(0);
    expect(stats.totalDurationMs).toBe(0);
  });

  it("records query stats", () => {
    const profiler = createRequestProfiler();
    profiler.recordQuery(15, "DSARCase", "findMany");
    profiler.recordQuery(25, "Task", "count");

    const stats = profiler.getStats();
    expect(stats.queryCount).toBe(2);
    expect(stats.totalDurationMs).toBe(40);
  });

  it("generates profiling headers", () => {
    const profiler = createRequestProfiler();
    profiler.recordQuery(10);
    profiler.recordQuery(20);

    const headers = profiler.getHeaders();
    expect(headers["X-Query-Count"]).toBe("2");
    expect(headers["X-Query-Duration-Ms"]).toBe("30");
    expect(headers["X-Request-Duration-Ms"]).toBeDefined();
  });
});
