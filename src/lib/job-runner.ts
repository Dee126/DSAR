/**
 * JobRunner — Hardened background job execution framework
 *
 * Features:
 * - Concurrency guard: prevents parallel runs of same job+tenant
 * - Idempotency keys: prevents duplicate processing
 * - Exponential backoff retry with configurable policy
 * - JobRun table tracking with duration + summary
 * - Graceful error handling
 *
 * Multi-tenant safe: locks are scoped by tenantId + jobName.
 */

import { prisma } from "./prisma";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface JobOptions {
  /** Unique job name (e.g. "webhook_delivery", "retention_deletion") */
  jobName: string;
  /** Tenant scope */
  tenantId: string;
  /** Optional idempotency key to prevent duplicate processing */
  idempotencyKey?: string;
  /** Retry policy */
  retry?: RetryPolicy;
  /** Correlation ID (e.g. parent entity id) */
  correlationId?: string;
}

export interface RetryPolicy {
  maxRetries: number;
  /** Initial delay in ms */
  initialDelayMs: number;
  /** Backoff multiplier (default 2) */
  backoffMultiplier?: number;
  /** Max delay in ms (cap) */
  maxDelayMs?: number;
}

export interface JobResult<T = unknown> {
  jobRunId: string;
  status: "SUCCESS" | "FAILED";
  data?: T;
  error?: string;
  durationMs: number;
  attempt: number;
}

// ─── In-memory concurrency locks ────────────────────────────────────────────

const activeLocks = new Set<string>();

function lockKey(jobName: string, tenantId: string): string {
  return `${jobName}:${tenantId}`;
}

function acquireLock(jobName: string, tenantId: string): boolean {
  const key = lockKey(jobName, tenantId);
  if (activeLocks.has(key)) return false;
  activeLocks.add(key);
  return true;
}

function releaseLock(jobName: string, tenantId: string): void {
  activeLocks.delete(lockKey(jobName, tenantId));
}

// ─── Idempotency check ─────────────────────────────────────────────────────

async function hasRecentRun(
  tenantId: string,
  jobName: string,
  idempotencyKey: string,
  windowMs: number = 60_000,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const existing = await prisma.jobRun.findFirst({
    where: {
      tenantId,
      jobName,
      correlationId: idempotencyKey,
      status: "SUCCESS",
      startedAt: { gte: since },
    },
  });
  return !!existing;
}

// ─── Retry with exponential backoff ─────────────────────────────────────────

function computeDelay(attempt: number, policy: RetryPolicy): number {
  const multiplier = policy.backoffMultiplier ?? 2;
  const delay = policy.initialDelayMs * Math.pow(multiplier, attempt);
  return Math.min(delay, policy.maxDelayMs ?? 60_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main Job Runner ────────────────────────────────────────────────────────

/**
 * Execute a job with concurrency guard, idempotency, retry, and tracking.
 *
 * @param options Job configuration
 * @param fn The actual job function to execute
 * @returns JobResult with status, duration, and data
 */
export async function runJob<T>(
  options: JobOptions,
  fn: () => Promise<T>,
): Promise<JobResult<T>> {
  const { jobName, tenantId, idempotencyKey, retry, correlationId } = options;
  const startTime = Date.now();

  // Concurrency guard
  if (!acquireLock(jobName, tenantId)) {
    return {
      jobRunId: "",
      status: "FAILED",
      error: `Job "${jobName}" is already running for tenant ${tenantId}`,
      durationMs: 0,
      attempt: 0,
    };
  }

  try {
    // Idempotency check
    if (idempotencyKey) {
      const isDuplicate = await hasRecentRun(tenantId, jobName, idempotencyKey);
      if (isDuplicate) {
        return {
          jobRunId: "",
          status: "SUCCESS",
          error: "Skipped: duplicate idempotency key within window",
          durationMs: Date.now() - startTime,
          attempt: 0,
        };
      }
    }

    // Create job run record
    const jobRun = await prisma.jobRun.create({
      data: {
        tenantId,
        jobName,
        status: "RUNNING",
        correlationId: idempotencyKey ?? correlationId ?? null,
      },
    });

    const maxAttempts = (retry?.maxRetries ?? 0) + 1;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        if (attempt > 0 && retry) {
          const delay = computeDelay(attempt - 1, retry);
          await sleep(delay);
        }

        const data = await fn();
        const durationMs = Date.now() - startTime;

        // Record success
        await prisma.jobRun.update({
          where: { id: jobRun.id },
          data: {
            status: "SUCCESS",
            finishedAt: new Date(),
          },
        });

        return {
          jobRunId: jobRun.id,
          status: "SUCCESS",
          data,
          durationMs,
          attempt: attempt + 1,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Continue to retry if allowed
      }
    }

    // All retries exhausted
    const durationMs = Date.now() - startTime;
    const errorMsg = lastError?.message ?? "Unknown error";

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: errorMsg.slice(0, 2000),
      },
    });

    return {
      jobRunId: jobRun.id,
      status: "FAILED",
      error: errorMsg,
      durationMs,
      attempt: maxAttempts,
    };
  } finally {
    releaseLock(jobName, tenantId);
  }
}

// ─── Default Retry Policies ────────────────────────────────────────────────

export const RetryPolicies = {
  /** For webhook deliveries: 3 retries, starting at 5s */
  WEBHOOK: {
    maxRetries: 3,
    initialDelayMs: 5_000,
    backoffMultiplier: 2,
    maxDelayMs: 60_000,
  } satisfies RetryPolicy,

  /** For retention jobs: 2 retries, starting at 10s */
  RETENTION: {
    maxRetries: 2,
    initialDelayMs: 10_000,
    backoffMultiplier: 2,
    maxDelayMs: 120_000,
  } satisfies RetryPolicy,

  /** For connector runs: 3 retries, starting at 3s */
  CONNECTOR: {
    maxRetries: 3,
    initialDelayMs: 3_000,
    backoffMultiplier: 2,
    maxDelayMs: 30_000,
  } satisfies RetryPolicy,

  /** For KPI snapshots: 1 retry after 5s */
  KPI_SNAPSHOT: {
    maxRetries: 1,
    initialDelayMs: 5_000,
    backoffMultiplier: 1,
    maxDelayMs: 5_000,
  } satisfies RetryPolicy,
};

// ─── Helpers for testing ────────────────────────────────────────────────────

/** Reset active locks (for testing only) */
export function _resetLocks(): void {
  activeLocks.clear();
}

/** Check if a lock is held (for testing) */
export function _isLocked(jobName: string, tenantId: string): boolean {
  return activeLocks.has(lockKey(jobName, tenantId));
}
