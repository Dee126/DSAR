/**
 * Parallel Run Simulation — Performance Test Mode
 *
 * Simulates X concurrent CopilotRuns, each processing a random subset
 * of persons with configurable connector latency and rate limits.
 *
 * Tracks: duration, evidence count, detection time, export time,
 * DB throughput, memory usage, queue length.
 */

import { createSeededRandom } from "../synthetic/random";
import type { SeededRandom } from "../synthetic/random";
import type { SyntheticPerson } from "../synthetic/persons";
import type { SyntheticEvidenceItem } from "../synthetic/evidence";
import {
  enforceRateLimits,
  enforceJustification,
  enforceRunPermission,
  enforceExportPermission,
  checkForAnomalies,
  DEFAULT_GOVERNANCE_SETTINGS,
} from "../governance";
import type { GovernanceSettings, RateLimitState } from "../governance";
import { checkLegalHoldForExport } from "../legal-hold";
import type {
  PerformanceConfig,
  RunMetrics,
  FailureSimulationConfig,
  PerformanceLimits,
} from "./types";
import { generateEvidenceForPerson } from "./scalable-generator";
import { runDetectionLoad } from "./detection-load";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParallelRunConfig {
  runIndex: number;
  persons: SyntheticPerson[];
  personsPerRun: number;
  seed: number;
  detectionMode: "real" | "simulated";
  evidenceDensity: "low" | "medium" | "high";
  connectorLatencyMs: [number, number]; // [min, max]
  failureSimulation: FailureSimulationConfig;
  limits: PerformanceLimits;
  governanceSettings: GovernanceSettings;
}

export interface ParallelSimulationResult {
  runs: RunMetrics[];
  totalDurationMs: number;
  queueLog: QueueEntry[];
  governanceLog: GovernanceLogEntry[];
  auditLog: AuditLogEntry[];
}

export interface QueueEntry {
  runId: string;
  enqueuedAt: number;
  startedAt: number;
  waitTimeMs: number;
}

export interface GovernanceLogEntry {
  runId: string;
  checkType: string;
  allowed: boolean;
  reason?: string;
  timestamp: number;
}

export interface AuditLogEntry {
  runId: string;
  action: string;
  userId: string;
  tenantId: string;
  timestamp: number;
  details?: string;
}

// ---------------------------------------------------------------------------
// Connector latency simulation
// ---------------------------------------------------------------------------

function simulateLatency(
  rng: SeededRandom,
  minMs: number,
  maxMs: number,
): number {
  return rng.int(minMs, maxMs);
}

// ---------------------------------------------------------------------------
// Single run simulation
// ---------------------------------------------------------------------------

/**
 * Simulate a single CopilotRun with full governance checks, detection,
 * latency simulation, and failure injection.
 */
