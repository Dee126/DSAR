// ─── Module 8.4: Retention & Deletion Policy Engine ─────────────────────────
//
// Manages retention policies per artifact type, evaluates deletions,
// respects legal holds, and produces deletion proof events.

import { createHash } from "crypto";
import { prisma } from "./prisma";
import { getStorage } from "./storage";
import { appendAuditEvent, canonicalJson, sha256 } from "./assurance-audit-service";
import { eventBus, EventTypes } from "./event-bus";
import type { RetentionArtifactType, RetentionDeleteMode } from "@prisma/client";

// ─── Policy Management ─────────────────────────────────────────────────────

export async function listRetentionPolicies(tenantId: string) {
  return prisma.retentionPolicy.findMany({
    where: { tenantId },
    orderBy: { artifactType: "asc" },
  });
}

export async function upsertRetentionPolicy(
  tenantId: string,
  artifactType: RetentionArtifactType,
  data: {
    retentionDays: number;
    deleteMode: RetentionDeleteMode;
    legalHoldRespects?: boolean;
    enabled?: boolean;
  }
) {
  return prisma.retentionPolicy.upsert({
    where: { tenantId_artifactType: { tenantId, artifactType } },
    create: {
      tenantId,
      artifactType,
      retentionDays: data.retentionDays,
      deleteMode: data.deleteMode,
      legalHoldRespects: data.legalHoldRespects ?? true,
      enabled: data.enabled ?? true,
    },
    update: {
      retentionDays: data.retentionDays,
      deleteMode: data.deleteMode,
      ...(data.legalHoldRespects !== undefined && { legalHoldRespects: data.legalHoldRespects }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
    },
  });
}

// ─── Legal Hold Check ─────────────────────────────────────────────────────

async function hasActiveLegalHold(tenantId: string, caseId: string): Promise<boolean> {
  const hold = await prisma.legalHold.findFirst({
    where: {
      tenantId,
      caseId,
      disabledAt: null,
    },
  });
  return !!hold;
}

// ─── Artifact Discovery for Deletion ────────────────────────────────────

interface DeletionCandidate {
  artifactType: string;
  artifactId: string;
  caseId: string | null;
  storageKey: string | null;
  createdAt: Date;
}

async function findEligibleArtifacts(
  tenantId: string,
  artifactType: RetentionArtifactType,
  cutoffDate: Date
): Promise<DeletionCandidate[]> {
  const candidates: DeletionCandidate[] = [];

  switch (artifactType) {
    case "IDV_ARTIFACT": {
      const artifacts = await prisma.idvArtifact.findMany({
        where: {
          tenantId,
          createdAt: { lt: cutoffDate },
        },
        select: { id: true, storageKey: true, createdAt: true, requestId: true },
        // Look up caseId via request
      });
      for (const a of artifacts) {
        // Fetch the request to get caseId
        const req = await prisma.idvRequest.findUnique({
          where: { id: a.requestId },
          select: { caseId: true },
        });
        candidates.push({
          artifactType: "IDV_ARTIFACT",
          artifactId: a.id,
          caseId: req?.caseId ?? null,
          storageKey: a.storageKey,
          createdAt: a.createdAt,
        });
      }
      break;
    }
    case "INTAKE_ATTACHMENT": {
      const attachments = await prisma.intakeAttachment.findMany({
        where: {
          tenantId,
          createdAt: { lt: cutoffDate },
        },
        select: { id: true, storageKey: true, createdAt: true, submissionId: true },
      });
      for (const a of attachments) {
        const sub = await prisma.intakeSubmission.findUnique({
          where: { id: a.submissionId },
          select: { caseId: true },
        });
        candidates.push({
          artifactType: "INTAKE_ATTACHMENT",
          artifactId: a.id,
          caseId: sub?.caseId ?? null,
          storageKey: a.storageKey,
          createdAt: a.createdAt,
        });
      }
      break;
    }
    case "RESPONSE_DOC": {
      const docs = await prisma.responseDocument.findMany({
        where: {
          tenantId,
          createdAt: { lt: cutoffDate },
        },
        select: { id: true, storageKeyPdf: true, caseId: true, createdAt: true },
      });
      for (const d of docs) {
        candidates.push({
          artifactType: "RESPONSE_DOC",
          artifactId: d.id,
          caseId: d.caseId,
          storageKey: d.storageKeyPdf ?? null,
          createdAt: d.createdAt,
        });
      }
      break;
    }
    case "DELIVERY_LOG": {
      const events = await prisma.deliveryEvent.findMany({
        where: {
          tenantId,
          createdAt: { lt: cutoffDate },
        },
        select: { id: true, caseId: true, createdAt: true },
      });
      for (const e of events) {
        candidates.push({
          artifactType: "DELIVERY_LOG",
          artifactId: e.id,
          caseId: e.caseId,
          storageKey: null,
          createdAt: e.createdAt,
        });
      }
      break;
    }
    case "VENDOR_ARTIFACT": {
      const artifacts = await prisma.vendorResponseArtifact.findMany({
        where: {
          tenantId,
          createdAt: { lt: cutoffDate },
        },
        select: {
          id: true,
          storageKey: true,
          createdAt: true,
          responseId: true,
        },
      });
      for (const a of artifacts) {
        // Look up caseId through response -> request chain
        const resp = await prisma.vendorResponse.findUnique({
          where: { id: a.responseId },
          select: { request: { select: { caseId: true } } },
        });
        candidates.push({
          artifactType: "VENDOR_ARTIFACT",
          artifactId: a.id,
          caseId: resp?.request?.caseId ?? null,
          storageKey: a.storageKey,
          createdAt: a.createdAt,
        });
      }
      break;
    }
    case "EXPORT_ARTIFACT": {
      const exports = await prisma.exportArtifact.findMany({
        where: {
          tenantId,
          createdAt: { lt: cutoffDate },
        },
        select: { id: true, createdAt: true, documentId: true },
      });
      for (const e of exports) {
        candidates.push({
          artifactType: "EXPORT_ARTIFACT",
          artifactId: e.id,
          caseId: null,
          storageKey: null, // ExportArtifact has no direct storageKey
          createdAt: e.createdAt,
        });
      }
      break;
    }
    case "EVIDENCE": {
      const items = await prisma.evidenceItem.findMany({
        where: {
          tenantId,
          createdAt: { lt: cutoffDate },
        },
        select: { id: true, createdAt: true, caseId: true },
      });
      for (const i of items) {
        candidates.push({
          artifactType: "EVIDENCE",
          artifactId: i.id,
          caseId: i.caseId,
          storageKey: null, // EvidenceItem has no storageKey
          createdAt: i.createdAt,
        });
      }
      break;
    }
  }

  return candidates;
}

// ─── Deletion Job Runner ────────────────────────────────────────────────

export interface DeletionJobResult {
  jobId: string;
  status: "SUCCESS" | "FAILED";
  totalEvaluated: number;
  totalDeleted: number;
  totalBlocked: number;
  errors: string[];
}

export async function runRetentionDeletionJob(
  tenantId: string,
  triggeredBy: "USER" | "SYSTEM",
  triggeredUserId?: string,
  now?: Date
): Promise<DeletionJobResult> {
  const currentTime = now || new Date();

  // Create job record
  const job = await prisma.deletionJob.create({
    data: {
      tenantId,
      status: "RUNNING",
      triggeredBy,
      triggeredUserId: triggeredUserId ?? null,
    },
  });

  // Create job run for observability
  const jobRun = await prisma.jobRun.create({
    data: {
      tenantId,
      jobName: "retention_deletion",
      status: "RUNNING",
      correlationId: job.id,
    },
  });

  await eventBus.emit(EventTypes.RETENTION_JOB_STARTED, tenantId, { jobId: job.id });

  const policies = await prisma.retentionPolicy.findMany({
    where: { tenantId, enabled: true },
  });

  let totalEvaluated = 0;
  let totalDeleted = 0;
  let totalBlocked = 0;
  const errors: string[] = [];

  for (const policy of policies) {
    const cutoffDate = new Date(currentTime.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000);

    try {
      const candidates = await findEligibleArtifacts(tenantId, policy.artifactType, cutoffDate);
      totalEvaluated += candidates.length;

      for (const candidate of candidates) {
        try {
          // Check legal hold
          if (policy.legalHoldRespects && candidate.caseId) {
            const holdActive = await hasActiveLegalHold(tenantId, candidate.caseId);
            if (holdActive) {
              totalBlocked++;

              // Record blocked deletion event
              const eventPayload = {
                tenantId,
                artifactType: candidate.artifactType,
                artifactId: candidate.artifactId,
                caseId: candidate.caseId,
                storageKey: candidate.storageKey,
                deletedAt: currentTime.toISOString(),
                deletionMethod: "SOFT",
                legalHoldBlocked: true,
                reason: "Legal hold active on case",
              };
              const proofHash = sha256(canonicalJson(eventPayload));

              await prisma.deletionEvent.create({
                data: {
                  tenantId,
                  artifactType: candidate.artifactType,
                  artifactId: candidate.artifactId,
                  caseId: candidate.caseId,
                  storageKey: candidate.storageKey,
                  deletionMethod: "SOFT",
                  legalHoldBlocked: true,
                  reason: "Legal hold active on case",
                  proofHash,
                  jobId: job.id,
                },
              });

              await eventBus.emit(EventTypes.DELETION_BLOCKED_LEGAL_HOLD, tenantId, {
                artifactId: candidate.artifactId,
                caseId: candidate.caseId,
              });
              continue;
            }
          }

          // Perform deletion
          const checksumBefore = candidate.storageKey
            ? await computeChecksum(candidate.storageKey)
            : null;

          if (policy.deleteMode === "HARD_DELETE") {
            await performHardDelete(candidate);
          } else {
            await performSoftDelete(candidate);
          }

          // Create deletion proof event
          const eventPayload = {
            tenantId,
            artifactType: candidate.artifactType,
            artifactId: candidate.artifactId,
            caseId: candidate.caseId,
            storageKey: candidate.storageKey,
            deletedAt: currentTime.toISOString(),
            deletionMethod: policy.deleteMode === "HARD_DELETE" ? "HARD" : "SOFT",
            checksumBefore,
            legalHoldBlocked: false,
            reason: `Retention policy: ${policy.retentionDays} days exceeded`,
          };
          const proofHash = sha256(canonicalJson(eventPayload));

          await prisma.deletionEvent.create({
            data: {
              tenantId,
              artifactType: candidate.artifactType,
              artifactId: candidate.artifactId,
              caseId: candidate.caseId,
              storageKey: candidate.storageKey,
              deletionMethod: policy.deleteMode === "HARD_DELETE" ? "HARD" : "SOFT",
              checksumBefore,
              proofHash,
              jobId: job.id,
              legalHoldBlocked: false,
              reason: `Retention policy: ${policy.retentionDays} days exceeded`,
            },
          });

          await eventBus.emit(EventTypes.DELETION_EVENT_CREATED, tenantId, {
            artifactId: candidate.artifactId,
            artifactType: candidate.artifactType,
            deletionMethod: policy.deleteMode,
          });

          totalDeleted++;
        } catch (err) {
          const errorMsg = `Failed to delete ${candidate.artifactType}:${candidate.artifactId}: ${err}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }
    } catch (err) {
      const errorMsg = `Failed to evaluate ${policy.artifactType}: ${err}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  // Finalize job
  const status = errors.length === 0 ? "SUCCESS" : "FAILED";
  const summaryJson = {
    totalEvaluated,
    totalDeleted,
    totalBlocked,
    errors: errors.slice(0, 50), // cap error list
  };

  await prisma.deletionJob.update({
    where: { id: job.id },
    data: {
      status: status === "SUCCESS" ? "SUCCESS" : "FAILED",
      finishedAt: new Date(),
      summaryJson: summaryJson as object,
    },
  });

  await prisma.jobRun.update({
    where: { id: jobRun.id },
    data: {
      status: status === "SUCCESS" ? "SUCCESS" : "FAILED",
      finishedAt: new Date(),
      errorMessage: errors.length > 0 ? errors.join("; ").slice(0, 2000) : null,
    },
  });

  // Audit log
  await appendAuditEvent({
    tenantId,
    entityType: "DeletionJob",
    entityId: job.id,
    action: status === "SUCCESS" ? "DELETION_JOB_COMPLETE" : "DELETION_JOB_FAILED",
    actorUserId: triggeredUserId,
    actorType: triggeredBy === "USER" ? "USER" : "SYSTEM",
    metadataJson: summaryJson as Record<string, unknown>,
  });

  const eventType = status === "SUCCESS"
    ? EventTypes.RETENTION_JOB_COMPLETED
    : EventTypes.RETENTION_JOB_FAILED;
  await eventBus.emit(eventType, tenantId, { jobId: job.id, ...summaryJson });

  return {
    jobId: job.id,
    status: status as "SUCCESS" | "FAILED",
    totalEvaluated,
    totalDeleted,
    totalBlocked,
    errors,
  };
}

// ─── Deletion Helpers ─────────────────────────────────────────────────────

async function computeChecksum(storageKey: string): Promise<string | null> {
  try {
    const storage = getStorage();
    const buffer = await storage.download(storageKey);
    return createHash("sha256").update(buffer).digest("hex");
  } catch {
    return null;
  }
}

async function performHardDelete(candidate: DeletionCandidate): Promise<void> {
  // Delete file from storage
  if (candidate.storageKey) {
    try {
      const storage = getStorage();
      await storage.delete(candidate.storageKey);
    } catch (err) {
      console.error(`Failed to delete file ${candidate.storageKey}:`, err);
    }
  }

  // Mark DB record as deleted (type-specific)
  switch (candidate.artifactType) {
    case "IDV_ARTIFACT":
      await prisma.idvArtifact.delete({ where: { id: candidate.artifactId } }).catch(() => {});
      break;
    case "INTAKE_ATTACHMENT":
      await prisma.intakeAttachment.delete({ where: { id: candidate.artifactId } }).catch(() => {});
      break;
    case "RESPONSE_DOC":
      await prisma.responseDocument.delete({ where: { id: candidate.artifactId } }).catch(() => {});
      break;
    case "DELIVERY_LOG":
      await prisma.deliveryEvent.delete({ where: { id: candidate.artifactId } }).catch(() => {});
      break;
    case "VENDOR_ARTIFACT":
      await prisma.vendorResponseArtifact.delete({ where: { id: candidate.artifactId } }).catch(() => {});
      break;
    case "EXPORT_ARTIFACT":
      await prisma.exportArtifact.delete({ where: { id: candidate.artifactId } }).catch(() => {});
      break;
    case "EVIDENCE":
      await prisma.evidenceItem.delete({ where: { id: candidate.artifactId } }).catch(() => {});
      break;
  }
}

async function performSoftDelete(candidate: DeletionCandidate): Promise<void> {
  const deletedAt = new Date();

  switch (candidate.artifactType) {
    case "RESPONSE_DOC":
      await prisma.responseDocument.update({
        where: { id: candidate.artifactId },
        data: { updatedAt: deletedAt },
      }).catch(() => {});
      break;
    default:
      // For most artifacts, we rely on the deletion_events table
      // to track the soft-delete state
      break;
  }
}

// ─── Deletion Proof Queries ───────────────────────────────────────────────

export async function listDeletionJobs(
  tenantId: string,
  filters: { status?: string; limit?: number; offset?: number } = {}
) {
  const where: Record<string, unknown> = { tenantId };
  if (filters.status) where.status = filters.status;

  const [items, total] = await Promise.all([
    prisma.deletionJob.findMany({
      where: where as any,
      orderBy: { startedAt: "desc" },
      take: filters.limit || 50,
      skip: filters.offset || 0,
      include: {
        triggeredUser: { select: { id: true, name: true, email: true } },
        _count: { select: { events: true } },
      },
    }),
    prisma.deletionJob.count({ where: where as any }),
  ]);

  return { items, total };
}

export async function listDeletionEvents(
  tenantId: string,
  filters: { jobId?: string; artifactType?: string; limit?: number; offset?: number } = {}
) {
  const where: Record<string, unknown> = { tenantId };
  if (filters.jobId) where.jobId = filters.jobId;
  if (filters.artifactType) where.artifactType = filters.artifactType;

  const [items, total] = await Promise.all([
    prisma.deletionEvent.findMany({
      where: where as any,
      orderBy: { deletedAt: "desc" },
      take: filters.limit || 100,
      skip: filters.offset || 0,
    }),
    prisma.deletionEvent.count({ where: where as any }),
  ]);

  return { items, total };
}

/**
 * Export deletion events as CSV data.
 */
export async function exportDeletionEventsCSV(
  tenantId: string,
  jobId?: string
): Promise<string> {
  const where: Record<string, unknown> = { tenantId };
  if (jobId) where.jobId = jobId;

  const events = await prisma.deletionEvent.findMany({
    where: where as any,
    orderBy: { deletedAt: "asc" },
  });

  const header = "id,tenant_id,artifact_type,artifact_id,case_id,storage_key,deleted_at,deletion_method,checksum_before,proof_hash,job_id,legal_hold_blocked,reason";
  const rows = events.map(e =>
    [
      e.id,
      e.tenantId,
      e.artifactType,
      e.artifactId,
      e.caseId || "",
      e.storageKey || "",
      e.deletedAt.toISOString(),
      e.deletionMethod,
      e.checksumBefore || "",
      e.proofHash,
      e.jobId,
      e.legalHoldBlocked,
      `"${(e.reason || "").replace(/"/g, '""')}"`,
    ].join(",")
  );

  return [header, ...rows].join("\n");
}

// ─── Retention Timers for Case Detail ───────────────────────────────────

export interface RetentionTimer {
  artifactType: string;
  retentionDays: number;
  deleteMode: string;
  oldestArtifactDate: Date | null;
  daysRemaining: number | null;
}

export async function getCaseRetentionTimers(
  tenantId: string,
  caseId: string
): Promise<RetentionTimer[]> {
  const policies = await prisma.retentionPolicy.findMany({
    where: { tenantId, enabled: true },
  });

  const timers: RetentionTimer[] = [];
  const now = new Date();

  for (const policy of policies) {
    let oldestDate: Date | null = null;

    switch (policy.artifactType) {
      case "IDV_ARTIFACT": {
        const artifact = await prisma.idvArtifact.findFirst({
          where: { tenantId, request: { caseId } },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        });
        oldestDate = artifact?.createdAt ?? null;
        break;
      }
      case "RESPONSE_DOC": {
        const doc = await prisma.responseDocument.findFirst({
          where: { tenantId, caseId },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        });
        oldestDate = doc?.createdAt ?? null;
        break;
      }
      case "DELIVERY_LOG": {
        const event = await prisma.deliveryEvent.findFirst({
          where: { tenantId, caseId },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        });
        oldestDate = event?.createdAt ?? null;
        break;
      }
      default:
        continue;
    }

    if (oldestDate) {
      const elapsed = Math.floor((now.getTime() - oldestDate.getTime()) / (24 * 60 * 60 * 1000));
      const daysRemaining = Math.max(0, policy.retentionDays - elapsed);

      timers.push({
        artifactType: policy.artifactType,
        retentionDays: policy.retentionDays,
        deleteMode: policy.deleteMode,
        oldestArtifactDate: oldestDate,
        daysRemaining,
      });
    }
  }

  return timers;
}

// ─── Job Run Queries ────────────────────────────────────────────────────

export async function listJobRuns(
  tenantId: string,
  filters: { jobName?: string; status?: string; limit?: number; offset?: number } = {}
) {
  const where: Record<string, unknown> = { tenantId };
  if (filters.jobName) where.jobName = filters.jobName;
  if (filters.status) where.status = filters.status;

  const [items, total] = await Promise.all([
    prisma.jobRun.findMany({
      where: where as any,
      orderBy: { startedAt: "desc" },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    }),
    prisma.jobRun.count({ where: where as any }),
  ]);

  return { items, total };
}
