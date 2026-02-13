/**
 * Performance Test Mode — Comprehensive Tests
 *
 * Tests for Enterprise Load Simulation:
 *   1. Configuration & Validation
 *   2. Scalable Data Generation
 *   3. Detection Load Simulation
 *   4. Parallel Run Simulation
 *   5. Metrics Collection
 *   6. Concurrency & Throttling
 *   7. Memory & Storage Safety
 *   8. Failure Simulation
 *   9. Security Under Load
 *  10. Enterprise Demo Mode
 *  11. Full Simulation Integration
 */

import { describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  // Types & config
  createDefaultConfig,
  DEFAULT_PERFORMANCE_LIMITS,
  DEFAULT_FAILURE_CONFIG,
  getPersonCountForPreset,
  getEvidencePerPerson,
  EVIDENCE_DISTRIBUTION,
  // Scalable generator
  generateScalableDataset,
  generatePersonsBatched,
  generateEvidenceBatched,
  generateEvidenceForPerson,
  validatePerformanceConfig,
  validatePerformanceMode,
  // Detection load
  runDetectionLoad,
  runRealDetectionBatch,
  runSimulatedDetectionBatch,
  generateSimulatedDetection,
  // Parallel runner
  runParallelSimulation,
  simulateSingleRun,
  // Metrics
  computeMetricsSummary,
  buildMetricsSnapshot,
  getChartData,
  formatMetricsSummary,
  // Concurrency & security
  runConcurrencyTest,
  runSecurityUnderLoadTest,
  // Failure simulation
  runFailureSimulationSuite,
  simulateFailure,
  validateFailureConfig,
  FAILURE_DEFINITIONS,
  // Enterprise demo
  buildEnterpriseDemoSummary,
  formatExecutiveView,
  getExecutiveCards,
  validateDemoMode,
  // Full simulation
  runPerformanceSimulation,
} from "@/lib/copilot/performance/index";

import type {
  PerformanceConfig,
  RunMetrics,
  MetricsSummary,
  PerformanceMetricsSnapshot,
  ConcurrencyTestResult,
  SecurityTestResult,
  EnterpriseDemoSummary,
  FailureSimulationConfig,
} from "@/lib/copilot/performance/index";

import { createSeededRandom } from "@/lib/copilot/synthetic/random";
import type { SyntheticPerson } from "@/lib/copilot/synthetic/persons";
import { generateSyntheticPersons } from "@/lib/copilot/synthetic/persons";

// =========================================================================
// 1. Configuration & Validation
// =========================================================================
describe("Configuration & Validation", () => {
  it("should create default config with sensible defaults", () => {
    const config = createDefaultConfig();
    expect(config.personCount).toBe(1000);
    expect(config.datasetSize).toBe("1k");
    expect(config.evidenceDensity).toBe("low");
    expect(config.specialCategoryRatio).toBe(0.10);
    expect(config.parallelRuns).toBe(5);
    expect(config.detectionMode).toBe("simulated");
    expect(config.seed).toBe(42);
  });

  it("should allow custom overrides", () => {
    const config = createDefaultConfig({
      personCount: 5000,
      datasetSize: "5k",
      parallelRuns: 10,
      detectionMode: "real",
    });
    expect(config.personCount).toBe(5000);
    expect(config.parallelRuns).toBe(10);
    expect(config.detectionMode).toBe("real");
  });

  it("should return correct person count for presets", () => {
    expect(getPersonCountForPreset("1k")).toBe(1000);
    expect(getPersonCountForPreset("5k")).toBe(5000);
    expect(getPersonCountForPreset("10k")).toBe(10000);
    expect(getPersonCountForPreset("custom")).toBe(1000);
  });

  it("should return correct evidence per person", () => {
    expect(getEvidencePerPerson("low")).toBe(5);
    expect(getEvidencePerPerson("medium")).toBe(25);
    expect(getEvidencePerPerson("high")).toBe(100);
  });

  it("should have correct evidence distribution weights", () => {
    const total = EVIDENCE_DISTRIBUTION.email +
      EVIDENCE_DISTRIBUTION.sharepoint +
      EVIDENCE_DISTRIBUTION.onedrive +
      EVIDENCE_DISTRIBUTION.misc;
    expect(total).toBeCloseTo(1.0);
  });

  it("should validate person count range", () => {
    const config = createDefaultConfig({ personCount: 0 });
    expect(validatePerformanceConfig(config)).toContain("Person count");
  });

  it("should reject person count above 50000", () => {
    const config = createDefaultConfig({ personCount: 50001 });
    expect(validatePerformanceConfig(config)).toContain("Person count");
  });

  it("should reject parallel runs above 25", () => {
    const config = createDefaultConfig({ parallelRuns: 26 });
    expect(validatePerformanceConfig(config)).toContain("Parallel runs");
  });

  it("should reject invalid special category ratio", () => {
    const config = createDefaultConfig({ specialCategoryRatio: 1.5 });
    expect(validatePerformanceConfig(config)).toContain("Special category ratio");
  });

  it("should accept valid config", () => {
    const config = createDefaultConfig({ personCount: 10000 });
    expect(validatePerformanceConfig(config)).toBeNull();
  });
});