export function simulateSingleRun(
  config: ParallelRunConfig,
): {
  metrics: RunMetrics;
  governanceLogs: GovernanceLogEntry[];
  auditLogs: AuditLogEntry[];
} {
  const runId = `perf-run-${config.runIndex}`;
  const rng = createSeededRandom(config.seed + config.runIndex);
  const startTime = performance.now();
  const governanceLogs: GovernanceLogEntry[] = [];
  const auditLogs: AuditLogEntry[] = [];

  const userId = `perf-user-${config.runIndex % 5}`;
  const tenantId = "perf-tenant-001";

  // Governance pre-flight
  const roleCheck = enforceRunPermission("CASE_MANAGER");
  governanceLogs.push({
    runId,
    checkType: "ROLE_CHECK",
    allowed: roleCheck.allowed,
    reason: roleCheck.reason,
    timestamp: performance.now(),
  });

  const justCheck = enforceJustification(
    `Art. 15 performance test run #${config.runIndex}`,
    config.governanceSettings,
  );
  governanceLogs.push({
    runId,
    checkType: "JUSTIFICATION",
    allowed: justCheck.allowed,
    reason: justCheck.reason,
    timestamp: performance.now(),
  });

  // Rate limit check
  const rateLimitState: RateLimitState = {
    tenantRunsToday: config.runIndex,
    userRunsToday: Math.floor(config.runIndex / 5),
    concurrentRuns: Math.min(config.runIndex, 10),
  };
  const rateCheck = enforceRateLimits(rateLimitState, config.governanceSettings);
  governanceLogs.push({
    runId,
    checkType: "RATE_LIMIT",
    allowed: rateCheck.allowed,
    reason: rateCheck.reason,
    timestamp: performance.now(),
  });

  // Check for failures
  if (config.failureSimulation.simulateM365Failure && rng.chance(0.3)) {
    const endTime = performance.now();
    auditLogs.push({
      runId, action: "RUN_FAILED", userId, tenantId,
      timestamp: endTime,
      details: "M365 API connection failure (simulated)",
    });
    return {
      metrics: {
        runId, startTime, endTime,
        durationMs: endTime - startTime,
        evidenceCount: 0, detectionTimeMs: 0,
        exportGenerationTimeMs: 0, dbWriteOpsEstimate: 0,
        queueWaitTimeMs: 0, memoryUsedBytes: 0,
        specialCategoryDetections: 0,
        status: "FAILED",
        errorDetails: "M365 API connection failure (simulated)",
        batchesProcessed: 0, totalBatches: 0,
      },
      governanceLogs,
      auditLogs,
    };
  }

  if (config.failureSimulation.simulateTimeout && rng.chance(0.2)) {
    const endTime = performance.now();
    auditLogs.push({
      runId, action: "RUN_FAILED", userId, tenantId,
      timestamp: endTime,
      details: "Request timeout after 30s (simulated)",
    });
    return {
      metrics: {
        runId, startTime, endTime,
        durationMs: endTime - startTime,
        evidenceCount: 0, detectionTimeMs: 0,
        exportGenerationTimeMs: 0, dbWriteOpsEstimate: 0,
        queueWaitTimeMs: 0, memoryUsedBytes: 0,
        specialCategoryDetections: 0,
        status: "FAILED",
        errorDetails: "Request timeout after 30s (simulated)",
        batchesProcessed: 0, totalBatches: 0,
      },
      governanceLogs,
      auditLogs,
    };
  }

  // Select persons for this run
  const personsPerRun = Math.min(config.personsPerRun, config.persons.length);
  const selectedPersons = rng.sample(config.persons, personsPerRun);

  // Generate evidence
  const allEvidence: SyntheticEvidenceItem[] = [];
  let personsProcessed = 0;
  for (const person of selectedPersons) {
    const items = generateEvidenceForPerson(person, config.evidenceDensity, rng);
    allEvidence.push(...items);
    personsProcessed++;

    // Apply hard limit
    if (allEvidence.length >= config.limits.maxEvidenceItemsPerRun) {
      break;
    }
  }

  // Trim to limit
  const evidence = allEvidence.slice(0, config.limits.maxEvidenceItemsPerRun);
  const isPartial = personsProcessed < selectedPersons.length || allEvidence.length > config.limits.maxEvidenceItemsPerRun;

  // Connector latency simulation
  const latencyMs = simulateLatency(rng, config.connectorLatencyMs[0], config.connectorLatencyMs[1]);
  const queueWaitTimeMs = simulateLatency(rng, 10, 200);

  // DB slow write simulation
  const dbSlowMs = config.failureSimulation.simulateDbSlowWrite
    ? simulateLatency(rng, 500, 2000)
    : simulateLatency(rng, 5, 50);

  // Detection
  const detectionResult = runDetectionLoad(
    evidence,
    config.detectionMode,
    rng,
    config.limits.batchSize,
  );

  // Export generation
  const exportStart = performance.now();
  let exportTimeMs = simulateLatency(rng, 50, 500);
  let exportError: string | null = null;

  if (config.failureSimulation.simulateExportCrash && rng.chance(0.25)) {
    exportError = "Export generation crashed (simulated)";
    exportTimeMs = 0;
  }
  const exportEnd = performance.now();

  // Memory estimation (rough: ~200 bytes per evidence item)
  const memoryEstimate = evidence.length * 200;

  const endTime = performance.now();
  const totalDuration = endTime - startTime + latencyMs + dbSlowMs;

  const status = exportError
    ? "FAILED" as const
    : isPartial
    ? "PARTIAL_COMPLETED" as const
    : "COMPLETED" as const;

  auditLogs.push({
    runId, action: `RUN_${status}`, userId, tenantId,
    timestamp: endTime,
    details: `Evidence: ${evidence.length}, Detections: ${detectionResult.totalDetections}, Special: ${detectionResult.specialCategoryItems}`,
  });

  return {
    metrics: {
      runId,
      startTime,
      endTime,
      durationMs: totalDuration,
      evidenceCount: evidence.length,
      detectionTimeMs: detectionResult.totalTimeMs,
      exportGenerationTimeMs: exportTimeMs,
      dbWriteOpsEstimate: evidence.length * 2 + detectionResult.totalDetections,
      queueWaitTimeMs,
      memoryUsedBytes: memoryEstimate,
      specialCategoryDetections: detectionResult.specialCategoryItems,
      status,
      errorDetails: exportError,
      batchesProcessed: detectionResult.batches.length,
      totalBatches: detectionResult.batches.length,
    },
    governanceLogs,
    auditLogs,
  };
}

