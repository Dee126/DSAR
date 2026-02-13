/**
 * Standardized Result Metadata for DataCollectionItems.
 *
 * Every completed data-collection stores results in this structure so that
 * exporters can later build a consistent "Index of Disclosed Data".
 */

import { z } from "zod";

/* ── Artifact reference (document produced by collection) ─────────────── */

export const artifactSchema = z.object({
  type: z.enum(["index_csv", "export_zip", "document", "log", "metadata_json"]),
  documentId: z.string().optional(),
  filename: z.string(),
  mimeType: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
});

export type Artifact = z.infer<typeof artifactSchema>;

/* ── Run info ─────────────────────────────────────────────────────────── */

export const runInfoSchema = z.object({
  startedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["success", "partial", "failed"]),
  durationMs: z.number().int().nonnegative().optional(),
  errorMessage: z.string().optional(),
});

export type RunInfo = z.infer<typeof runInfoSchema>;

/* ── Full Result Metadata ─────────────────────────────────────────────── */

export const resultMetadataSchema = z.object({
  provider: z.string(),
  workload: z.string(),
  counts: z.object({
    matched: z.number().int().nonnegative().default(0),
    exported: z.number().int().nonnegative().default(0),
    attachments: z.number().int().nonnegative().default(0),
    skipped: z.number().int().nonnegative().default(0),
  }),
  artifacts: z.array(artifactSchema).default([]),
  runInfo: runInfoSchema,
  notes: z.string().optional(),
});

export type ResultMetadata = z.infer<typeof resultMetadataSchema>;

/* ── Factory helpers ──────────────────────────────────────────────────── */

export function createPendingResult(provider: string, workload: string): ResultMetadata {
  const now = new Date().toISOString();
  return {
    provider,
    workload,
    counts: { matched: 0, exported: 0, attachments: 0, skipped: 0 },
    artifacts: [],
    runInfo: {
      startedAt: now,
      status: "success",
    },
  };
}

export function completeResult(
  result: ResultMetadata,
  overrides: Partial<Pick<ResultMetadata, "counts" | "artifacts" | "notes">> & {
    status?: "success" | "partial" | "failed";
    errorMessage?: string;
  }
): ResultMetadata {
  const now = new Date().toISOString();
  const startedAt = new Date(result.runInfo.startedAt);
  const completedAt = new Date(now);
  const durationMs = completedAt.getTime() - startedAt.getTime();

  return {
    ...result,
    counts: { ...result.counts, ...(overrides.counts ?? {}) },
    artifacts: overrides.artifacts ?? result.artifacts,
    notes: overrides.notes ?? result.notes,
    runInfo: {
      ...result.runInfo,
      completedAt: now,
      status: overrides.status ?? "success",
      durationMs,
      errorMessage: overrides.errorMessage,
    },
  };
}
