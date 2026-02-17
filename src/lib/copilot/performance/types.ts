/**
 * Performance Test Mode — Types & Configuration
 *
 * All types for the Enterprise Load Simulation system.
 * SAFETY: Performance mode only activatable in Dev/Test/Demo mode.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type DatasetSizePreset = "1k" | "5k" | "10k" | "custom";
export type EvidenceDensity = "low" | "medium" | "high";
export type DetectionMode = "real" | "simulated";

export interface PerformanceConfig {
  /** Number of persons (1,000–50,000) */
  personCount: number;
  /** Preset label for UI */
  datasetSize: DatasetSizePreset;
  /** Evidence items per person */
  evidenceDensity: EvidenceDensity;
  /** Ratio of Art. 9 special category persons (0.05–0.20) */
  specialCategoryRatio: number;
  /** Parallel CopilotRuns to simulate */
  parallelRuns: number;
  /** Detection approach */
  detectionMode: DetectionMode;
  /** Deterministic seed */
  seed: number;
  /** Failure simulation options */
  failureSimulation: FailureSimulationConfig;
  /** Hard limits */
  limits: PerformanceLimits;
}

export interface FailureSimulationConfig {
  simulateM365Failure: boolean;
  simulateTimeout: boolean;
  simulateDbSlowWrite: boolean;
  simulateExportCrash: boolean;
}

export interface PerformanceLimits {
  maxEvidenceItemsPerRun: number;
  maxContentScanBytes: number;
  batchSize: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_PERFORMANCE_LIMITS: PerformanceLimits = {
  maxEvidenceItemsPerRun: 50000,
  maxContentScanBytes: 104857600, // 100 MB
  batchSize: 500,
};

export const DEFAULT_FAILURE_CONFIG: FailureSimulationConfig = {
  simulateM365Failure: false,
  simulateTimeout: false,
  simulateDbSlowWrite: false,
  simulateExportCrash: false,
};

export function getPersonCountForPreset(preset: DatasetSizePreset): number {
  switch (preset) {
    case "1k": return 1000;
    case "5k": return 5000;
    case "10k": return 10000;
    case "custom": return 1000;
  }
}

export function getEvidencePerPerson(density: EvidenceDensity): number {
  switch (density) {
    case "low": return 5;
    case "medium": return 25;
    case "high": return 100;
  }
}

// ---------------------------------------------------------------------------
// Evidence distribution (40% Email, 30% SP, 20% OD, 10% Misc)
// ---------------------------------------------------------------------------

export const EVIDENCE_DISTRIBUTION = {
  email: 0.40,
  sharepoint: 0.30,
  onedrive: 0.20,
  misc: 0.10,
} as const;

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export interface RunMetrics {
  runId: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  evidenceCount: number;
  detectionTimeMs: number;
  exportGenerationTimeMs: number;
  dbWriteOpsEstimate: number;
  queueWaitTimeMs: number;
  memoryUsedBytes: number;
  specialCategoryDetections: number;
  status: "COMPLETED" | "PARTIAL_COMPLETED" | "FAILED";
  errorDetails: string | null;
  batchesProcessed: number;
  totalBatches: number;
}

export interface PerformanceMetricsSnapshot {
  runs: RunMetrics[];
  summary: MetricsSummary;
  generationTimeMs: number;
  totalPersons: number;
  totalEvidenceItems: number;
}

export interface MetricsSummary {
  avgRunTimeMs: number;
  p95RunTimeMs: number;
  maxRunTimeMs: number;
  avgEvidencePerRun: number;
  detectionThroughputItemsPerSec: number;
  queueWaitTimeAvgMs: number;
  dbWriteOpsPerSec: number;
  exportGenerationTimeAvgMs: number;
  art9TriggerRate: number;
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  partialRuns: number;
}

// ---------------------------------------------------------------------------
// Concurrency & Throttling
// ---------------------------------------------------------------------------

export interface ConcurrencyTestResult {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  rateLimitTriggered: number;
  retryAttempts: number;
  governanceEnforced: boolean;
  exportsCorrectlyGated: boolean;
  auditLogsComplete: boolean;
  noSystemBlocks: boolean;
  crossTenantLeakage: boolean;
  unmaskedPiiInLogs: boolean;
  breakGlassEventsLogged: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Security Under Load
// ---------------------------------------------------------------------------

export interface SecurityTestResult {
  totalRequests: number;
  requestsInWindow: number;
  windowDurationSec: number;
  rateLimitingActive: boolean;
  breakGlassEventsLogged: number;
  crossTenantLeakageDetected: boolean;
  unmaskedPiiDetected: boolean;
  allAuditLogsPresent: boolean;
  passed: boolean;
}

// ---------------------------------------------------------------------------
// Enterprise Demo Summary
// ---------------------------------------------------------------------------

export interface EnterpriseDemoSummary {
  recordsProcessed: number;
  processingTimeSec: number;
  specialCategoryDetections: number;
  policyViolations: number;
  auditCoveragePercent: number;
  parallelRunsCompleted: number;
  governanceChecksPerformed: number;
  exportGatesActivated: number;
}

// ---------------------------------------------------------------------------
// Batch Processing
// ---------------------------------------------------------------------------

export interface BatchResult<T> {
  batchIndex: number;
  items: T[];
  processedCount: number;
  durationMs: number;
}

export type PerformanceModeEnvironment = "development" | "demo_tenant" | "test";
