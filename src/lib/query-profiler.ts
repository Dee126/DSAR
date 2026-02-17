/**
 * Query Profiler — Dev-only Prisma query diagnostics
 *
 * Tracks query count and duration per request. Disabled in production.
 * Outputs X-Query-Count and X-Query-Duration-Ms headers.
 *
 * Usage in API routes:
 *   const profiler = createRequestProfiler();
 *   // ... run queries ...
 *   const headers = profiler.getHeaders();
 *   return NextResponse.json(data, { headers });
 */

function isProfilingEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test" ||
    process.env.ENABLE_QUERY_PROFILING === "true"
  );
}

export interface RequestProfiler {
  /** Record a query execution */
  recordQuery(durationMs: number, model?: string, action?: string): void;
  /** Get profiling headers for the response */
  getHeaders(): Record<string, string>;
  /** Get raw stats */
  getStats(): { queryCount: number; totalDurationMs: number; queries: QueryRecord[] };
}

interface QueryRecord {
  model?: string;
  action?: string;
  durationMs: number;
  timestamp: number;
}

class DevRequestProfiler implements RequestProfiler {
  private queries: QueryRecord[] = [];
  private startTime = Date.now();

  recordQuery(durationMs: number, model?: string, action?: string) {
    this.queries.push({ model, action, durationMs, timestamp: Date.now() });
  }

  getHeaders(): Record<string, string> {
    const totalDuration = this.queries.reduce((sum, q) => sum + q.durationMs, 0);
    return {
      "X-Query-Count": String(this.queries.length),
      "X-Query-Duration-Ms": String(Math.round(totalDuration)),
      "X-Request-Duration-Ms": String(Date.now() - this.startTime),
    };
  }

  getStats() {
    return {
      queryCount: this.queries.length,
      totalDurationMs: this.queries.reduce((sum, q) => sum + q.durationMs, 0),
      queries: this.queries,
    };
  }
}

class NoopRequestProfiler implements RequestProfiler {
  recordQuery() {}
  getHeaders() { return {}; }
  getStats() { return { queryCount: 0, totalDurationMs: 0, queries: [] }; }
}

/**
 * Create a request-scoped profiler.
 * Returns a noop profiler in production.
 */
export function createRequestProfiler(): RequestProfiler {
  if (isProfilingEnabled()) {
    return new DevRequestProfiler();
  }
  return new NoopRequestProfiler();
}

// ─── Global query log (dev only) ────────────────────────────────────────────

interface SlowQueryEntry {
  route: string;
  queryCount: number;
  durationMs: number;
  timestamp: Date;
}

const slowQueryLog: SlowQueryEntry[] = [];
const MAX_SLOW_LOG_SIZE = 100;
const SLOW_QUERY_THRESHOLD_MS = 200;

/**
 * Record endpoint diagnostics. Call at the end of API handlers.
 */
export function recordEndpointDiagnostics(
  route: string,
  profiler: RequestProfiler,
): void {
  if (!isProfilingEnabled()) return;

  const stats = profiler.getStats();
  if (stats.totalDurationMs >= SLOW_QUERY_THRESHOLD_MS || stats.queryCount > 10) {
    slowQueryLog.push({
      route,
      queryCount: stats.queryCount,
      durationMs: stats.totalDurationMs,
      timestamp: new Date(),
    });

    // Keep bounded
    if (slowQueryLog.length > MAX_SLOW_LOG_SIZE) {
      slowQueryLog.shift();
    }

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[PERF] ${route}: ${stats.queryCount} queries, ${Math.round(stats.totalDurationMs)}ms`,
      );
    }
  }
}

/**
 * Get slow query log entries (dev diagnostic endpoint).
 */
export function getSlowQueryLog(): SlowQueryEntry[] {
  return [...slowQueryLog];
}
