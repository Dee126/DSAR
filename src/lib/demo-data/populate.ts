/**
 * Populates existing DSAR cases with synthetic evidence, findings,
 * copilot runs, data collection items, and audit events.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import type {
  DSARCase,
  DataSubject,
  User,
  Integration,
} from "@prisma/client";
import {
  generateExchangeEvidence,
  generateSharePointEvidence,
  generateOneDriveEvidence,
  generateM365Evidence,
  generateDetectors,
  generateFindings,
  generateLocationSummary,
  generateCategorySummary,
  generateDataCollections,
  generateTasks,
  getEvidenceCounts,
} from "./generators";

export interface PopulateOptions {
  intensity: "small" | "medium" | "large";
  includeSpecialCategory: boolean;
  generateCopilotRuns: boolean;
  generateExports: boolean;
}

export interface PopulateResult {
  casesProcessed: number;
  evidenceItemsCreated: number;
  findingsCreated: number;
  copilotRunsCreated: number;
  tasksCreated: number;
  dataCollectionItemsCreated: number;
  documentsCreated: number;
  auditLogsCreated: number;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function populateDemoEvidence(
  prisma: PrismaClient,
  tenantId: string,
  userId: string,
  options: PopulateOptions,
): Promise<PopulateResult> {
  const result: PopulateResult = {
    casesProcessed: 0,
    evidenceItemsCreated: 0,
    findingsCreated: 0,
    copilotRunsCreated: 0,
    tasksCreated: 0,
    dataCollectionItemsCreated: 0,
    documentsCreated: 0,
    auditLogsCreated: 0,
  };

  // Get all cases for this tenant with their data subjects
  const cases = await prisma.dSARCase.findMany({
    where: { tenantId, deletedAt: null },
    include: { dataSubject: true },
  });

  if (cases.length === 0) return result;

  // Get integrations for this tenant (enabled only)
  const integrations = await prisma.integration.findMany({
    where: { tenantId, status: "ENABLED" },
  });

  const integrationMap: Record<string, Integration> = {};
  for (const int of integrations) {
    integrationMap[int.provider] = int;
  }

  // Get users for assignment
  const users = await prisma.user.findMany({
    where: { tenantId },
  });

  // Art. 9 injection: apply to ~40% of cases if enabled
  const caseIds = cases.map((c) => c.id);
  const art9CaseIds = new Set<string>();
  if (options.includeSpecialCategory) {
    const shuffled = [...caseIds].sort(() => Math.random() - 0.5);
    const count = Math.max(1, Math.ceil(shuffled.length * 0.4));
    for (let i = 0; i < count; i++) {
      art9CaseIds.add(shuffled[i]);
    }
  }

  // Log tenant-level event
  await prisma.auditLog.create({
    data: {
      tenantId,
      actorUserId: userId,
      action: "DEMO_DATA_POPULATED",
      entityType: "Tenant",
      entityId: tenantId,
      details: {
        intensity: options.intensity,
        includeSpecialCategory: options.includeSpecialCategory,
        generateCopilotRuns: options.generateCopilotRuns,
        generateExports: options.generateExports,
        caseCount: cases.length,
        isDemoData: true,
      },
    },
  });
  result.auditLogsCreated++;

  // Process each case
  for (const dsarCase of cases) {
    const isArt9 = art9CaseIds.has(dsarCase.id);
    await populateCase(
      prisma,
      dsarCase,
      dsarCase.dataSubject,
      tenantId,
      userId,
      users,
      integrationMap,
      options,
      isArt9,
      result,
    );
    result.casesProcessed++;
  }

  return result;
}

async function populateCase(
  prisma: PrismaClient,
  dsarCase: DSARCase,
  subject: DataSubject | null,
  tenantId: string,
  actorUserId: string,
  users: User[],
  integrations: Record<string, Integration>,
  options: PopulateOptions,
  isArt9: boolean,
  result: PopulateResult,
): Promise<void> {
  const subjectName = subject?.fullName ?? "Unknown Subject";
  const subjectEmail = subject?.email ?? "unknown@example.test";
  const caseType = dsarCase.type;
  const caseStatus = dsarCase.status;
  const assignee = dsarCase.assignedToUserId
    ? users.find((u) => u.id === dsarCase.assignedToUserId)
    : pick(users);

  // ── 1. Identity Profile ────────────────────────────────────────────────
  const existingProfile = await prisma.identityProfile.findUnique({
    where: { tenantId_caseId: { tenantId, caseId: dsarCase.id } },
  });

  let identityProfileId: string;
  if (existingProfile) {
    identityProfileId = existingProfile.id;
  } else {
    const profile = await prisma.identityProfile.create({
      data: {
        tenantId,
        caseId: dsarCase.id,
        displayName: subjectName,
        primaryIdentifierType: "EMAIL",
        primaryIdentifierValue: subjectEmail,
        alternateIdentifiers: [
          { type: "email", value: subjectEmail, confidence: 0.9, source: "case_data" },
          { type: "name", value: subjectName, confidence: 0.9, source: "case_data" },
        ],
        confidenceScore: 90,
        createdByUserId: actorUserId,
      },
    });
    identityProfileId = profile.id;
  }

  // ── 2. Data Collection Items ───────────────────────────────────────────
  const existingCollections = await prisma.dataCollectionItem.count({
    where: { tenantId, caseId: dsarCase.id },
  });

  if (existingCollections === 0) {
    const collectionTemplates = generateDataCollections(caseType, caseStatus, subjectEmail);
    for (const tpl of collectionTemplates) {
      const integration = integrations[tpl.provider];
      await prisma.dataCollectionItem.create({
        data: {
          tenantId,
          caseId: dsarCase.id,
          integrationId: integration?.id ?? undefined,
          systemLabel: tpl.systemLabel,
          querySpec: {
            subjectIdentifiers: { primary: { type: "email", value: subjectEmail } },
            providerScope: {},
            outputOptions: { mode: "metadata_only", maxItems: 500 },
            legal: { purpose: "DSAR", dataMinimization: true },
            isDemoData: true,
          },
          status: tpl.status,
          findingsSummary: tpl.findingsSummary,
          recordsFound: tpl.recordsFound,
          resultMetadata: (tpl.resultMetadata ?? undefined) as Prisma.InputJsonValue | undefined,
          assignedToUserId: assignee?.id,
          startedAt: tpl.status !== "PENDING" ? daysAgo(randInt(3, 10)) : undefined,
          completedAt: tpl.status === "COMPLETED" ? daysAgo(randInt(1, 5)) : undefined,
        },
      });
      result.dataCollectionItemsCreated++;
    }

    await prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action: "DATA_COLLECTION_COMPLETED",
        entityType: "DSARCase",
        entityId: dsarCase.id,
        details: { caseNumber: dsarCase.caseNumber, itemCount: collectionTemplates.length, isDemoData: true },
      },
    });
    result.auditLogsCreated++;
  }

  // ── 3. Tasks ───────────────────────────────────────────────────────────
  const existingTasks = await prisma.task.count({
    where: { tenantId, caseId: dsarCase.id },
  });

  if (existingTasks === 0) {
    const taskTemplates = generateTasks(caseType, caseStatus, isArt9);
    for (const tpl of taskTemplates) {
      await prisma.task.create({
        data: {
          tenantId,
          caseId: dsarCase.id,
          title: tpl.title,
          description: tpl.description,
          status: tpl.status,
          assigneeUserId: assignee?.id,
          dueDate: tpl.dueDaysFromNow > 0 ? daysFromNow(tpl.dueDaysFromNow) : daysAgo(Math.abs(tpl.dueDaysFromNow)),
        },
      });
      result.tasksCreated++;
    }
  }

  // ── 4. Copilot Run + Evidence + Findings ───────────────────────────────
  if (options.generateCopilotRuns) {
    const existingRuns = await prisma.copilotRun.count({
      where: { tenantId, caseId: dsarCase.id },
    });

    if (existingRuns === 0) {
      await createCopilotRun(
        prisma,
        dsarCase,
        tenantId,
        actorUserId,
        subjectName,
        subjectEmail,
        identityProfileId,
        integrations,
        options,
        isArt9,
        result,
      );
    }
  }

  // ── 5. Legal Review for Art. 9 ─────────────────────────────────────────
  if (isArt9) {
    const existingReview = await prisma.legalReview.count({
      where: { tenantId, caseId: dsarCase.id },
    });

    if (existingReview === 0) {
      await prisma.legalReview.create({
        data: {
          tenantId,
          caseId: dsarCase.id,
          status: caseStatus === "REVIEW_LEGAL" ? "IN_REVIEW" : "PENDING",
          issues: "Special category data (Art. 9) suspected: Health-related keywords found in evidence. Legal basis for processing must be verified.",
          exemptionsApplied: [],
          notes: "Auto-generated by demo data. Requires DPO review.",
          reviewerUserId: actorUserId,
        },
      });

      await prisma.auditLog.create({
        data: {
          tenantId,
          actorUserId,
          action: "LEGAL_REVIEW_REQUIRED",
          entityType: "DSARCase",
          entityId: dsarCase.id,
          details: { caseNumber: dsarCase.caseNumber, reason: "Art. 9 special category data suspected", isDemoData: true },
        },
      });
      result.auditLogsCreated++;
    }
  }
}

async function createCopilotRun(
  prisma: PrismaClient,
  dsarCase: DSARCase,
  tenantId: string,
  actorUserId: string,
  subjectName: string,
  subjectEmail: string,
  identityProfileId: string,
  integrations: Record<string, Integration>,
  options: PopulateOptions,
  isArt9: boolean,
  result: PopulateResult,
): Promise<void> {
  const caseType = dsarCase.type;
  const evidenceCounts = getEvidenceCounts(caseType, options.intensity);

  // Generate evidence templates
  const exchangeEvidence = generateExchangeEvidence(subjectEmail, subjectName, evidenceCounts.exchange);
  const spEvidence = generateSharePointEvidence(subjectEmail, subjectName, evidenceCounts.sharepoint);
  const odEvidence = generateOneDriveEvidence(subjectEmail, subjectName, evidenceCounts.onedrive);
  const m365Evidence = generateM365Evidence(subjectEmail, subjectName);
  const allEvidence = [m365Evidence, ...exchangeEvidence, ...spEvidence, ...odEvidence];

  // Generate findings
  const findingTemplates = generateFindings(caseType, isArt9, options.intensity);
  const hasSpecialCat = findingTemplates.some((f) => f.containsSpecialCategory);

  // Create the run
  const providers = ["M365", "EXCHANGE_ONLINE", "SHAREPOINT", "ONEDRIVE"];
  const run = await prisma.copilotRun.create({
    data: {
      tenantId,
      caseId: dsarCase.id,
      createdByUserId: actorUserId,
      status: "COMPLETED",
      justification: `DSAR fulfillment — automated data discovery for ${caseType.toLowerCase()} request (demo data)`,
      scopeSummary: providers.join(", "),
      providerSelection: providers
        .filter((p) => integrations[p])
        .map((p) => ({
          integrationId: integrations[p].id,
          provider: p,
          workload: p === "M365" ? "user_profile" : p === "EXCHANGE_ONLINE" ? "mailbox_search" : "site_search",
        })),
      resultSummary: `Discovery completed. Found ${allEvidence.length} evidence items across ${providers.length} providers. ${findingTemplates.length} findings generated.${hasSpecialCat ? " Special category (Art. 9) data suspected." : ""}`,
      containsSpecialCategory: hasSpecialCat,
      legalApprovalStatus: hasSpecialCat ? "REQUIRED" : "NOT_REQUIRED",
      totalFindings: findingTemplates.length,
      totalEvidenceItems: allEvidence.length,
      startedAt: daysAgo(randInt(3, 12)),
      completedAt: daysAgo(randInt(1, 3)),
      metadata: { isDemoData: true },
    },
  });
  result.copilotRunsCreated++;

  // Create queries
  const queryM365 = integrations.M365
    ? await prisma.copilotQuery.create({
        data: {
          tenantId,
          caseId: dsarCase.id,
          runId: run.id,
          createdByUserId: actorUserId,
          queryText: `Locate personal data for ${subjectName} in M365 directory`,
          queryIntent: "DATA_LOCATION",
          subjectIdentityId: identityProfileId,
          executionMode: "METADATA_ONLY",
          integrationId: integrations.M365.id,
          provider: "M365",
          querySpec: {
            subjectIdentifiers: { primary: { type: "email", value: subjectEmail } },
            providerScope: { lookupType: "user_profile" },
            isDemoData: true,
          },
          status: "COMPLETED",
          recordsFound: 1,
          executionMs: randInt(500, 2000),
          startedAt: daysAgo(randInt(3, 12)),
          completedAt: daysAgo(randInt(1, 3)),
        },
      })
    : null;

  const queryExchange = integrations.EXCHANGE_ONLINE
    ? await prisma.copilotQuery.create({
        data: {
          tenantId,
          caseId: dsarCase.id,
          runId: run.id,
          createdByUserId: actorUserId,
          queryText: `Search Exchange mailbox for personal data of ${subjectName}`,
          queryIntent: "DATA_LOCATION",
          subjectIdentityId: identityProfileId,
          executionMode: "METADATA_ONLY",
          integrationId: integrations.EXCHANGE_ONLINE.id,
          provider: "EXCHANGE_ONLINE",
          querySpec: {
            subjectIdentifiers: { primary: { type: "email", value: subjectEmail } },
            searchTerms: { terms: [subjectName.toLowerCase()], matchType: "contains" },
            isDemoData: true,
          },
          status: "COMPLETED",
          recordsFound: evidenceCounts.exchange,
          executionMs: randInt(1000, 5000),
          startedAt: daysAgo(randInt(3, 12)),
          completedAt: daysAgo(randInt(1, 3)),
        },
      })
    : null;

  const querySP = integrations.SHAREPOINT
    ? await prisma.copilotQuery.create({
        data: {
          tenantId,
          caseId: dsarCase.id,
          runId: run.id,
          createdByUserId: actorUserId,
          queryText: `Search SharePoint sites for documents about ${subjectName}`,
          queryIntent: "DATA_LOCATION",
          subjectIdentityId: identityProfileId,
          executionMode: "METADATA_ONLY",
          integrationId: integrations.SHAREPOINT.id,
          provider: "SHAREPOINT",
          querySpec: {
            subjectIdentifiers: { primary: { type: "email", value: subjectEmail } },
            providerScope: { siteIds: ["*"] },
            isDemoData: true,
          },
          status: "COMPLETED",
          recordsFound: evidenceCounts.sharepoint,
          executionMs: randInt(2000, 8000),
          startedAt: daysAgo(randInt(3, 12)),
          completedAt: daysAgo(randInt(1, 3)),
        },
      })
    : null;

  const queryOD = integrations.ONEDRIVE
    ? await prisma.copilotQuery.create({
        data: {
          tenantId,
          caseId: dsarCase.id,
          runId: run.id,
          createdByUserId: actorUserId,
          queryText: `Search OneDrive for personal files of ${subjectName}`,
          queryIntent: "DATA_LOCATION",
          subjectIdentityId: identityProfileId,
          executionMode: "METADATA_ONLY",
          integrationId: integrations.ONEDRIVE.id,
          provider: "ONEDRIVE",
          querySpec: {
            subjectIdentifiers: { primary: { type: "email", value: subjectEmail } },
            providerScope: { userDrive: true },
            isDemoData: true,
          },
          status: "COMPLETED",
          recordsFound: evidenceCounts.onedrive,
          executionMs: randInt(800, 3000),
          startedAt: daysAgo(randInt(3, 12)),
          completedAt: daysAgo(randInt(1, 3)),
        },
      })
    : null;

  // Map providers to queries
  const queryMap: Record<string, string | null> = {
    M365: queryM365?.id ?? null,
    EXCHANGE_ONLINE: queryExchange?.id ?? null,
    SHAREPOINT: querySP?.id ?? null,
    ONEDRIVE: queryOD?.id ?? null,
  };

  // Create evidence items
  const evidenceItemIds: string[] = [];
  for (const tpl of allEvidence) {
    const integrationRef = integrations[tpl.provider];
    if (!integrationRef) continue;

    const item = await prisma.evidenceItem.create({
      data: {
        tenantId,
        caseId: dsarCase.id,
        runId: run.id,
        queryId: queryMap[tpl.provider] ?? (queryM365?.id || run.id),
        integrationId: integrationRef.id,
        provider: tpl.provider,
        workload: tpl.workload,
        itemType: tpl.itemType,
        externalRef: `demo-${tpl.provider.toLowerCase()}-${Math.random().toString(36).slice(2, 10)}`,
        location: tpl.locationTemplate,
        title: tpl.titleTemplate,
        createdAtSource: daysAgo(randInt(30, 365)),
        modifiedAtSource: daysAgo(randInt(1, 30)),
        owners: tpl.metadataGen(subjectEmail, subjectName).owner
          ? { owner: subjectEmail }
          : { createdBy: subjectEmail },
        metadata: { ...tpl.metadataGen(subjectEmail, subjectName), isDemoData: true },
        contentHandling: "METADATA_ONLY",
        sensitivityScore: randInt(tpl.sensitivityRange[0], tpl.sensitivityRange[1]),
      },
    });
    evidenceItemIds.push(item.id);
    result.evidenceItemsCreated++;

    // Detector result for each evidence item
    const detector = generateDetectors(tpl.itemType, isArt9);
    await prisma.detectorResult.create({
      data: {
        tenantId,
        caseId: dsarCase.id,
        runId: run.id,
        evidenceItemId: item.id,
        detectorType: detector.detectorType,
        detectedElements: detector.detectedElements,
        detectedCategories: detector.detectedCategories,
        containsSpecialCategorySuspected: detector.containsSpecialCategorySuspected,
      },
    });
  }

  // Create findings
  for (const fTpl of findingTemplates) {
    // Link finding to random evidence items
    const linkedIds = [];
    const sampleCount = Math.min(randInt(1, 3), evidenceItemIds.length);
    for (let i = 0; i < sampleCount; i++) {
      linkedIds.push(pick(evidenceItemIds));
    }

    await prisma.finding.create({
      data: {
        tenantId,
        caseId: dsarCase.id,
        runId: run.id,
        dataCategory: fTpl.dataCategory,
        severity: fTpl.severity,
        confidence: fTpl.confidence,
        summary: fTpl.summary,
        evidenceItemIds: Array.from(new Set(linkedIds)),
        containsSpecialCategory: fTpl.containsSpecialCategory,
        containsThirdPartyDataSuspected: fTpl.containsThirdPartyDataSuspected,
        requiresLegalReview: fTpl.requiresLegalReview,
      },
    });
    result.findingsCreated++;
  }

  // Copilot summaries
  const locationSummary = generateLocationSummary(
    subjectName,
    allEvidence.length,
    findingTemplates.length,
    providers.filter((p) => integrations[p]),
    hasSpecialCat,
  );

  const categorySummary = generateCategorySummary(subjectName, findingTemplates);

  await prisma.copilotSummary.create({
    data: {
      tenantId,
      caseId: dsarCase.id,
      runId: run.id,
      createdByUserId: actorUserId,
      summaryType: "LOCATION_OVERVIEW",
      content: locationSummary,
      evidenceSnapshotHash: `sha256:demo-${run.id.slice(0, 16)}`,
      disclaimerIncluded: true,
    },
  });

  await prisma.copilotSummary.create({
    data: {
      tenantId,
      caseId: dsarCase.id,
      runId: run.id,
      createdByUserId: actorUserId,
      summaryType: "CATEGORY_OVERVIEW",
      content: categorySummary,
      evidenceSnapshotHash: `sha256:demo-${run.id.slice(0, 16)}-cat`,
      disclaimerIncluded: true,
    },
  });

  // Evidence Index document
  await prisma.document.create({
    data: {
      tenantId,
      caseId: dsarCase.id,
      filename: `evidence-index-${dsarCase.caseNumber}.json`,
      contentType: "application/json",
      storageKey: `demo/evidence-index-${run.id}.json`,
      size: randInt(2048, 16384),
      hash: `sha256:demo-doc-${run.id.slice(0, 12)}`,
      classification: "CONFIDENTIAL",
      tags: ["copilot", "evidence-index", "demo-data"],
      uploadedByUserId: actorUserId,
    },
  });
  result.documentsCreated++;

  // Export artifact
  if (options.generateExports) {
    const legalGate = hasSpecialCat ? "BLOCKED" : "ALLOWED";
    await prisma.exportArtifact.create({
      data: {
        tenantId,
        caseId: dsarCase.id,
        runId: run.id,
        exportType: dsarCase.type === "PORTABILITY" ? "CSV" : "JSON",
        status: legalGate === "BLOCKED" ? "PENDING" : "COMPLETED",
        legalGateStatus: legalGate,
        createdByUserId: actorUserId,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action: legalGate === "BLOCKED" ? "EXPORT_BLOCKED" : "EXPORT_GENERATED",
        entityType: "ExportArtifact",
        entityId: dsarCase.id,
        details: {
          caseNumber: dsarCase.caseNumber,
          legalGateStatus: legalGate,
          reason: legalGate === "BLOCKED" ? "Art. 9 special category data — legal approval required" : "Export generated successfully",
          isDemoData: true,
        },
      },
    });
    result.auditLogsCreated++;
  }

  // Audit logs for this case
  await prisma.auditLog.createMany({
    data: [
      {
        tenantId,
        actorUserId,
        action: "COPILOT_RUN_CREATED",
        entityType: "CopilotRun",
        entityId: run.id,
        details: { caseNumber: dsarCase.caseNumber, caseId: dsarCase.id, isDemoData: true },
      },
      {
        tenantId,
        actorUserId,
        action: "COPILOT_RUN_COMPLETED",
        entityType: "CopilotRun",
        entityId: run.id,
        details: {
          caseNumber: dsarCase.caseNumber,
          evidenceItems: allEvidence.length,
          findings: findingTemplates.length,
          specialCategory: hasSpecialCat,
          isDemoData: true,
        },
      },
      {
        tenantId,
        actorUserId,
        action: "FINDINGS_GENERATED",
        entityType: "DSARCase",
        entityId: dsarCase.id,
        details: {
          caseNumber: dsarCase.caseNumber,
          findingCount: findingTemplates.length,
          categories: Array.from(new Set(findingTemplates.map((f) => f.dataCategory))),
          isDemoData: true,
        },
      },
    ],
  });
  result.auditLogsCreated += 3;

  // Optional: create a failed second run to test error paths
  if (options.generateCopilotRuns && Math.random() > 0.6) {
    await prisma.copilotRun.create({
      data: {
        tenantId,
        caseId: dsarCase.id,
        createdByUserId: actorUserId,
        status: "FAILED",
        justification: `DSAR fulfillment — retry attempt (demo data)`,
        scopeSummary: "EXCHANGE_ONLINE",
        providerSelection: integrations.EXCHANGE_ONLINE
          ? [{ integrationId: integrations.EXCHANGE_ONLINE.id, provider: "EXCHANGE_ONLINE", workload: "mailbox_search" }]
          : [],
        errorDetails: "Simulated failure: Connection timeout to Exchange Online after 30s. Rate limit exceeded for tenant.",
        containsSpecialCategory: false,
        legalApprovalStatus: "NOT_REQUIRED",
        totalFindings: 0,
        totalEvidenceItems: 0,
        startedAt: daysAgo(randInt(1, 5)),
        metadata: { isDemoData: true },
      },
    });
    result.copilotRunsCreated++;
  }
}