// ---------------------------------------------------------------------------
// Parallel simulation orchestrator
// ---------------------------------------------------------------------------

/**
 * Simulate X parallel CopilotRuns.
 *
 * Each run:
 *   - Selects 100–1,000 random persons
 *   - Simulates connector latency (100–300ms)
 *   - Simulates API rate limits
 *   - Tracks all metrics
 */
export function runParallelSimulation(
  config: PerformanceConfig,
  persons: SyntheticPerson[],
): ParallelSimulationResult {
  const totalStart = performance.now();
  const allRuns: RunMetrics[] = [];
  const allQueueEntries: QueueEntry[] = [];
  const allGovernanceLogs: GovernanceLogEntry[] = [];
  const allAuditLogs: AuditLogEntry[] = [];

  const personsPerRun = Math.min(
    Math.max(100, Math.floor(persons.length / config.parallelRuns)),
    1000,
  );

  // Use higher limits for performance testing
  const perfGovernanceSettings: GovernanceSettings = {
    ...DEFAULT_GOVERNANCE_SETTINGS,
    maxRunsPerDayTenant: 1000,
    maxRunsPerDayUser: 200,
    maxConcurrentRuns: config.parallelRuns,
    maxEvidenceItemsPerRun: config.limits.maxEvidenceItemsPerRun,
  };

  for (let i = 0; i < config.parallelRuns; i++) {
    const enqueuedAt = performance.now();

    // Queue entry
    const queueEntry: QueueEntry = {
      runId: `perf-run-${i}`,
      enqueuedAt,
      startedAt: enqueuedAt + (i * 10), // Stagger
      waitTimeMs: i * 10,
    };
    allQueueEntries.push(queueEntry);

    const runConfig: ParallelRunConfig = {
      runIndex: i,
      persons,
      personsPerRun,
      seed: config.seed + i,
      detectionMode: config.detectionMode,
      evidenceDensity: config.evidenceDensity,
      connectorLatencyMs: [100, 300],
      failureSimulation: config.failureSimulation,
      limits: config.limits,
      governanceSettings: perfGovernanceSettings,
    };

    const result = simulateSingleRun(runConfig);
    allRuns.push(result.metrics);
    allGovernanceLogs.push(...result.governanceLogs);
    allAuditLogs.push(...result.auditLogs);
  }

  return {
    runs: allRuns,
    totalDurationMs: performance.now() - totalStart,
    queueLog: allQueueEntries,
    governanceLog: allGovernanceLogs,
    auditLog: allAuditLogs,
  };
}
