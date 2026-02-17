/**
 * Discovery Engine Service — orchestrates a Privacy Copilot discovery run.
 *
 * Coordinates between the Identity service, connector queries, and
 * detection/classification to produce a complete set of findings for
 * a DSAR case.
 *
 * Flow:
 *   0. Mark run as RUNNING
 *   1. Load case + data subject
 *   2. Build identity graph from case data
 *   3. Find all ENABLED integrations for the tenant (filter by providerSelection)
 *   4. For each integration, create CopilotQuery with new fields and execute via connector
 *   5. After connector returns, create EvidenceItems
 *   6. Run detection on EvidenceItem text -> create DetectorResult records linked to EvidenceItem
 *   7. Create Findings — aggregate by DataCategory
 *   8. Flag special categories if detected (Art. 9), auto-create Task
 *   9. Generate a deterministic text summary
 *  10. Update the CopilotRun record + upsert IdentityProfile
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
  hasSpecialCategory,
  getSpecialCategories,
  classifyFindings,
  SPECIAL_CATEGORIES,
  type DetectionResult,
  type DataCategoryType,
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
  justification: string;
  providerSelection?: string[];
}

export interface DiscoveryRunResult {
  status: "COMPLETED" | "FAILED";
  totalFindings: number;
  totalEvidenceItems: number;
  containsSpecialCategory: boolean;
  specialCategories: string[];
  identityGraph: IdentityGraph;
  resultSummary: string;
  errorDetails?: string;
}

/**
 * Internal type for accumulating per-query evidence and detection data
 * before the aggregation step that creates Finding records.
 */
interface EvidenceRecord {
  evidenceItemId: string;
  integrationId: string;
  provider: string;
  queryId: string;
  detectionResults: DetectionResult[];
  classifiedCategories: string[];
  containsSpecialCategory: boolean;
  specialCategories: string[];
  recordCount: number;
  title: string;
  location: string;
}

// ---------------------------------------------------------------------------
// Provider -> EvidenceItemType mapping
// ---------------------------------------------------------------------------

/**
 * Map an IntegrationProvider string to the appropriate EvidenceItemType enum value.
 */
function mapProviderToItemType(provider: string): string {
  const mapping: Record<string, string> = {
    EXCHANGE_ONLINE: "EMAIL",
    SHAREPOINT: "FILE",
    ONEDRIVE: "FILE",
    M365: "RECORD",
    GOOGLE_WORKSPACE: "RECORD",
    SALESFORCE: "RECORD",
    SERVICENOW: "TICKET",
    ATLASSIAN_JIRA: "TICKET",
    ATLASSIAN_CONFLUENCE: "FILE",
    WORKDAY: "RECORD",
    SAP_SUCCESSFACTORS: "RECORD",
    OKTA: "RECORD",
    AWS: "RECORD",
    AZURE: "RECORD",
    GCP: "RECORD",
  };
  return mapping[provider] ?? "OTHER";
}

/**
 * Determine the workload label for an EvidenceItem from the provider.
 */
function mapProviderToWorkload(provider: string): string | null {
  const mapping: Record<string, string> = {
    EXCHANGE_ONLINE: "EXCHANGE",
    SHAREPOINT: "SHAREPOINT",
    ONEDRIVE: "ONEDRIVE",
    M365: "ENTRA_ID",
    GOOGLE_WORKSPACE: "GOOGLE",
    SALESFORCE: "SALESFORCE",
    SERVICENOW: "SERVICENOW",
    ATLASSIAN_JIRA: "JIRA",
    ATLASSIAN_CONFLUENCE: "CONFLUENCE",
  };
  return mapping[provider] ?? null;
}

// ---------------------------------------------------------------------------
// Severity determination
// ---------------------------------------------------------------------------

/**
 * Map a DataCategory to a FindingSeverity value.
 *
 * Uses the new three-level enum: INFO, WARNING, CRITICAL.
 * - CRITICAL: special category data (Art. 9)
 * - WARNING: sensitive categories (PAYMENT, CREDITWORTHINESS, HR)
 * - INFO: everything else
 */
