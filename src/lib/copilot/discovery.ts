/**
 * Discovery Engine Service — orchestrates a Privacy Copilot discovery run.
 *
 * Coordinates between the Identity service, connector queries, and
 * detection/classification to produce a complete set of findings for
 * a DSAR case.
 *
 * Flow:
 *   1. Load case + data subject
 *   2. Build identity graph from case data
 *   3. Find all ENABLED integrations for the tenant
 *   4. For each integration, build a QuerySpec and execute via connector
 *   5. Run detection on results (PII patterns, Art. 9)
 *   6. Create Finding records with data categories
 *   7. Create DetectorResult records
 *   8. Flag Art. 9 if detected
 *   9. Generate a deterministic text summary
 *  10. Update the CopilotRun record
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RUN_COLLECTION_LIMIT } from "@/lib/rate-limit";
import { getConnector } from "@/lib/connectors/registry";
import type { CollectionResult } from "@/lib/connectors/types";
import {
  type QuerySpec,
  validateQuerySpec,
  buildDefaultQuerySpec,
} from "@/lib/query-spec";
import {
  buildInitialIdentityGraph,
  mergeIdentifiers,
  addResolvedSystem,
  buildSubjectIdentifiers,
  type IdentityGraph,
} from "./identity";
import {
  runAllDetectors,
  hasArt9Content,
  getArt9Categories,
  classifyFindings,
  type DetectionResult,
} from "./detection";
import { logAudit } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscoveryRunContext {
  tenantId: string;
  caseId: string;
  runId: string;
  userId: string;
  reason: string;
}

export interface DiscoveryRunResult {
  status: "COMPLETED" | "FAILED";
  totalFindings: number;
  art9Flagged: boolean;
  art9Categories: string[];
  identityGraph: IdentityGraph;
  summary: string;
  errorMessage?: string;
}

// Internal type for accumulating per-query finding data before DB write.
interface FindingRecord {
  source: string;
  location: string;
  title: string;
  description: string;
  dataCategories: string[];
  severity: string;
  isArt9: boolean;
  art9Categories: string[];
  recordCount: number;
  metadata: Prisma.InputJsonValue;
  evidenceRef: string | null;
  queryId: string;
  detectorResults: DetectionResult[];
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Execute a full discovery run.
 *
 * The function is resilient to per-integration failures: a single connector
 * error marks only that CopilotQuery as FAILED and the run continues with
 * the remaining integrations. The overall run is marked COMPLETED as long as
 * at least one query succeeded (or there were no integrations). It is marked
 * FAILED only when the run itself encounters a fatal error (e.g. the case
 * cannot be loaded).
 */
