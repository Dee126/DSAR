/**
 * Metrics Collection & Dashboard Data — Performance Test Mode
 *
 * Computes aggregate metrics from parallel run results:
 *   - Average / P95 / Max run time
 *   - Detection throughput (items/sec)
 *   - DB write ops/sec
 *   - Art. 9 trigger rate
 *   - Queue wait time
 *   - Export generation time
 */

import type {
  RunMetrics,
  MetricsSummary,
  PerformanceMetricsSnapshot,
} from "./types";

// ---------------------------------------------------------------------------
// Percentile calculation
// ---------------------------------------------------------------------------

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

// ---------------------------------------------------------------------------
// Summary computation
// ---------------------------------------------------------------------------

/**
 * Compute aggregate metrics from a list of run metrics.
 */
export function computeMetricsSummary(runs: RunMetrics[]): MetricsSummary {
  if (runs.length === 0) {
    return {
      avgRunTimeMs: 0,
      p95RunTimeMs: 0,
      maxRunTimeMs: 0,
      avgEvidencePerRun: 0,
      detectionThroughputItemsPerSec: 0,
      queueWaitTimeAvgMs: 0,
      dbWriteOpsPerSec: 0,
      exportGenerationTimeAvgMs: 0,
      art9TriggerRate: 0,
      totalRuns: 0,
      completedRuns: 0,
      failedRuns: 0,
      partialRuns: 0,
    };
  }

  const durations = runs.map((r) => r.durationMs);
  const evidenceCounts = runs.map((r) => r.evidenceCount);
  const detectionTimes = runs.map((r) => r.detectionTimeMs);
  const queueWaitTimes = runs.map((r) => r.queueWaitTimeMs);
  const dbOps = runs.map((r) => r.dbWriteOpsEstimate);
  const exportTimes = runs.map((r) => r.exportGenerationTimeMs);
  const specialCounts = runs.map((r) => r.specialCategoryDetections);

  const totalEvidence = sum(evidenceCounts);
  const totalDetectionTime = sum(detectionTimes);
  const totalDuration = sum(durations);
  const totalDbOps = sum(dbOps);
  const totalSpecial = sum(specialCounts);

  return {
    avgRunTimeMs: Math.round(avg(durations) * 100) / 100,
    p95RunTimeMs: Math.round(percentile(durations, 95) * 100) / 100,
    maxRunTimeMs: Math.round(Math.max(...durations) * 100) / 100,
    avgEvidencePerRun: Math.round(avg(evidenceCounts)),
    detectionThroughputItemsPerSec:
      totalDetectionTime > 0
        ? Math.round((totalEvidence / totalDetectionTime) * 1000 * 100) / 100
        : 0,
    queueWaitTimeAvgMs: Math.round(avg(queueWaitTimes) * 100) / 100,
    dbWriteOpsPerSec:
      totalDuration > 0
        ? Math.round((totalDbOps / totalDuration) * 1000 * 100) / 100
        : 0,
    exportGenerationTimeAvgMs: Math.round(avg(exportTimes) * 100) / 100,
    art9TriggerRate:
      totalEvidence > 0
        ? Math.round((totalSpecial / totalEvidence) * 10000) / 10000
        : 0,
    totalRuns: runs.length,
    completedRuns: runs.filter((r) => r.status === "COMPLETED").length,
    failedRuns: runs.filter((r) => r.status === "FAILED").length,
    partialRuns: runs.filter((r) => r.status === "PARTIAL_COMPLETED").length,
  };
}

/**
 * Build a complete metrics snapshot from run results.
 */
export function buildMetricsSnapshot(
  runs: RunMetrics[],
  generationTimeMs: number,
  totalPersons: number,
  totalEvidenceItems: number,
): PerformanceMetricsSnapshot {
  return {
    runs,
    summary: computeMetricsSummary(runs),
    generationTimeMs,
    totalPersons,
    totalEvidenceItems,
  };
}

// ---------------------------------------------------------------------------
// Chart data (last N runs)
// ---------------------------------------------------------------------------

export interface ChartDataPoint {
  runIndex: number;
  runId: string;
  durationMs: number;
  evidenceCount: number;
  detectionTimeMs: number;
  specialCategoryDetections: number;
  status: string;
}

/**
 * Extract chart-friendly data points for the last N runs.
 */
export function getChartData(
  runs: RunMetrics[],
  lastN: number = 10,
): ChartDataPoint[] {
  const slice = runs.slice(-lastN);
  return slice.map((r, i) => ({
    runIndex: i,
    runId: r.runId,
    durationMs: Math.round(r.durationMs * 100) / 100,
    evidenceCount: r.evidenceCount,
    detectionTimeMs: Math.round(r.detectionTimeMs * 100) / 100,
    specialCategoryDetections: r.specialCategoryDetections,
    status: r.status,
  }));
}

// ---------------------------------------------------------------------------
// Formatted display helpers
// ---------------------------------------------------------------------------

/**
 * Format metrics summary as human-readable text.
 */
export function formatMetricsSummary(summary: MetricsSummary): string {
  const lines = [
    `=== Performance Metrics Summary ===`,
    `Total Runs: ${summary.totalRuns} (${summary.completedRuns} completed, ${summary.failedRuns} failed, ${summary.partialRuns} partial)`,
    ``,
    `Run Times:`,
    `  Average: ${summary.avgRunTimeMs.toFixed(1)}ms`,
    `  P95:     ${summary.p95RunTimeMs.toFixed(1)}ms`,
    `  Max:     ${summary.maxRunTimeMs.toFixed(1)}ms`,
    ``,
    `Throughput:`,
    `  Avg Evidence/Run:    ${summary.avgEvidencePerRun}`,
    `  Detection:           ${summary.detectionThroughputItemsPerSec.toFixed(1)} items/sec`,
    `  DB Write Ops:        ${summary.dbWriteOpsPerSec.toFixed(1)} ops/sec`,
    `  Export Gen (avg):    ${summary.exportGenerationTimeAvgMs.toFixed(1)}ms`,
    ``,
    `Queue Wait Time (avg): ${summary.queueWaitTimeAvgMs.toFixed(1)}ms`,
    `Art. 9 Trigger Rate:   ${(summary.art9TriggerRate * 100).toFixed(2)}%`,
  ];
  return lines.join("\n");
}
