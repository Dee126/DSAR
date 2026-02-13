/**
 * Performance Test Mode — Main Entry Point
 *
 * Enterprise Load Simulation for PrivacyPilot.
 * Validates scalability of Discovery Engine, Detection Engine,
 * and Governance mechanisms under realistic enterprise load.
 *
 * SAFETY: Only activatable in Dev/Test/Demo mode.
 */

import { createSeededRandom } from "../synthetic/random";
import type {
  PerformanceConfig,
  PerformanceMetricsSnapshot,
  FailureSimulationConfig,
  PerformanceLimits,
  EnterpriseDemoSummary,
  ConcurrencyTestResult,
  SecurityTestResult,
} from "./types";
import {
  DEFAULT_PERFORMANCE_LIMITS,
  DEFAULT_FAILURE_CONFIG,
  getPersonCountForPreset,
  getEvidencePerPerson,
} from "./types";
import {
  generateScalableDataset,
  validatePerformanceConfig,
  validatePerformanceMode,
} from "./scalable-generator";
import { runParallelSimulation } from "./parallel-runner";
import { buildMetricsSnapshot, computeMetricsSummary, formatMetricsSummary } from "./metrics";
import { runConcurrencyTest, runSecurityUnderLoadTest } from "./concurrency-test";
import { runFailureSimulationSuite } from "./failure-simulation";
import type { FailureSimulationSuite } from "./failure-simulation";
import { buildEnterpriseDemoSummary, formatExecutiveView, validateDemoMode } from "./enterprise-demo";

// ---------------------------------------------------------------------------
// Full Performance Simulation
// ---------------------------------------------------------------------------

export interface PerformanceSimulationResult {
  config: PerformanceConfig;
  metrics: PerformanceMetricsSnapshot;
  concurrencyTest: ConcurrencyTestResult | null;
  securityTest: SecurityTestResult | null;
  failureTest: FailureSimulationSuite | null;
  enterpriseSummary: EnterpriseDemoSummary | null;
  totalDurationMs: number;
}

/**
 * Build a default PerformanceConfig.
 */
export function createDefaultConfig(overrides?: Partial<PerformanceConfig>): PerformanceConfig {
  return {
    personCount: overrides?.personCount ?? 1000,
    datasetSize: overrides?.datasetSize ?? "1k",
    evidenceDensity: overrides?.evidenceDensity ?? "low",
    specialCategoryRatio: overrides?.specialCategoryRatio ?? 0.10,
    parallelRuns: overrides?.parallelRuns ?? 5,
    detectionMode: overrides?.detectionMode ?? "simulated",
    seed: overrides?.seed ?? 42,
    failureSimulation: overrides?.failureSimulation ?? { ...DEFAULT_FAILURE_CONFIG },
    limits: overrides?.limits ?? { ...DEFAULT_PERFORMANCE_LIMITS },
  };
}

/**
 * Run the complete performance simulation.
 *
 * Steps:
 *   1. Validate config and environment
 *   2. Generate scalable synthetic dataset
 *   3. Run parallel CopilotRun simulations
 *   4. Collect metrics
 *   5. Optionally run concurrency/security/failure tests
 *   6. Build enterprise demo summary
 */
export function runPerformanceSimulation(
  config: PerformanceConfig,
  options?: {
    runConcurrency?: boolean;
    runSecurity?: boolean;
    runFailures?: boolean;
    buildDemoSummary?: boolean;
  },
): PerformanceSimulationResult {
  const totalStart = performance.now();
  const opts = {
    runConcurrency: true,
    runSecurity: true,
    runFailures: true,
    buildDemoSummary: true,
    ...options,
  };

  // 1. Validate
  const configError = validatePerformanceConfig(config);
  if (configError) {
    throw new Error(`Invalid performance config: ${configError}`);
  }

  // 2. Generate dataset
  const dataset = generateScalableDataset(config);

  // 3. Run parallel simulations
  const simResult = runParallelSimulation(config, dataset.persons);

  // 4. Collect metrics
  const metrics = buildMetricsSnapshot(
    simResult.runs,
    dataset.generationTimeMs,
    dataset.persons.length,
    dataset.totalEvidenceItems,
  );

  // 5. Optional tests
  let concurrencyResult: ConcurrencyTestResult | null = null;
  if (opts.runConcurrency) {
    concurrencyResult = runConcurrencyTest(25, 500000, config.seed);
  }

  let securityResult: SecurityTestResult | null = null;
  if (opts.runSecurity) {
    securityResult = runSecurityUnderLoadTest(100, 60, config.seed);
  }

  let failureResult: FailureSimulationSuite | null = null;
  if (opts.runFailures) {
    failureResult = runFailureSimulationSuite(config.seed);
  }

  // 6. Enterprise demo summary
  let enterpriseSummary: EnterpriseDemoSummary | null = null;
  if (opts.buildDemoSummary) {
    enterpriseSummary = buildEnterpriseDemoSummary(metrics);
  }

  return {
    config,
    metrics,
    concurrencyTest: concurrencyResult,
    securityTest: securityResult,
    failureTest: failureResult,
    enterpriseSummary,
    totalDurationMs: performance.now() - totalStart,
  };
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

// Types
export type {
  PerformanceConfig,
  DatasetSizePreset,
  EvidenceDensity,
  DetectionMode,
  FailureSimulationConfig,
  PerformanceLimits,
  RunMetrics,
  MetricsSummary,
  PerformanceMetricsSnapshot,
  ConcurrencyTestResult,
  SecurityTestResult,
  EnterpriseDemoSummary,
  PerformanceModeEnvironment,
  BatchResult,
} from "./types";

export {
  DEFAULT_PERFORMANCE_LIMITS,
  DEFAULT_FAILURE_CONFIG,
  getPersonCountForPreset,
  getEvidencePerPerson,
  EVIDENCE_DISTRIBUTION,
} from "./types";

// Scalable generator
export {
  generateScalableDataset,
  generatePersonsBatched,
  generateEvidenceBatched,
  generateEvidenceForPerson,
  validatePerformanceConfig,
  validatePerformanceMode,
} from "./scalable-generator";
export type { ScalableDataset, EvidenceBatch } from "./scalable-generator";

// Detection load
export {
  runDetectionLoad,
  runRealDetectionBatch,
  runSimulatedDetectionBatch,
  generateSimulatedDetection,
} from "./detection-load";
export type { DetectionBatchResult, DetectionLoadResult } from "./detection-load";

// Parallel runner
export {
  runParallelSimulation,
  simulateSingleRun,
} from "./parallel-runner";
export type { ParallelSimulationResult, ParallelRunConfig, QueueEntry, GovernanceLogEntry, AuditLogEntry } from "./parallel-runner";

// Metrics
export {
  computeMetricsSummary,
  buildMetricsSnapshot,
  getChartData,
  formatMetricsSummary,
} from "./metrics";
export type { ChartDataPoint } from "./metrics";

// Concurrency & security
export { runConcurrencyTest, runSecurityUnderLoadTest } from "./concurrency-test";

// Failure simulation
export {
  runFailureSimulationSuite,
  simulateFailure,
  validateFailureConfig,
  FAILURE_DEFINITIONS,
} from "./failure-simulation";
export type { FailureTestResult, FailureSimulationSuite, FailureType, FailureInjection } from "./failure-simulation";

// Enterprise demo
export {
  buildEnterpriseDemoSummary,
  formatExecutiveView,
  getExecutiveCards,
  validateDemoMode,
} from "./enterprise-demo";