function determineSeverity(
  dataCategory: string,
  isSpecialCategory: boolean
): "INFO" | "WARNING" | "CRITICAL" {
  if (isSpecialCategory) {
    return "CRITICAL";
  }

  const warningCategories = new Set([
    "PAYMENT",
    "CREDITWORTHINESS",
    "HR",
  ]);

  if (warningCategories.has(dataCategory)) {
    return "WARNING";
  }

  return "INFO";
}

/**
 * Generate a deterministic summary string for a Finding based on its data category.
 */
function buildFindingSummary(
  dataCategory: string,
  evidenceCount: number,
  providers: string[]
): string {
  const providerList = providers.join(", ");
  return `${dataCategory} data detected across ${evidenceCount} evidence item(s) from: ${providerList}.`;
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
    details: { caseId: ctx.caseId, justification: ctx.justification },
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
    //    Filter by providerSelection if provided
    // ----------------------------------------------------------------
    const integrationWhere: Prisma.IntegrationWhereInput = {
      tenantId: ctx.tenantId,
      status: "ENABLED",
    };

    if (ctx.providerSelection && ctx.providerSelection.length > 0) {
      integrationWhere.provider = {
        in: ctx.providerSelection as any,
      };
    }

    const integrations = await prisma.integration.findMany({
      where: integrationWhere,
    });

    if (integrations.length === 0) {
      const resultSummary = generateFindingsSummary([], [], identityGraph);
      return await completeRun(ctx, startedAt, {
        totalFindings: 0,
        totalEvidenceItems: 0,
        containsSpecialCategory: false,
        specialCategories: [],
        identityGraph,
        resultSummary,
      });
    }

    // ----------------------------------------------------------------
    // 4 – 7. Iterate integrations: query, create evidence, detect, persist
    // ----------------------------------------------------------------
    const allEvidenceRecords: EvidenceRecord[] = [];
    let globalContainsSpecialCategory = false;
    const globalSpecialCategories = new Set<string>();

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

      // Build a query text for the new CopilotQuery field
      const queryText = `Locate all data for subject "${subjectIdentifiers.primary.value}" in ${integration.provider} (${integration.name})`;

      // ----------------------------------------------------------------
      // Step 4: Create CopilotQuery record with new fields (PENDING)
      // ----------------------------------------------------------------
      const copilotQuery = await prisma.copilotQuery.create({
        data: {
          tenantId: ctx.tenantId,
          caseId: ctx.caseId,
          runId: ctx.runId,
          createdByUserId: ctx.userId,
          queryText,
          queryIntent: "DATA_LOCATION",
          executionMode: "METADATA_ONLY",
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
        type: "system_account",
        value: `${integration.provider}:${(collectionResult.resultMetadata as Record<string, unknown>)?.provider?.toString() ?? integration.provider}`,
        confidence: 0.85,
        source: integration.provider,
      });

      // ----------------------------------------------------------
      // Step 5: Create EvidenceItem
      // ----------------------------------------------------------
      const evidenceItem = await prisma.evidenceItem.create({
        data: {
          tenantId: ctx.tenantId,
          caseId: ctx.caseId,
          runId: ctx.runId,
          queryId: copilotQuery.id,
          integrationId: integration.id,
          provider: integration.provider,
          workload: mapProviderToWorkload(integration.provider),
          itemType: mapProviderToItemType(integration.provider) as any,
          location: buildLocationString(integration.provider, integration.name),
          title: `${integration.name}: ${collectionResult.findingsSummary}`,
          metadata: collectionResult.resultMetadata as unknown as Prisma.InputJsonValue,
          contentHandling: "METADATA_ONLY",
        },
      });

      // ----------------------------------------------------------
      // Step 6: Run detection on collected data -> create DetectorResult
      // ----------------------------------------------------------

      // Extract text content from resultMetadata for PII detection.
      const textForDetection = extractTextForDetection(collectionResult);
      const detectionResults = runAllDetectors(textForDetection);
      const classifiedCategories = classifyFindings(detectionResults);

      const specialCategoryDetected = hasSpecialCategory(detectionResults);
      const specialCats = getSpecialCategories(detectionResults);

      if (specialCategoryDetected) {
        globalContainsSpecialCategory = true;
        for (const cat of specialCats) {
          globalSpecialCategories.add(cat);
        }
      }

      // Merge any identifiers discovered during detection
      if (detectionResults.length > 0) {
        const discoveredIdentifiers = detectionResults
          .flatMap((d) =>
            d.detectedElements
              .filter((el) => el.elementType === "EMAIL_ADDRESS" && el.snippetPreview)
              .map((el) => ({
                type: "email" as const,
                value: el.snippetPreview!,
                source: integration.provider,
                confidence: d.detectedCategories[0]?.confidence ?? el.confidence,
              }))
          );
        if (discoveredIdentifiers.length > 0) {
          mergeIdentifiers(identityGraph, discoveredIdentifiers, integration.provider);
        }
      }

      // Create DetectorResult records linked to EvidenceItem (not Finding)
      if (detectionResults.length > 0) {
        await prisma.detectorResult.createMany({
          data: detectionResults.map((dr) => ({
            tenantId: ctx.tenantId,
            caseId: ctx.caseId,
            runId: ctx.runId,
            evidenceItemId: evidenceItem.id,
            detectorType: dr.detectorType,
            detectedElements: dr.detectedElements as unknown as Prisma.InputJsonValue,
            detectedCategories: dr.detectedCategories as unknown as Prisma.InputJsonValue,
            containsSpecialCategorySuspected: dr.containsSpecialCategorySuspected,
          })),
        });
      }

      // Accumulate evidence record for aggregation step
      const evidenceRecord: EvidenceRecord = {
        evidenceItemId: evidenceItem.id,
        integrationId: integration.id,
        provider: integration.provider,
        queryId: copilotQuery.id,
        detectionResults,
        classifiedCategories,
        containsSpecialCategory: specialCategoryDetected,
        specialCategories: specialCats,
        recordCount: collectionResult.recordsFound,
        title: `${integration.name}: ${collectionResult.findingsSummary}`,
        location: buildLocationString(integration.provider, integration.name),
      };
      allEvidenceRecords.push(evidenceRecord);

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
          evidenceItemId: evidenceItem.id,
          detectorCount: detectionResults.length,
          specialCategoryDetected,
        },
      });
    }

    // ----------------------------------------------------------------
    // Step 7: Create Findings — aggregate by DataCategory
    // ----------------------------------------------------------------
    const categoryAggregation = new Map<
      string,
      {
        evidenceItemIds: string[];
        providers: Set<string>;
        isSpecialCategory: boolean;
        maxConfidence: number;
      }
    >();

    for (const evidence of allEvidenceRecords) {
      for (const cat of evidence.classifiedCategories) {
        let agg = categoryAggregation.get(cat);
        if (!agg) {
          agg = {
            evidenceItemIds: [],
            providers: new Set(),
            isSpecialCategory: false,
            maxConfidence: 0,
          };
          categoryAggregation.set(cat, agg);
        }
        agg.evidenceItemIds.push(evidence.evidenceItemId);
        agg.providers.add(evidence.provider);

        // Check if this category is a special category
        const isSpecial = SPECIAL_CATEGORIES.has(cat as DataCategoryType);
        if (isSpecial) {
          agg.isSpecialCategory = true;
        }

        // Track the max confidence across all detectors for this category
        for (const dr of evidence.detectionResults) {
          for (const dc of dr.detectedCategories) {
            if (dc.category === cat && dc.confidence > agg.maxConfidence) {
              agg.maxConfidence = dc.confidence;
            }
          }
        }
      }
    }

    const findingIds: string[] = [];
    const categoryKeys = Array.from(categoryAggregation.keys());
    for (const dataCategory of categoryKeys) {
      const agg = categoryAggregation.get(dataCategory)!;
      const severity = determineSeverity(dataCategory, agg.isSpecialCategory);
      const summary = buildFindingSummary(
        dataCategory,
        agg.evidenceItemIds.length,
        Array.from(agg.providers)
      );

      const finding = await prisma.finding.create({
        data: {
          tenantId: ctx.tenantId,
          caseId: ctx.caseId,
          runId: ctx.runId,
          dataCategory: dataCategory as any,
          severity,
          confidence: agg.maxConfidence,
          summary,
          evidenceItemIds: agg.evidenceItemIds,
          containsSpecialCategory: agg.isSpecialCategory,
          containsThirdPartyDataSuspected: false,
          requiresLegalReview: agg.isSpecialCategory,
        },
      });

      findingIds.push(finding.id);
    }

    // ----------------------------------------------------------------
    // Step 8: Flag special categories if detected
    // ----------------------------------------------------------------
    const specialCategoriesArray = Array.from(globalSpecialCategories);

    if (globalContainsSpecialCategory) {
      // Update the CopilotRun with special category flags
      await prisma.copilotRun.update({
        where: { id: ctx.runId },
        data: {
          containsSpecialCategory: true,
          legalApprovalStatus: "REQUIRED",
        },
      });

      // Auto-create a Task in the case for legal review
      await prisma.task.create({
        data: {
          tenantId: ctx.tenantId,
          caseId: ctx.caseId,
          title: "Legal Review Required (Art. 9 Data Detected)",
          description: `Copilot Run ${ctx.runId} detected special category data (${specialCategoriesArray.join(", ")}). Manual review by a DPO or legal counsel is required before disclosure.`,
          status: "OPEN",
        },
      });

      await logAudit({
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "copilot_run.special_category_detected",
        entityType: "CopilotRun",
        entityId: ctx.runId,
        details: {
          caseId: ctx.caseId,
          specialCategories: specialCategoriesArray,
          legalApprovalStatus: "REQUIRED",
        },
      });
    }

    // ----------------------------------------------------------------
    // Step 9: Generate deterministic summary
    // ----------------------------------------------------------------
    const summaryFindings = Array.from(categoryAggregation.entries()).map(
      ([dataCategory, agg]) => ({
        dataCategory,
        severity: determineSeverity(dataCategory, agg.isSpecialCategory),
        evidenceCount: agg.evidenceItemIds.length,
        providers: Array.from(agg.providers),
        isSpecialCategory: agg.isSpecialCategory,
      })
    );

    const resultSummary = generateFindingsSummary(
      summaryFindings,
      allEvidenceRecords,
      identityGraph
    );

    // ----------------------------------------------------------------
    // Step 10: Complete run — update CopilotRun, upsert IdentityProfile
    // ----------------------------------------------------------------
    return await completeRun(ctx, startedAt, {
      totalFindings: findingIds.length,
      totalEvidenceItems: allEvidenceRecords.length,
      containsSpecialCategory: globalContainsSpecialCategory,
      specialCategories: specialCategoriesArray,
      identityGraph,
      resultSummary,
    });
  } catch (err) {
    const errorDetails =
      err instanceof Error ? err.message : "Unknown fatal error";
    return await failRun(ctx, startedAt, errorDetails);
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
    dataCategory: string;
    severity: string;
    evidenceCount: number;
    providers: string[];
    isSpecialCategory: boolean;
  }>,
  evidenceRecords: Array<{
    provider: string;
    recordCount: number;
    title: string;
  }>,
  identityGraph: IdentityGraph
): string {
  const lines: string[] = [];

  // Header
  lines.push("=== Discovery Run Summary ===");
  lines.push("");

  // Identity overview
  lines.push("Subject Identity:");
  if (identityGraph.primaryIdentifierType === "EMAIL") {
    lines.push(`  Primary email: ${identityGraph.primaryIdentifierValue}`);
  } else {
    lines.push(`  Primary identifier (${identityGraph.primaryIdentifierType}): ${identityGraph.primaryIdentifierValue}`);
  }
  if (identityGraph.displayName) {
    lines.push(`  Name: ${identityGraph.displayName}`);
  }
  const identifierCount =
    identityGraph.alternateIdentifiers?.length ?? 0;
  if (identifierCount > 0) {
    lines.push(`  Known identifiers: ${identifierCount}`);
  }
  const resolvedCount =
    identityGraph.alternateIdentifiers?.filter((id) => id.type === "system_account").length ?? 0;
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
  const totalRecords = evidenceRecords.reduce((sum, e) => sum + e.recordCount, 0);
  const totalEvidenceItems = evidenceRecords.length;
  const specialFindings = findings.filter((f) => f.isSpecialCategory);
  const sourceSet = new Set(evidenceRecords.map((e) => e.provider));
  const allCategories = new Set(findings.map((f) => f.dataCategory));

  lines.push("Overview:");
  lines.push(`  Total findings: ${findings.length}`);
  lines.push(`  Total evidence items: ${totalEvidenceItems}`);
  lines.push(`  Total records: ${totalRecords}`);
  lines.push(`  Sources queried: ${sourceSet.size}`);
  lines.push(`  Data categories found: ${allCategories.size > 0 ? Array.from(allCategories).join(", ") : "none"}`);
  lines.push("");

  // Special category warning
  if (specialFindings.length > 0) {
    lines.push("*** ATTENTION: Art. 9 Special Category Data Detected ***");
    lines.push(`  ${specialFindings.length} finding(s) flagged as containing special category data.`);
    lines.push("  Manual review by a DPO or legal counsel is required before disclosure.");
    lines.push("");
  }

  // Findings by category
  lines.push("Findings by Data Category:");
  for (const f of findings) {
    const severityLabel = f.isSpecialCategory ? " [SPECIAL CATEGORY]" : "";
    lines.push(`  ${f.dataCategory} (${f.severity})${severityLabel}:`);
    lines.push(`    Evidence items: ${f.evidenceCount}`);
    lines.push(`    Providers: ${f.providers.join(", ")}`);
  }
  lines.push("");

  // Per-source breakdown
  lines.push("Evidence by Source:");
  const bySource = new Map<string, typeof evidenceRecords>();
  for (const e of evidenceRecords) {
    const list = bySource.get(e.provider) ?? [];
    list.push(e);
    bySource.set(e.provider, list);
  }
  const sourceKeys = Array.from(bySource.keys());
  for (const source of sourceKeys) {
    const sourceEvidence = bySource.get(source)!;
    const sourceRecords = sourceEvidence.reduce(
      (sum: number, e: { recordCount: number }) => sum + e.recordCount,
      0
    );
    lines.push(`  ${source}:`);
    lines.push(`    Evidence items: ${sourceEvidence.length}, Records: ${sourceRecords}`);
    for (const e of sourceEvidence) {
      lines.push(`    - ${e.title} (${e.recordCount} record${e.recordCount !== 1 ? "s" : ""})`);
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
    totalEvidenceItems: number;
    containsSpecialCategory: boolean;
    specialCategories: string[];
    identityGraph: IdentityGraph;
    resultSummary: string;
  }
): Promise<DiscoveryRunResult> {
  const completedAt = new Date();

  await prisma.copilotRun.update({
    where: { id: ctx.runId },
    data: {
      status: "COMPLETED",
      totalFindings: result.totalFindings,
      totalEvidenceItems: result.totalEvidenceItems,
      containsSpecialCategory: result.containsSpecialCategory,
      legalApprovalStatus: result.containsSpecialCategory ? "REQUIRED" : "NOT_REQUIRED",
      resultSummary: result.resultSummary,
      completedAt,
    },
  });

  // Persist identity profile for the case using new field names.
  // Map IdentityGraph fields to the new IdentityProfile schema:
  //   displayName <- primaryName
  //   primaryIdentifierType <- derived from primary identifier type
  //   primaryIdentifierValue <- primary identifier value
  //   alternateIdentifiers <- identifiers array (all except primary)
  //   confidenceScore <- confidence * 100 (0..100 int)

  const subjectIds = buildSubjectIdentifiers(result.identityGraph);
  const primaryIdType = mapIdentifierTypeToEnum(subjectIds.primary.type);
  const primaryIdValue = subjectIds.primary.value;

  const alternateIdentifiers = (result.identityGraph.alternateIdentifiers ?? []).map((entry) => ({
    type: entry.type,
    value: entry.value,
    confidence: entry.confidence,
    source: entry.source,
  }));

  const confidenceScore = result.identityGraph.confidenceScore ?? 0;

  await prisma.identityProfile.upsert({
    where: {
      tenantId_caseId: {
        tenantId: ctx.tenantId,
        caseId: ctx.caseId,
      },
    },
    update: {
      displayName: result.identityGraph.displayName ?? "Unknown",
      primaryIdentifierType: primaryIdType as any,
      primaryIdentifierValue: primaryIdValue,
      alternateIdentifiers: alternateIdentifiers as unknown as Prisma.InputJsonValue,
      confidenceScore,
    },
    create: {
      tenantId: ctx.tenantId,
      caseId: ctx.caseId,
      displayName: result.identityGraph.displayName ?? "Unknown",
      primaryIdentifierType: primaryIdType as any,
      primaryIdentifierValue: primaryIdValue,
      alternateIdentifiers: alternateIdentifiers as unknown as Prisma.InputJsonValue,
      confidenceScore,
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
      totalEvidenceItems: result.totalEvidenceItems,
      containsSpecialCategory: result.containsSpecialCategory,
      specialCategories: result.specialCategories,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    },
  });

  return {
    status: "COMPLETED",
    totalFindings: result.totalFindings,
    totalEvidenceItems: result.totalEvidenceItems,
    containsSpecialCategory: result.containsSpecialCategory,
    specialCategories: result.specialCategories,
    identityGraph: result.identityGraph,
    resultSummary: result.resultSummary,
  };
}

/**
 * Mark the CopilotRun as FAILED and log the error.
 */
async function failRun(
  ctx: DiscoveryRunContext,
  startedAt: Date,
  errorDetails: string
): Promise<DiscoveryRunResult> {
  const completedAt = new Date();

  await prisma.copilotRun.update({
    where: { id: ctx.runId },
    data: {
      status: "FAILED",
      errorDetails,
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
      error: errorDetails,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    },
  });

  // Return an empty identity graph on failure
  const emptyGraph: IdentityGraph = {
    displayName: "",
    primaryIdentifierType: "OTHER",
    primaryIdentifierValue: "",
    alternateIdentifiers: [],
    confidenceScore: 0,
  };

  return {
    status: "FAILED",
    totalFindings: 0,
    totalEvidenceItems: 0,
    containsSpecialCategory: false,
    specialCategories: [],
    identityGraph: emptyGraph,
    resultSummary: `Discovery run failed: ${errorDetails}`,
    errorDetails,
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
      caseId: ctx.caseId,
      runId: ctx.runId,
      createdByUserId: ctx.userId,
      queryText: `Skipped: ${reason}`,
      queryIntent: "DATA_LOCATION",
      executionMode: "METADATA_ONLY",
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
 * Map an identity entry type string (from IdentityGraph) to the
 * PrimaryIdentifierType enum value used in the IdentityProfile model.
 */
function mapIdentifierTypeToEnum(type: string): string {
  const mapping: Record<string, string> = {
    email: "EMAIL",
    upn: "UPN",
    objectId: "OBJECT_ID",
    employeeId: "EMPLOYEE_ID",
    phone: "PHONE",
    name: "OTHER",
    custom: "OTHER",
  };
  return mapping[type] ?? "OTHER";
}