export async function executeDiscoveryRun(
  ctx: DiscoveryRunContext
): Promise<DiscoveryRunResult> {
  const startedAt = new Date();

  // ------------------------------------------------------------------
  // 0. Mark run as RUNNING
  // ------------------------------------------------------------------
  await prisma.copilotRun.update({
    where: { id: ctx.runId },
    data: { status: "RUNNING", startedAt },
  });

  await logAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: "copilot_run.started",
    entityType: "CopilotRun",
    entityId: ctx.runId,
    details: { caseId: ctx.caseId, reason: ctx.reason },
  });

  try {
    // ----------------------------------------------------------------
    // 1. Load case and data subject
    // ----------------------------------------------------------------
    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: ctx.caseId, tenantId: ctx.tenantId },
      include: { dataSubject: true },
    });

    if (!dsarCase) {
      return await failRun(ctx, startedAt, "Case not found or tenant mismatch");
    }

    const dataSubject = dsarCase.dataSubject;
    if (!dataSubject) {
      return await failRun(ctx, startedAt, "Data subject not found for case");
    }

    // ----------------------------------------------------------------
    // 2. Build identity graph
    // ----------------------------------------------------------------
    const identityGraph = buildInitialIdentityGraph({
      fullName: dataSubject.fullName,
      email: dataSubject.email,
      phone: dataSubject.phone,
      address: dataSubject.address,
      identifiers: dataSubject.identifiers as Record<string, unknown> | null,
    });
    const subjectIdentifiers = buildSubjectIdentifiers(identityGraph);

    // ----------------------------------------------------------------
    // 3. Find all ENABLED integrations for the tenant
    // ----------------------------------------------------------------
    const integrations = await prisma.integration.findMany({
      where: { tenantId: ctx.tenantId, status: "ENABLED" },
    });

    if (integrations.length === 0) {
      const summary = generateFindingsSummary([], identityGraph);
      return await completeRun(ctx, startedAt, {
        totalFindings: 0,
        art9Flagged: false,
        art9Categories: [],
        identityGraph,
        summary,
      });
    }

    // ----------------------------------------------------------------
    // 4 – 7. Iterate integrations: query, detect, persist
    // ----------------------------------------------------------------
    const allFindingRecords: FindingRecord[] = [];
    let globalArt9 = false;
    const globalArt9Categories = new Set<string>();

    for (const integration of integrations) {
      // Rate-limit check per case
      const rateResult = checkRateLimit(
        `copilot_run:${ctx.caseId}`,
        RUN_COLLECTION_LIMIT
      );
      if (!rateResult.allowed) {
        // Skip this integration but do not fail the whole run
        await createSkippedQuery(
          ctx,
          integration.id,
          integration.provider,
          "Rate limit exceeded — skipped"
        );
        continue;
      }

      // Get the connector for this provider
      const connector = getConnector(integration.provider);
      if (!connector) {
        await createSkippedQuery(
          ctx,
          integration.id,
          integration.provider,
          `No connector registered for provider: ${integration.provider}`
        );
        continue;
      }

      // Build QuerySpec for this integration
      const querySpec = buildQuerySpecForIntegration(
        integration.provider,
        subjectIdentifiers
      );

      // Create CopilotQuery record (PENDING)
      const copilotQuery = await prisma.copilotQuery.create({
        data: {
          tenantId: ctx.tenantId,
          runId: ctx.runId,
          integrationId: integration.id,
          provider: integration.provider,
          querySpec: querySpec as unknown as Prisma.InputJsonValue,
          status: "PENDING",
        },
      });

      // Execute the query
      const queryStartedAt = new Date();
      await prisma.copilotQuery.update({
        where: { id: copilotQuery.id },
        data: { status: "RUNNING", startedAt: queryStartedAt },
      });

      let collectionResult: CollectionResult;
      try {
        collectionResult = await connector.collectData(
          (integration.config as Record<string, unknown>) ?? {},
          integration.secretRef,
          querySpec
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown connector error";

        await prisma.copilotQuery.update({
          where: { id: copilotQuery.id },
          data: {
            status: "FAILED",
            errorMessage,
            completedAt: new Date(),
            executionMs: Date.now() - queryStartedAt.getTime(),
          },
        });

        await logAudit({
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          action: "copilot_query.failed",
          entityType: "CopilotQuery",
          entityId: copilotQuery.id,
          details: {
            runId: ctx.runId,
            provider: integration.provider,
            error: errorMessage,
          },
        });

        continue; // Don't let one failure stop the whole run
      }

      // Mark query completed
      const queryCompletedAt = new Date();
      const executionMs = queryCompletedAt.getTime() - queryStartedAt.getTime();

      if (!collectionResult.success) {
        await prisma.copilotQuery.update({
          where: { id: copilotQuery.id },
          data: {
            status: "FAILED",
            recordsFound: collectionResult.recordsFound,
            errorMessage: collectionResult.error ?? "Collection returned success=false",
            completedAt: queryCompletedAt,
            executionMs,
          },
        });

        await logAudit({
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          action: "copilot_query.failed",
          entityType: "CopilotQuery",
          entityId: copilotQuery.id,
          details: {
            runId: ctx.runId,
            provider: integration.provider,
            error: collectionResult.error,
          },
        });

        continue;
      }

      await prisma.copilotQuery.update({
        where: { id: copilotQuery.id },
        data: {
          status: "COMPLETED",
          recordsFound: collectionResult.recordsFound,
          completedAt: queryCompletedAt,
          executionMs,
        },
      });

      // Merge identity: add the resolved system to the identity graph
      addResolvedSystem(identityGraph, {
        provider: integration.provider,
        accountId:
          (collectionResult.resultMetadata as Record<string, unknown>)?.provider?.toString() ??
          integration.provider,
        displayName: integration.name,
      });

      // ----------------------------------------------------------
      // 5. Run detection on collected data
      // ----------------------------------------------------------

      // Extract text content from resultMetadata for PII detection.
      // The resultMetadata is a structured object; we serialise it to
      // make all textual content available to regex/keyword detectors.
      const textForDetection = extractTextForDetection(collectionResult);
      const detectionResults = runAllDetectors(textForDetection);
      const classifiedCategories = classifyFindings(detectionResults);

      const art9Detected = hasArt9Content(detectionResults);
      const art9Cats = getArt9Categories(detectionResults);

      if (art9Detected) {
        globalArt9 = true;
        for (const cat of art9Cats) {
          globalArt9Categories.add(cat);
        }
      }

      // Merge any identifiers discovered during detection
      if (detectionResults.length > 0) {
        const discoveredIdentifiers = detectionResults
          .filter((d) => d.patternName === "EMAIL" && d.sampleMatch)
          .map((d) => ({
            type: "email" as const,
            value: d.sampleMatch!,
            source: integration.provider,
            confidence: d.confidence,
          }));
        if (discoveredIdentifiers.length > 0) {
          mergeIdentifiers(identityGraph, discoveredIdentifiers, integration.provider);
        }
      }

      // ----------------------------------------------------------
      // 6. Create Finding records
      // ----------------------------------------------------------
      const findingRecord: FindingRecord = {
        source: integration.provider,
        location: buildLocationString(integration.provider, integration.name),
        title: `${integration.name}: ${collectionResult.findingsSummary}`,
        description: collectionResult.findingsSummary,
        dataCategories: classifiedCategories,
        severity: determineSeverity(classifiedCategories, art9Detected),
        isArt9: art9Detected,
        art9Categories: art9Cats,
        recordCount: collectionResult.recordsFound,
        metadata: collectionResult.resultMetadata as unknown as Prisma.InputJsonValue,
        evidenceRef: null,
        queryId: copilotQuery.id,
        detectorResults: detectionResults,
      };
      allFindingRecords.push(findingRecord);

      const finding = await prisma.finding.create({
        data: {
          tenantId: ctx.tenantId,
          runId: ctx.runId,
          queryId: copilotQuery.id,
          source: findingRecord.source,
          location: findingRecord.location,
          title: findingRecord.title,
          description: findingRecord.description,
          dataCategories: classifiedCategories as any,
          severity: findingRecord.severity as any,
          isArt9: findingRecord.isArt9,
          art9Categories: findingRecord.art9Categories,
          recordCount: findingRecord.recordCount,
          metadata: findingRecord.metadata,
          evidenceRef: findingRecord.evidenceRef,
        },
      });

      // ----------------------------------------------------------
      // 7. Create DetectorResult records
      // ----------------------------------------------------------
      if (detectionResults.length > 0) {
        await prisma.detectorResult.createMany({
          data: detectionResults.map((dr) => ({
            tenantId: ctx.tenantId,
            findingId: finding.id,
            detectorType: dr.detectorType,
            patternName: dr.patternName,
            matchCount: dr.matchCount,
            sampleMatch: dr.sampleMatch ?? null,
            confidence: dr.confidence,
            metadata: Prisma.JsonNull,
          })),
        });
      }

      await logAudit({
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "copilot_query.completed",
        entityType: "CopilotQuery",
        entityId: copilotQuery.id,
        details: {
          runId: ctx.runId,
          provider: integration.provider,
          recordsFound: collectionResult.recordsFound,
          findingId: finding.id,
          detectorCount: detectionResults.length,
          art9Detected,
        },
      });
    }

    // ----------------------------------------------------------------
    // 8. Flag Art. 9 if detected
    // ----------------------------------------------------------------
    const art9CategoriesArray = Array.from(globalArt9Categories);

    // ----------------------------------------------------------------
    // 9. Generate deterministic summary
    // ----------------------------------------------------------------
    const summaryInput = allFindingRecords.map((f) => ({
      source: f.source,
      title: f.title,
      dataCategories: f.dataCategories,
      isArt9: f.isArt9,
      recordCount: f.recordCount,
    }));
    const summary = generateFindingsSummary(summaryInput, identityGraph);

    // ----------------------------------------------------------------
    // 10. Update CopilotRun with final results
    // ----------------------------------------------------------------
    return await completeRun(ctx, startedAt, {
      totalFindings: allFindingRecords.length,
      art9Flagged: globalArt9,
      art9Categories: art9CategoriesArray,
      identityGraph,
      summary,
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown fatal error";
    return await failRun(ctx, startedAt, errorMessage);
  }
}

// ---------------------------------------------------------------------------
// Summary generation (deterministic, no LLM)
// ---------------------------------------------------------------------------

/**
 * Generate a structured summary of findings.
 *
 * This is NOT an LLM summary -- it is deterministic text assembled from
 * the data. The output is suitable for display in the UI and for inclusion
 * in audit records.
 */
export function generateFindingsSummary(
  findings: Array<{
    source: string;
    title: string;
    dataCategories: string[];
    isArt9: boolean;
    recordCount: number;
  }>,
  identityGraph: IdentityGraph
): string {
  const lines: string[] = [];

  // Header
  lines.push("=== Discovery Run Summary ===");
  lines.push("");

  // Identity overview
  lines.push("Subject Identity:");
  if (identityGraph.primaryEmail) {
    lines.push(`  Primary email: ${identityGraph.primaryEmail}`);
  }
  if (identityGraph.primaryName) {
    lines.push(`  Name: ${identityGraph.primaryName}`);
  }
  const identifierCount =
    identityGraph.identifiers?.length ?? 0;
  if (identifierCount > 0) {
    lines.push(`  Known identifiers: ${identifierCount}`);
  }
  const resolvedCount =
    identityGraph.resolvedSystems?.length ?? 0;
  if (resolvedCount > 0) {
    lines.push(`  Systems resolved: ${resolvedCount}`);
  }
  lines.push("");

  // No findings case
  if (findings.length === 0) {
    lines.push("No findings were produced during this discovery run.");
    lines.push("This may indicate that no enabled integrations returned data,");
    lines.push("or that the data subject has no records in the queried systems.");
    return lines.join("\n");
  }

  // Aggregate stats
  const totalRecords = findings.reduce((sum, f) => sum + f.recordCount, 0);
  const art9Findings = findings.filter((f) => f.isArt9);
  const sourceSet = new Set(findings.map((f) => f.source));
  const allCategories = new Set(findings.flatMap((f) => f.dataCategories));

  lines.push("Overview:");
  lines.push(`  Total findings: ${findings.length}`);
  lines.push(`  Total records: ${totalRecords}`);
  lines.push(`  Sources queried: ${sourceSet.size}`);
  lines.push(`  Data categories found: ${allCategories.size > 0 ? Array.from(allCategories).join(", ") : "none"}`);
  lines.push("");

  // Art. 9 warning
  if (art9Findings.length > 0) {
    const art9Cats = new Set(art9Findings.flatMap((f) => {
      // Art. 9 categories are embedded at the finding level
      return f.dataCategories.filter(
        (c) => c === "SPECIAL_CATEGORY_ART9"
      );
    }));
    lines.push("*** ATTENTION: Art. 9 Special Category Data Detected ***");
    lines.push(`  ${art9Findings.length} finding(s) flagged as containing special category data.`);
    lines.push("  Manual review by a DPO or legal counsel is required before disclosure.");
    lines.push("");
  }

  // Per-source breakdown
  lines.push("Findings by Source:");
  const bySource = new Map<string, typeof findings>();
  for (const f of findings) {
    const list = bySource.get(f.source) ?? [];
    list.push(f);
    bySource.set(f.source, list);
  }
  const sourceKeys = Array.from(bySource.keys());
  for (const source of sourceKeys) {
    const sourceFindings = bySource.get(source)!;
    const sourceRecords = sourceFindings.reduce(
      (sum: number, f: { recordCount: number }) => sum + f.recordCount,
      0
    );
    const hasArt9 = sourceFindings.some((f: { isArt9: boolean }) => f.isArt9);
    lines.push(`  ${source}:`);
    lines.push(`    Findings: ${sourceFindings.length}, Records: ${sourceRecords}${hasArt9 ? " [Art. 9]" : ""}`);
    for (const f of sourceFindings) {
      lines.push(`    - ${f.title} (${f.recordCount} record${f.recordCount !== 1 ? "s" : ""})`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Mark the CopilotRun as COMPLETED and persist final results.
 */
async function completeRun(
  ctx: DiscoveryRunContext,
  startedAt: Date,
  result: {
    totalFindings: number;
    art9Flagged: boolean;
    art9Categories: string[];
    identityGraph: IdentityGraph;
    summary: string;
  }
): Promise<DiscoveryRunResult> {
  const completedAt = new Date();

  await prisma.copilotRun.update({
    where: { id: ctx.runId },
    data: {
      status: "COMPLETED",
      totalFindings: result.totalFindings,
      art9Flagged: result.art9Flagged,
      art9ReviewStatus: result.art9Flagged ? "PENDING_REVIEW" : undefined,
      identityGraph: result.identityGraph as unknown as Prisma.InputJsonValue,
      summary: result.summary,
      completedAt,
    },
  });

  // Persist identity profile for the case
  await prisma.identityProfile.upsert({
    where: {
      tenantId_caseId: {
        tenantId: ctx.tenantId,
        caseId: ctx.caseId,
      },
    },
    update: {
      runId: ctx.runId,
      primaryEmail: result.identityGraph.primaryEmail ?? null,
      primaryName: result.identityGraph.primaryName ?? null,
      identifiers: (result.identityGraph.identifiers ?? []) as unknown as Prisma.InputJsonValue,
      resolvedSystems: (result.identityGraph.resolvedSystems ?? []) as unknown as Prisma.InputJsonValue,
      confidence: result.identityGraph.confidence ?? 0,
    },
    create: {
      tenantId: ctx.tenantId,
      caseId: ctx.caseId,
      runId: ctx.runId,
      primaryEmail: result.identityGraph.primaryEmail ?? null,
      primaryName: result.identityGraph.primaryName ?? null,
      identifiers: (result.identityGraph.identifiers ?? []) as unknown as Prisma.InputJsonValue,
      resolvedSystems: (result.identityGraph.resolvedSystems ?? []) as unknown as Prisma.InputJsonValue,
      confidence: result.identityGraph.confidence ?? 0,
    },
  });

  await logAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: "copilot_run.completed",
    entityType: "CopilotRun",
    entityId: ctx.runId,
    details: {
      caseId: ctx.caseId,
      totalFindings: result.totalFindings,
      art9Flagged: result.art9Flagged,
      art9Categories: result.art9Categories,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    },
  });

  return {
    status: "COMPLETED",
    totalFindings: result.totalFindings,
    art9Flagged: result.art9Flagged,
    art9Categories: result.art9Categories,
    identityGraph: result.identityGraph,
    summary: result.summary,
  };
}

/**
 * Mark the CopilotRun as FAILED and log the error.
 */
async function failRun(
  ctx: DiscoveryRunContext,
  startedAt: Date,
  errorMessage: string
): Promise<DiscoveryRunResult> {
  const completedAt = new Date();

  await prisma.copilotRun.update({
    where: { id: ctx.runId },
    data: {
      status: "FAILED",
      errorMessage,
      completedAt,
    },
  });

  await logAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: "copilot_run.failed",
    entityType: "CopilotRun",
    entityId: ctx.runId,
    details: {
      caseId: ctx.caseId,
      error: errorMessage,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    },
  });

  // Return an empty identity graph on failure
  const emptyGraph: IdentityGraph = {
    primaryEmail: null,
    primaryName: null,
    identifiers: [],
    resolvedSystems: [],
    confidence: 0,
  };

  return {
    status: "FAILED",
    totalFindings: 0,
    art9Flagged: false,
    art9Categories: [],
    identityGraph: emptyGraph,
    summary: `Discovery run failed: ${errorMessage}`,
    errorMessage,
  };
}

/**
 * Create a CopilotQuery in SKIPPED status (e.g. rate limit hit, no connector).
 */
async function createSkippedQuery(
  ctx: DiscoveryRunContext,
  integrationId: string,
  provider: string,
  reason: string
): Promise<void> {
  await prisma.copilotQuery.create({
    data: {
      tenantId: ctx.tenantId,
      runId: ctx.runId,
      integrationId,
      provider,
      querySpec: {} as Prisma.InputJsonValue,
      status: "SKIPPED",
      errorMessage: reason,
      completedAt: new Date(),
    },
  });
}

/**
 * Build a QuerySpec for a given integration provider using subject identifiers.
 *
 * Uses `buildDefaultQuerySpec` as a base and fills in the subject's identifiers.
 */
function buildQuerySpecForIntegration(
  provider: string,
  subjectIdentifiers: { primary: { type: string; value: string }; alternatives: Array<{ type: string; value: string }> }
): QuerySpec {
  const base = buildDefaultQuerySpec("discovery_auto", provider);

  const spec: QuerySpec = {
    subjectIdentifiers: {
      primary: {
        type: subjectIdentifiers.primary.type as any,
        value: subjectIdentifiers.primary.value,
      },
      alternatives: subjectIdentifiers.alternatives.map((a) => ({
        type: a.type as any,
        value: a.value,
      })),
    },
    timeRange: base.timeRange,
    searchTerms: base.searchTerms,
    providerScope: base.providerScope ?? {},
    outputOptions: base.outputOptions ?? {
      mode: "metadata_only" as const,
      maxItems: 500,
      includeAttachments: false,
    },
    legal: base.legal ?? {
      purpose: "DSAR" as const,
      dataMinimization: true,
    },
    templateId: "discovery_auto",
  };

  // Validate (non-throwing — if validation fails we still attempt the query
  // with the best-effort spec; the connector can reject it).
  try {
    return validateQuerySpec(spec, provider);
  } catch {
    // Return unvalidated spec — the connector will perform its own checks.
    return spec;
  }
}

/**
 * Extract text content from a CollectionResult for PII detection.
 *
 * Serialises the `resultMetadata` and `findingsSummary` into a single string
 * so that regex/keyword detectors can scan for patterns.
 */
function extractTextForDetection(result: CollectionResult): string {
  const parts: string[] = [];

  // Include the human-readable findings summary
  if (result.findingsSummary) {
    parts.push(result.findingsSummary);
  }

  // Serialise resultMetadata — this may contain text fields like names,
  // emails, notes, etc. that the detectors should scan.
  if (result.resultMetadata) {
    try {
      parts.push(JSON.stringify(result.resultMetadata));
    } catch {
      // If serialisation fails, skip it
    }
  }

  return parts.join("\n\n");
}

/**
 * Build a human-readable location string for a finding.
 */
function buildLocationString(provider: string, integrationName: string): string {
  return `${provider}:${integrationName}`;
}

/**
 * Determine finding severity based on data categories and Art. 9 presence.
 */
function determineSeverity(
  dataCategories: string[],
  isArt9: boolean
): string {
  if (isArt9) {
    return "CRITICAL";
  }

  // Presence of financial or HR data elevates severity
  const highCategories = new Set([
    "PAYMENT_BANK",
    "CREDIT_FINANCIAL",
    "HR_EMPLOYMENT",
  ]);

  const mediumCategories = new Set([
    "IDENTIFICATION",
    "CONTACT",
    "CONTRACT",
    "COMMUNICATION",
  ]);

  for (const cat of dataCategories) {
    if (highCategories.has(cat)) {
      return "HIGH";
    }
  }

  for (const cat of dataCategories) {
    if (mediumCategories.has(cat)) {
      return "MEDIUM";
    }
  }

  if (dataCategories.length > 0) {
    return "LOW";
  }

  return "INFO";
}