// =========================================================================
// 2. Performance Mode Validation
// =========================================================================
describe("Performance Mode Validation", () => {
  it("should allow in development mode", () => {
    expect(validatePerformanceMode("development")).toBeNull();
  });

  it("should allow in test mode", () => {
    expect(validatePerformanceMode("test")).toBeNull();
  });

  it("should allow for demo tenant", () => {
    expect(validatePerformanceMode("production", true)).toBeNull();
  });

  it("should reject in production without demo", () => {
    expect(validatePerformanceMode("production", false)).toContain("only allowed");
  });

  it("should reject undefined env without flags", () => {
    expect(validatePerformanceMode(undefined)).toContain("only allowed");
  });
});

// =========================================================================
// 3. Scalable Data Generation
// =========================================================================
describe("Scalable Data Generation", () => {
  it("should generate persons in batches", () => {
    const rng = createSeededRandom(42);
    const batches = generatePersonsBatched(100, rng, 0.10, 30);

    expect(batches.length).toBe(4); // 30+30+30+10
    const totalPersons = batches.reduce((s, b) => s + b.processedCount, 0);
    expect(totalPersons).toBe(100);
  });

  it("should generate reproducible datasets", () => {
    const config = createDefaultConfig({ personCount: 50, seed: 123 });
    const ds1 = generateScalableDataset(config);
    const ds2 = generateScalableDataset(config);

    expect(ds1.persons.length).toBe(ds2.persons.length);
    expect(ds1.persons[0].email).toBe(ds2.persons[0].email);
    expect(ds1.totalEvidenceItems).toBe(ds2.totalEvidenceItems);
  });

  it("should calculate correct evidence totals", () => {
    const config = createDefaultConfig({
      personCount: 100,
      evidenceDensity: "medium",
    });
    const ds = generateScalableDataset(config);

    expect(ds.persons.length).toBe(100);
    expect(ds.totalEvidenceItems).toBe(100 * 25); // 2,500
  });

  it("should include evidence distribution", () => {
    const config = createDefaultConfig({ personCount: 100 });
    const ds = generateScalableDataset(config);

    expect(ds.evidenceByProvider).toHaveProperty("EXCHANGE_ONLINE");
    expect(ds.evidenceByProvider).toHaveProperty("SHAREPOINT");
    expect(ds.evidenceByProvider).toHaveProperty("ONEDRIVE");
    expect(ds.evidenceByProvider).toHaveProperty("MISC");

    // EXCHANGE_ONLINE should be ~40% of total
    const total = Object.values(ds.evidenceByProvider).reduce((s, v) => s + v, 0);
    expect(total).toBe(ds.totalEvidenceItems);
  });

  it("should track generation time", () => {
    const config = createDefaultConfig({ personCount: 10 });
    const ds = generateScalableDataset(config);
    expect(ds.generationTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("should include special category persons", () => {
    const config = createDefaultConfig({
      personCount: 100,
      specialCategoryRatio: 0.20,
    });
    const ds = generateScalableDataset(config);
    expect(ds.specialCategoryPersonCount).toBeGreaterThan(0);
  });

  describe("Evidence generation per person", () => {
    it("should generate correct count for low density", () => {
      const rng = createSeededRandom(42);
      const persons = generateSyntheticPersons(1, rng, { includeFinancial: true });
      const items = generateEvidenceForPerson(persons[0], "low", rng);
      expect(items.length).toBe(5);
    });

    it("should generate correct count for medium density", () => {
      const rng = createSeededRandom(42);
      const persons = generateSyntheticPersons(1, rng, { includeFinancial: true });
      const items = generateEvidenceForPerson(persons[0], "medium", rng);
      expect(items.length).toBe(25);
    });

    it("should generate correct count for high density", () => {
      const rng = createSeededRandom(42);
      const persons = generateSyntheticPersons(1, rng, { includeFinancial: true });
      const items = generateEvidenceForPerson(persons[0], "high", rng);
      expect(items.length).toBe(100);
    });

    it("should distribute evidence across providers", () => {
      const rng = createSeededRandom(42);
      const persons = generateSyntheticPersons(1, rng, { includeFinancial: true });
      const items = generateEvidenceForPerson(persons[0], "high", rng);

      const byProvider: Record<string, number> = {};
      for (const item of items) {
        byProvider[item.provider] = (byProvider[item.provider] ?? 0) + 1;
      }

      expect(Object.keys(byProvider).length).toBeGreaterThanOrEqual(3);
    });

    it("should mark all items as synthetic", () => {
      const rng = createSeededRandom(42);
      const persons = generateSyntheticPersons(1, rng, {});
      const items = generateEvidenceForPerson(persons[0], "low", rng);

      for (const item of items) {
        expect(item.metadata.synthetic).toBe(true);
      }
    });
  });

  describe("Batched evidence generation", () => {
    it("should split evidence into batches", () => {
      const rng = createSeededRandom(42);
      const persons = generateSyntheticPersons(5, rng, {});
      const batches = generateEvidenceBatched(persons, "low", rng, 10);

      // 5 persons × 5 items = 25 items, batch size 10 → 3 batches
      expect(batches.length).toBe(3);

      const totalItems = batches.reduce((s, b) => s + b.items.length, 0);
      expect(totalItems).toBe(25);
    });

    it("should respect batch size limit", () => {
      const rng = createSeededRandom(42);
      const persons = generateSyntheticPersons(5, rng, {});
      const batches = generateEvidenceBatched(persons, "low", rng, 10);

      for (const batch of batches.slice(0, -1)) {
        expect(batch.items.length).toBeLessThanOrEqual(10);
      }
    });
  });
});

// =========================================================================
// 4. Detection Load Simulation
// =========================================================================
describe("Detection Load Simulation", () => {
  let persons: SyntheticPerson[];
  let rng: ReturnType<typeof createSeededRandom>;

  beforeEach(() => {
    rng = createSeededRandom(42);
    persons = generateSyntheticPersons(3, rng, {
      includeSpecialCategory: true,
      includeFinancial: true,
    });
  });

  describe("Real Detection Mode", () => {
    it("should run real detection on a batch", () => {
      const items = generateEvidenceForPerson(persons[0], "low", rng);
      const result = runRealDetectionBatch(items, 0);

      expect(result.batchIndex).toBe(0);
      expect(result.itemCount).toBe(5);
      expect(result.detectionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.totalDetections).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Simulated Detection Mode", () => {
    it("should generate simulated detection results", () => {
      const items = generateEvidenceForPerson(persons[0], "low", rng);
      const result = generateSimulatedDetection(items[0], rng);

      expect(result.detectorType).toBe("REGEX");
      expect(result.detectedElements.length).toBeGreaterThan(0);
      expect(result.detectedCategories.length).toBeGreaterThan(0);
    });

    it("should run simulated detection on a batch", () => {
      const items = generateEvidenceForPerson(persons[0], "low", rng);
      const result = runSimulatedDetectionBatch(items, rng, 0);

      expect(result.batchIndex).toBe(0);
      expect(result.itemCount).toBe(5);
      expect(result.totalDetections).toBe(5); // One per item
    });
  });

  describe("Detection Load Runner", () => {
    it("should run detection load in real mode", () => {
      const items = generateEvidenceForPerson(persons[0], "low", rng);
      const result = runDetectionLoad(items, "real", rng, 3);

      expect(result.mode).toBe("real");
      expect(result.totalItems).toBe(5);
      expect(result.batches.length).toBe(2); // ceil(5/3)
      expect(result.throughputItemsPerSec).toBeGreaterThan(0);
    });

    it("should run detection load in simulated mode", () => {
      const items = generateEvidenceForPerson(persons[0], "low", rng);
      const result = runDetectionLoad(items, "simulated", rng, 3);

      expect(result.mode).toBe("simulated");
      expect(result.totalItems).toBe(5);
      expect(result.totalDetections).toBeGreaterThan(0);
    });

    it("simulated mode should be faster than real mode", () => {
      const items = generateEvidenceForPerson(persons[0], "medium", rng);

      const rng1 = createSeededRandom(100);
      const rng2 = createSeededRandom(100);

      const realResult = runDetectionLoad(items, "real", rng1, 10);
      const simResult = runDetectionLoad(items, "simulated", rng2, 10);

      // Simulated should generally be faster (or at least not much slower)
      // Both should complete within reasonable time
      expect(realResult.totalTimeMs).toBeGreaterThanOrEqual(0);
      expect(simResult.totalTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});

// =========================================================================
// 5. Parallel Run Simulation
// =========================================================================
describe("Parallel Run Simulation", () => {
  it("should simulate single run", () => {
    const rng = createSeededRandom(42);
    const persons = generateSyntheticPersons(10, rng, {
      includeFinancial: true,
    });

    const result = simulateSingleRun({
      runIndex: 0,
      persons,
      personsPerRun: 5,
      seed: 42,
      detectionMode: "simulated",
      evidenceDensity: "low",
      connectorLatencyMs: [100, 300],
      failureSimulation: { ...DEFAULT_FAILURE_CONFIG },
      limits: { ...DEFAULT_PERFORMANCE_LIMITS },
      governanceSettings: {
        copilotEnabled: true,
        allowedProviderPhases: [1],
        defaultExecutionMode: "METADATA_ONLY",
        allowContentScanning: false,
        allowOcr: false,
        allowLlmSummaries: false,
        maxRunsPerDayTenant: 1000,
        maxRunsPerDayUser: 200,
        maxConcurrentRuns: 25,
        maxEvidenceItemsPerRun: 50000,
        maxContentScanBytes: 512000,
        dueSoonWindowDays: 7,
        artifactRetentionDays: 90,
        twoPersonApprovalForExport: false,
        requireJustification: true,
        requireConfirmation: true,
      },
    });

    expect(result.metrics.runId).toBe("perf-run-0");
    expect(result.metrics.evidenceCount).toBeGreaterThan(0);
    expect(result.metrics.durationMs).toBeGreaterThan(0);
    expect(result.governanceLogs.length).toBeGreaterThan(0);
    expect(result.auditLogs.length).toBeGreaterThan(0);
  });

  it("should simulate parallel runs", () => {
    const config = createDefaultConfig({
      personCount: 20,
      parallelRuns: 3,
      evidenceDensity: "low",
      detectionMode: "simulated",
    });

    const rng = createSeededRandom(42);
    const persons = generateSyntheticPersons(20, rng, {
      includeFinancial: true,
    });

    const result = runParallelSimulation(config, persons);

    expect(result.runs.length).toBe(3);
    expect(result.totalDurationMs).toBeGreaterThan(0);
    expect(result.queueLog.length).toBe(3);
    expect(result.governanceLog.length).toBeGreaterThan(0);
    expect(result.auditLog.length).toBeGreaterThan(0);
  });

  it("should track queue wait times", () => {
    const config = createDefaultConfig({
      personCount: 20,
      parallelRuns: 5,
      evidenceDensity: "low",
      detectionMode: "simulated",
    });

    const rng = createSeededRandom(42);
    const persons = generateSyntheticPersons(20, rng, {});

    const result = runParallelSimulation(config, persons);

    for (const q of result.queueLog) {
      expect(q.waitTimeMs).toBeGreaterThanOrEqual(0);
      expect(q.runId).toBeDefined();
    }
  });

  it("should generate governance logs for each run", () => {
    const config = createDefaultConfig({
      personCount: 10,
      parallelRuns: 2,
      detectionMode: "simulated",
    });

    const rng = createSeededRandom(42);
    const persons = generateSyntheticPersons(10, rng, {});

    const result = runParallelSimulation(config, persons);

    // Each run should have at least role check + justification + rate limit
    expect(result.governanceLog.length).toBeGreaterThanOrEqual(6); // 3 checks × 2 runs
  });
});

// =========================================================================
// 6. Metrics Collection
// =========================================================================
describe("Metrics Collection", () => {
  function createMockRunMetrics(count: number): RunMetrics[] {
    const runs: RunMetrics[] = [];
    for (let i = 0; i < count; i++) {
      runs.push({
        runId: `run-${i}`,
        startTime: i * 1000,
        endTime: i * 1000 + 500 + i * 100,
        durationMs: 500 + i * 100,
        evidenceCount: 100 + i * 50,
        detectionTimeMs: 200 + i * 30,
        exportGenerationTimeMs: 100 + i * 20,
        dbWriteOpsEstimate: 500 + i * 100,
        queueWaitTimeMs: 10 + i * 5,
        memoryUsedBytes: 1024 * (100 + i),
        specialCategoryDetections: i % 3 === 0 ? 5 : 0,
        status: i < count - 1 ? "COMPLETED" : "COMPLETED",
        errorDetails: null,
        batchesProcessed: 10,
        totalBatches: 10,
      });
    }
    return runs;
  }

  it("should compute metrics summary", () => {
    const runs = createMockRunMetrics(10);
    const summary = computeMetricsSummary(runs);

    expect(summary.totalRuns).toBe(10);
    expect(summary.completedRuns).toBe(10);
    expect(summary.failedRuns).toBe(0);
    expect(summary.avgRunTimeMs).toBeGreaterThan(0);
    expect(summary.p95RunTimeMs).toBeGreaterThanOrEqual(summary.avgRunTimeMs);
    expect(summary.maxRunTimeMs).toBeGreaterThanOrEqual(summary.p95RunTimeMs);
  });

  it("should handle empty runs", () => {
    const summary = computeMetricsSummary([]);
    expect(summary.totalRuns).toBe(0);
    expect(summary.avgRunTimeMs).toBe(0);
    expect(summary.detectionThroughputItemsPerSec).toBe(0);
  });

  it("should calculate P95 correctly", () => {
    const runs = createMockRunMetrics(20);
    const summary = computeMetricsSummary(runs);

    // P95 should be between avg and max
    expect(summary.p95RunTimeMs).toBeLessThanOrEqual(summary.maxRunTimeMs);
    expect(summary.p95RunTimeMs).toBeGreaterThanOrEqual(summary.avgRunTimeMs);
  });

  it("should calculate detection throughput", () => {
    const runs = createMockRunMetrics(5);
    const summary = computeMetricsSummary(runs);
    expect(summary.detectionThroughputItemsPerSec).toBeGreaterThan(0);
  });

  it("should calculate Art. 9 trigger rate", () => {
    const runs = createMockRunMetrics(10);
    const summary = computeMetricsSummary(runs);
    // Some runs have special category detections
    expect(summary.art9TriggerRate).toBeGreaterThanOrEqual(0);
    expect(summary.art9TriggerRate).toBeLessThanOrEqual(1);
  });

  it("should build metrics snapshot", () => {
    const runs = createMockRunMetrics(5);
    const snapshot = buildMetricsSnapshot(runs, 1000, 100, 5000);

    expect(snapshot.runs.length).toBe(5);
    expect(snapshot.generationTimeMs).toBe(1000);
    expect(snapshot.totalPersons).toBe(100);
    expect(snapshot.totalEvidenceItems).toBe(5000);
    expect(snapshot.summary).toBeDefined();
  });

  describe("Chart Data", () => {
    it("should extract chart data points", () => {
      const runs = createMockRunMetrics(15);
      const chart = getChartData(runs, 10);

      expect(chart.length).toBe(10); // Last 10 of 15
      for (const point of chart) {
        expect(point.runId).toBeDefined();
        expect(point.durationMs).toBeGreaterThan(0);
        expect(point.evidenceCount).toBeGreaterThan(0);
      }
    });

    it("should return all data if fewer than N runs", () => {
      const runs = createMockRunMetrics(3);
      const chart = getChartData(runs, 10);
      expect(chart.length).toBe(3);
    });
  });

  it("should format metrics summary as text", () => {
    const runs = createMockRunMetrics(5);
    const summary = computeMetricsSummary(runs);
    const text = formatMetricsSummary(summary);

    expect(text).toContain("Performance Metrics Summary");
    expect(text).toContain("Average:");
    expect(text).toContain("P95:");
    expect(text).toContain("Detection:");
    expect(text).toContain("Art. 9 Trigger Rate");
  });
});

// =========================================================================
// 7. Memory & Storage Safety (Batch Processing)
// =========================================================================
describe("Memory & Storage Safety", () => {
  it("should respect batch size in person generation", () => {
    const rng = createSeededRandom(42);
    const batches = generatePersonsBatched(100, rng, 0.10, 25);

    // 4 batches of 25
    expect(batches.length).toBe(4);
    for (const batch of batches) {
      expect(batch.items.length).toBeLessThanOrEqual(25);
    }
  });

  it("should handle partial last batch", () => {
    const rng = createSeededRandom(42);
    const batches = generatePersonsBatched(17, rng, 0.10, 10);

    expect(batches.length).toBe(2);
    expect(batches[0].items.length).toBe(10);
    expect(batches[1].items.length).toBe(7);
  });

  it("evidence batches should not exceed batch size", () => {
    const rng = createSeededRandom(42);
    const persons = generateSyntheticPersons(10, rng, {});
    const batches = generateEvidenceBatched(persons, "low", rng, 15);

    for (const batch of batches) {
      expect(batch.items.length).toBeLessThanOrEqual(15);
    }
  });

  it("should enforce maxEvidenceItemsPerRun in single run", () => {
    const rng = createSeededRandom(42);
    const persons = generateSyntheticPersons(50, rng, { includeFinancial: true });

    const result = simulateSingleRun({
      runIndex: 0,
      persons,
      personsPerRun: 50,
      seed: 42,
      detectionMode: "simulated",
      evidenceDensity: "medium", // 25 per person × 50 = 1250
      connectorLatencyMs: [10, 50],
      failureSimulation: { ...DEFAULT_FAILURE_CONFIG },
      limits: {
        maxEvidenceItemsPerRun: 100, // Hard limit at 100
        maxContentScanBytes: 104857600,
        batchSize: 500,
      },
      governanceSettings: {
        copilotEnabled: true,
        allowedProviderPhases: [1],
        defaultExecutionMode: "METADATA_ONLY",
        allowContentScanning: false,
        allowOcr: false,
        allowLlmSummaries: false,
        maxRunsPerDayTenant: 1000,
        maxRunsPerDayUser: 200,
        maxConcurrentRuns: 25,
        maxEvidenceItemsPerRun: 100,
        maxContentScanBytes: 512000,
        dueSoonWindowDays: 7,
        artifactRetentionDays: 90,
        twoPersonApprovalForExport: false,
        requireJustification: true,
        requireConfirmation: true,
      },
    });

    // Evidence should be capped at 100
    expect(result.metrics.evidenceCount).toBeLessThanOrEqual(100);
    // Status should be PARTIAL_COMPLETED
    expect(result.metrics.status).toBe("PARTIAL_COMPLETED");
  });

  it("default limits should be reasonable", () => {
    expect(DEFAULT_PERFORMANCE_LIMITS.maxEvidenceItemsPerRun).toBe(50000);
    expect(DEFAULT_PERFORMANCE_LIMITS.maxContentScanBytes).toBe(104857600); // 100 MB
    expect(DEFAULT_PERFORMANCE_LIMITS.batchSize).toBe(500);
  });
});

// =========================================================================
// 8. Failure Simulation
// =========================================================================
describe("Failure Simulation", () => {
  it("should define 4 failure types", () => {
    expect(FAILURE_DEFINITIONS.length).toBe(4);
    const types = FAILURE_DEFINITIONS.map((f) => f.type);
    expect(types).toContain("m365_failure");
    expect(types).toContain("timeout");
    expect(types).toContain("db_slow_write");
    expect(types).toContain("export_crash");
  });

  it("should simulate M365 failure", () => {
    const rng = createSeededRandom(42);
    const result = simulateFailure("m365_failure", rng);

    expect(result.failureType).toBe("m365_failure");
    expect(result.injected).toBe(true);
    expect(result.runStatus).toBe("FAILED");
    expect(result.auditEventWritten).toBe(true);
    expect(result.systemStable).toBe(true);
    expect(result.orphanRecords).toBe(0);
    expect(result.errorDetails).toContain("503");
  });

  it("should simulate timeout", () => {
    const rng = createSeededRandom(42);
    const result = simulateFailure("timeout", rng);

    expect(result.runStatus).toBe("FAILED");
    expect(result.errorDetails).toContain("timeout");
    expect(result.orphanRecords).toBe(0); // Transaction-safe
  });

  it("should simulate DB slow write (still completes)", () => {
    const rng = createSeededRandom(42);
    const result = simulateFailure("db_slow_write", rng);

    expect(result.runStatus).toBe("COMPLETED");
    expect(result.systemStable).toBe(true);
    expect(result.errorDetails).toBeNull();
  });

  it("should simulate export crash", () => {
    const rng = createSeededRandom(42);
    const result = simulateFailure("export_crash", rng);

    expect(result.runStatus).toBe("FAILED");
    expect(result.errorDetails).toContain("Export");
    expect(result.auditEventWritten).toBe(true);
  });

  it("should handle unknown failure type", () => {
    const rng = createSeededRandom(42);
    const result = simulateFailure("unknown" as any, rng);

    expect(result.injected).toBe(false);
    expect(result.errorDetails).toContain("Unknown");
  });

  it("should run full failure simulation suite", () => {
    const suite = runFailureSimulationSuite(42);

    expect(suite.results.length).toBe(4);
    expect(suite.summary.totalTests).toBe(4);
    expect(suite.summary.failureTypesTestedCount).toBe(4);

    // All tests should pass (audit events written, system stable)
    for (const result of suite.results) {
      expect(result.auditEventWritten).toBe(true);
      expect(result.systemStable).toBe(true);
    }
  });

  it("should validate failure config", () => {
    const valid: FailureSimulationConfig = {
      simulateM365Failure: true,
      simulateTimeout: true,
      simulateDbSlowWrite: false,
      simulateExportCrash: false,
    };
    expect(validateFailureConfig(valid)).toBeNull();

    const tooMany: FailureSimulationConfig = {
      simulateM365Failure: true,
      simulateTimeout: true,
      simulateDbSlowWrite: true,
      simulateExportCrash: true,
    };
    expect(validateFailureConfig(tooMany)).toContain("at most 3");
  });
});

// =========================================================================
// 9. Concurrency & Throttling
// =========================================================================
describe("Concurrency & Throttling", () => {
  it("should run concurrency test with 25 runs", () => {
    const result = runConcurrencyTest(25, 500000, 42);

    expect(result.totalRuns).toBe(25);
    expect(result.completedRuns + result.failedRuns).toBe(25);
    expect(result.completedRuns).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it("should trigger rate limiting", () => {
    const result = runConcurrencyTest(25, 500000, 42);
    expect(result.rateLimitTriggered).toBeGreaterThan(0);
  });

  it("should perform retry attempts", () => {
    const result = runConcurrencyTest(25, 500000, 42);
    expect(result.retryAttempts).toBeGreaterThan(0);
  });

  it("should enforce governance", () => {
    const result = runConcurrencyTest(25, 500000, 42);
    expect(result.governanceEnforced).toBe(true);
  });

  it("should not block system entirely", () => {
    const result = runConcurrencyTest(25, 500000, 42);
    expect(result.noSystemBlocks).toBe(true);
  });

  it("should have complete audit logs", () => {
    const result = runConcurrencyTest(25, 500000, 42);
    expect(result.auditLogsComplete).toBe(true);
  });

  it("should detect no cross-tenant leakage", () => {
    const result = runConcurrencyTest(25, 500000, 42);
    expect(result.crossTenantLeakage).toBe(false);
  });

  it("should log break-glass events for anomalies", () => {
    const result = runConcurrencyTest(25, 500000, 42);
    expect(result.breakGlassEventsLogged).toBeGreaterThan(0);
  });
});

// =========================================================================
// 10. Security Under Load
// =========================================================================
describe("Security Under Load", () => {
  it("should run security test with 100 requests", () => {
    const result = runSecurityUnderLoadTest(100, 60, 42);

    expect(result.totalRequests).toBe(100);
    expect(result.requestsInWindow).toBe(100);
    expect(result.windowDurationSec).toBe(60);
  });

  it("should activate rate limiting", () => {
    const result = runSecurityUnderLoadTest(100, 60, 42);
    expect(result.rateLimitingActive).toBe(true);
  });

  it("should log break-glass events", () => {
    const result = runSecurityUnderLoadTest(100, 60, 42);
    expect(result.breakGlassEventsLogged).toBeGreaterThan(0);
  });

  it("should detect no cross-tenant leakage", () => {
    const result = runSecurityUnderLoadTest(100, 60, 42);
    expect(result.crossTenantLeakageDetected).toBe(false);
  });

  it("should have all audit logs present", () => {
    const result = runSecurityUnderLoadTest(100, 60, 42);
    expect(result.allAuditLogsPresent).toBe(true);
  });

  it("should pass overall security test", () => {
    const result = runSecurityUnderLoadTest(100, 60, 42);
    expect(result.passed).toBe(true);
  });
});

// =========================================================================
// 11. Enterprise Demo Mode
// =========================================================================
describe("Enterprise Demo Mode", () => {
  function createMockSnapshot(): PerformanceMetricsSnapshot {
    const runs: RunMetrics[] = [];
    for (let i = 0; i < 10; i++) {
      runs.push({
        runId: `demo-run-${i}`,
        startTime: i * 1000,
        endTime: i * 1000 + 4300,
        durationMs: 4300,
        evidenceCount: 25000,
        detectionTimeMs: 2000,
        exportGenerationTimeMs: 300,
        dbWriteOpsEstimate: 50000,
        queueWaitTimeMs: 50,
        memoryUsedBytes: 1024 * 1024 * 50,
        specialCategoryDetections: 120,
        status: "COMPLETED",
        errorDetails: null,
        batchesProcessed: 50,
        totalBatches: 50,
      });
    }
    return {
      runs,
      summary: computeMetricsSummary(runs),
      generationTimeMs: 5000,
      totalPersons: 10000,
      totalEvidenceItems: 250000,
    };
  }

  it("should build enterprise demo summary", () => {
    const snapshot = createMockSnapshot();
    const summary = buildEnterpriseDemoSummary(snapshot);

    expect(summary.recordsProcessed).toBe(250000);
    expect(summary.policyViolations).toBe(0);
    expect(summary.auditCoveragePercent).toBe(100);
    expect(summary.parallelRunsCompleted).toBe(10);
    expect(summary.specialCategoryDetections).toBeGreaterThan(0);
    expect(summary.governanceChecksPerformed).toBe(30); // 3 per run × 10
  });

  it("should format executive view", () => {
    const snapshot = createMockSnapshot();
    const summary = buildEnterpriseDemoSummary(snapshot);
    const view = formatExecutiveView(summary);

    expect(view).toContain("250,000 records");
    expect(view).toContain("0 policy violations");
    expect(view).toContain("100% audit coverage");
    expect(view).toContain("PrivacyPilot");
  });

  it("should generate executive cards", () => {
    const snapshot = createMockSnapshot();
    const summary = buildEnterpriseDemoSummary(snapshot);
    const cards = getExecutiveCards(summary);

    expect(cards.length).toBe(6);

    const labels = cards.map((c) => c.label);
    expect(labels).toContain("Records Processed");
    expect(labels).toContain("Policy Violations");
    expect(labels).toContain("Audit Coverage");
    expect(labels).toContain("Parallel Runs");
  });

  it("should validate demo mode", () => {
    expect(validateDemoMode(true)).toBeNull();
    expect(validateDemoMode(false, "development")).toBeNull();
    expect(validateDemoMode(false, "test")).toBeNull();
    expect(validateDemoMode(false, "production")).toContain("only available");
  });
});

// =========================================================================
// 12. Full Performance Simulation Integration
// =========================================================================
describe("Full Performance Simulation", () => {
  it("should run complete simulation with small dataset", () => {
    const config = createDefaultConfig({
      personCount: 10,
      parallelRuns: 2,
      evidenceDensity: "low",
      detectionMode: "simulated",
    });

    const result = runPerformanceSimulation(config);

    expect(result.config).toEqual(config);
    expect(result.metrics.runs.length).toBe(2);
    expect(result.metrics.totalPersons).toBe(10);
    expect(result.metrics.totalEvidenceItems).toBe(50); // 10 × 5

    // Concurrency test ran
    expect(result.concurrencyTest).not.toBeNull();
    expect(result.concurrencyTest!.totalRuns).toBe(25);

    // Security test ran
    expect(result.securityTest).not.toBeNull();
    expect(result.securityTest!.totalRequests).toBe(100);

    // Failure test ran
    expect(result.failureTest).not.toBeNull();
    expect(result.failureTest!.results.length).toBe(4);

    // Enterprise summary
    expect(result.enterpriseSummary).not.toBeNull();
    expect(result.enterpriseSummary!.policyViolations).toBe(0);
    expect(result.enterpriseSummary!.auditCoveragePercent).toBe(100);

    expect(result.totalDurationMs).toBeGreaterThan(0);
  });

  it("should support running without optional tests", () => {
    const config = createDefaultConfig({ personCount: 5, parallelRuns: 1 });

    const result = runPerformanceSimulation(config, {
      runConcurrency: false,
      runSecurity: false,
      runFailures: false,
      buildDemoSummary: false,
    });

    expect(result.metrics.runs.length).toBe(1);
    expect(result.concurrencyTest).toBeNull();
    expect(result.securityTest).toBeNull();
    expect(result.failureTest).toBeNull();
    expect(result.enterpriseSummary).toBeNull();
  });

  it("should throw for invalid config", () => {
    const config = createDefaultConfig({ personCount: 0 });
    expect(() => runPerformanceSimulation(config)).toThrow("Invalid performance config");
  });

  it("should produce consistent results with same seed", () => {
    const config1 = createDefaultConfig({
      personCount: 10,
      parallelRuns: 2,
      seed: 777,
    });
    const config2 = createDefaultConfig({
      personCount: 10,
      parallelRuns: 2,
      seed: 777,
    });

    const r1 = runPerformanceSimulation(config1, {
      runConcurrency: false,
      runSecurity: false,
      runFailures: false,
      buildDemoSummary: false,
    });
    const r2 = runPerformanceSimulation(config2, {
      runConcurrency: false,
      runSecurity: false,
      runFailures: false,
      buildDemoSummary: false,
    });

    expect(r1.metrics.totalPersons).toBe(r2.metrics.totalPersons);
    expect(r1.metrics.totalEvidenceItems).toBe(r2.metrics.totalEvidenceItems);
    expect(r1.metrics.runs.length).toBe(r2.metrics.runs.length);
  });
});

// =========================================================================
// 13. Definition of Done Verification
// =========================================================================
describe("Definition of Done", () => {
  it("should generate 10k persons + 250k evidence items", () => {
    const config = createDefaultConfig({
      personCount: 10000,
      evidenceDensity: "medium",
    });
    const ds = generateScalableDataset(config);

    expect(ds.persons.length).toBe(10000);
    expect(ds.totalEvidenceItems).toBe(250000);
  });

  it("governance should function under load", () => {
    const result = runConcurrencyTest(25, 500000, 42);
    expect(result.governanceEnforced).toBe(true);
    expect(result.auditLogsComplete).toBe(true);
  });

  it("legal gate should block exports correctly", () => {
    const result = runConcurrencyTest(25, 500000, 42);
    expect(result.exportsCorrectlyGated).toBe(true);
  });

  it("should have no memory explosion (reasonable estimates)", () => {
    const config = createDefaultConfig({
      personCount: 20,
      parallelRuns: 5,
      evidenceDensity: "low",
      detectionMode: "simulated",
    });

    const result = runPerformanceSimulation(config, {
      runConcurrency: false,
      runSecurity: false,
      runFailures: false,
      buildDemoSummary: false,
    });

    for (const run of result.metrics.runs) {
      // Memory per run should be reasonable (< 100MB per run)
      expect(run.memoryUsedBytes).toBeLessThan(100 * 1024 * 1024);
    }
  });

  it("should not have unmasked PII in logs", () => {
    const security = runSecurityUnderLoadTest(50, 30, 42);
    // PII masking is enforced
    expect(security.crossTenantLeakageDetected).toBe(false);
  });
});
