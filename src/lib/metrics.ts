/**
 * In-Memory Metrics Collector
 *
 * Tracks request counts, error counts, and latency per route.
 * Data is held in memory — resets on restart.
 * Suitable for dev/single-instance. For multi-instance, use external metrics.
 *
 * Usage in middleware or routes:
 *   import { metrics } from "@/lib/metrics";
 *   metrics.recordRequest("/api/cases", 200, 42);
 *   metrics.recordError("/api/cases", "HTTP_500");
 */

interface RouteMetrics {
  requestCount: number;
  errorCount: number;
  totalLatencyMs: number;
  errorsByCode: Record<string, number>;
  lastRequestAt: number;
}

interface JobMetrics {
  totalRuns: number;
  successCount: number;
  failureCount: number;
  totalDurationMs: number;
}

const routeMetrics = new Map<string, RouteMetrics>();
const jobMetrics = new Map<string, JobMetrics>();
let startedAt = Date.now();

function getOrCreateRoute(route: string): RouteMetrics {
  let m = routeMetrics.get(route);
  if (!m) {
    m = { requestCount: 0, errorCount: 0, totalLatencyMs: 0, errorsByCode: {}, lastRequestAt: 0 };
    routeMetrics.set(route, m);
  }
  return m;
}

function getOrCreateJob(jobName: string): JobMetrics {
  let m = jobMetrics.get(jobName);
  if (!m) {
    m = { totalRuns: 0, successCount: 0, failureCount: 0, totalDurationMs: 0 };
    jobMetrics.set(jobName, m);
  }
  return m;
}

export const metrics = {
  /**
   * Record a completed request.
   */
  recordRequest(route: string, statusCode: number, latencyMs: number): void {
    const m = getOrCreateRoute(route);
    m.requestCount++;
    m.totalLatencyMs += latencyMs;
    m.lastRequestAt = Date.now();

    if (statusCode >= 400) {
      m.errorCount++;
      const code = `HTTP_${statusCode}`;
      m.errorsByCode[code] = (m.errorsByCode[code] ?? 0) + 1;
    }
  },

  /**
   * Record an error (outside of HTTP context).
   */
  recordError(route: string, errorCode: string): void {
    const m = getOrCreateRoute(route);
    m.errorCount++;
    m.errorsByCode[errorCode] = (m.errorsByCode[errorCode] ?? 0) + 1;
  },

  /**
   * Record a job execution.
   */
  recordJob(jobName: string, success: boolean, durationMs: number): void {
    const m = getOrCreateJob(jobName);
    m.totalRuns++;
    m.totalDurationMs += durationMs;
    if (success) m.successCount++;
    else m.failureCount++;
  },

  /**
   * Get snapshot of all metrics.
   */
  getSnapshot(): {
    uptime_seconds: number;
    started_at: string;
    routes: Record<string, {
      requests_total: number;
      errors_total: number;
      avg_latency_ms: number;
      errors_by_code: Record<string, number>;
    }>;
    jobs: Record<string, {
      runs_total: number;
      success_total: number;
      failure_total: number;
      avg_duration_ms: number;
    }>;
  } {
    const routes: Record<string, { requests_total: number; errors_total: number; avg_latency_ms: number; errors_by_code: Record<string, number> }> = {};

    routeMetrics.forEach((m, route) => {
      routes[route] = {
        requests_total: m.requestCount,
        errors_total: m.errorCount,
        avg_latency_ms: m.requestCount > 0 ? Math.round(m.totalLatencyMs / m.requestCount) : 0,
        errors_by_code: { ...m.errorsByCode },
      };
    });

    const jobs: Record<string, { runs_total: number; success_total: number; failure_total: number; avg_duration_ms: number }> = {};

    jobMetrics.forEach((m, name) => {
      jobs[name] = {
        runs_total: m.totalRuns,
        success_total: m.successCount,
        failure_total: m.failureCount,
        avg_duration_ms: m.totalRuns > 0 ? Math.round(m.totalDurationMs / m.totalRuns) : 0,
      };
    });

    return {
      uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
      started_at: new Date(startedAt).toISOString(),
      routes,
      jobs,
    };
  },

  /**
   * Reset all metrics (for testing).
   */
  _reset(): void {
    routeMetrics.clear();
    jobMetrics.clear();
    startedAt = Date.now();
  },
};
