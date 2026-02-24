/**
 * seed_large_findings.ts — Seed a large number of Copilot Findings + DetectorResults
 * WITHOUT resetting the database.
 *
 * Usage:
 *   npx tsx scripts/seed_large_findings.ts
 *   FINDINGS_COUNT=2000 npx tsx scripts/seed_large_findings.ts
 *
 * Environment:
 *   DATABASE_URL       — Required (or POSTGRES_PRISMA_URL as fallback)
 *   FINDINGS_COUNT     — Number of findings to create (default: 800)
 *
 * The script:
 *   1. Connects to the DB via PrismaClient
 *   2. Finds the "Acme Corp" tenant and the newest DSAR case
 *   3. Reuses (or creates) a CopilotRun + EvidenceItems to satisfy FK constraints
 *   4. Creates FINDINGS_COUNT Findings in batches of 200
 *   5. Creates 1-3 DetectorResults per Finding in batches of 200
 *   6. Logs final counts
 */

import {
  PrismaClient,
  DataCategory,
  FindingSeverity,
  FindingStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";

// ── Env ──────────────────────────────────────────────────────────────────────
if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}
if (!process.env.DATABASE_URL) {
  console.error("[seed-findings] ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

const FINDINGS_COUNT = parseInt(process.env.FINDINGS_COUNT || "800", 10);
const BATCH_SIZE = 200;

const prisma = new PrismaClient();

// ── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const DATA_CATEGORIES = Object.values(DataCategory);
const SEVERITIES = Object.values(FindingSeverity);
const STATUSES = Object.values(FindingStatus);

const PII_CATEGORIES = [
  "EMAIL",
  "PHONE",
  "IBAN",
  "SSN",
  "PASSPORT",
  "DOB",
  "NAME",
  "ADDRESS",
  "CREDIT_CARD",
  "IP_ADDRESS",
];

const DETECTOR_TYPES = [
  "REGEX",
  "PDF_METADATA",
  "OCR",
  "IMAGE_MODEL",
  "LLM_CLASSIFIER",
];

const SYSTEM_NAMES = [
  "HR System",
  "CRM",
  "ERP",
  "SharePoint",
  "Exchange Online",
  "Salesforce",
  "SAP",
  "Workday",
  "Slack",
  "Jira",
];

const LOCATIONS = [
  "Mailbox:user@acme.com/Inbox",
  "SharePoint > Finance > payroll.xlsx",
  "SharePoint > HR > contracts/",
  "OneDrive > Documents > reports/",
  "CRM > Contacts > export.csv",
  "ERP > Employees > records.json",
  "Slack > #general > messages",
  "Jira > PROJ-123 > attachments",
];

function makeSummary(cat: DataCategory, pii: string): string {
  return `Detected ${pii} data in ${cat.toLowerCase().replace(/_/g, " ")} category — review recommended.`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[seed-findings] Starting — target: ${FINDINGS_COUNT} findings`);

  // 1. Find the default tenant ("Acme Corp"), fallback to first tenant
  let tenant = await prisma.tenant.findFirst({
    where: { name: "Acme Corp" },
  });
  if (!tenant) {
    console.warn(
      '[seed-findings] WARN: Tenant "Acme Corp" not found — falling back to first tenant.'
    );
    tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  }
  if (!tenant) {
    console.error(
      "[seed-findings] ERROR: No tenant found at all. Run the main seed first."
    );
    process.exit(1);
  }
  console.log(`[seed-findings] Tenant: ${tenant.name} (${tenant.id})`);

  // 2. Find the newest DSAR case for this tenant, fallback to first case
  let dsarCase = await prisma.dSARCase.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });
  if (!dsarCase) {
    console.warn(
      "[seed-findings] WARN: No case for selected tenant — falling back to first case."
    );
    dsarCase = await prisma.dSARCase.findFirst({ orderBy: { createdAt: "asc" } });
  }
  if (!dsarCase) {
    console.error(
      "[seed-findings] ERROR: No DSAR case found at all. Run the main seed first."
    );
    process.exit(1);
  }
  console.log(
    `[seed-findings] Case: ${dsarCase.caseNumber} (${dsarCase.id})`
  );

  // 3. Find any admin user for the tenant (needed for CopilotRun.createdByUserId)
  const adminUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "asc" },
  });
  if (!adminUser) {
    console.error(
      "[seed-findings] ERROR: No user found for tenant. Run the main seed first."
    );
    process.exit(1);
  }

  // 4. Find existing systems for the tenant (optional, for systemId on findings)
  const systems = await prisma.system.findMany({
    where: { tenantId: tenant.id },
    select: { id: true },
  });
  const systemIds = systems.map((s: { id: string }) => s.id);

  // 5. Find existing data assets (optional, for dataAssetId on findings)
  const dataAssets = await prisma.dataAsset.findMany({
    where: { tenantId: tenant.id },
    select: { id: true },
  });
  const dataAssetIds = dataAssets.map((a: { id: string }) => a.id);

  // 6. Reuse or create a CopilotRun
  let copilotRun = await prisma.copilotRun.findFirst({
    where: { tenantId: tenant.id, caseId: dsarCase.id },
    orderBy: { createdAt: "desc" },
  });
  if (!copilotRun) {
    copilotRun = await prisma.copilotRun.create({
      data: {
        tenantId: tenant.id,
        caseId: dsarCase.id,
        createdByUserId: adminUser.id,
        status: "COMPLETED",
        justification:
          "Bulk-seed run for findings heatmap testing",
        scopeSummary: "All integrated systems",
      },
    });
    console.log(`[seed-findings] Created CopilotRun: ${copilotRun.id}`);
  } else {
    console.log(`[seed-findings] Reusing CopilotRun: ${copilotRun.id}`);
  }

  // 7. Create a pool of EvidenceItems (DetectorResult needs evidenceItemId)
  //    We'll create one per batch-group so there's variety but not 1:1
  const EVIDENCE_POOL_SIZE = Math.min(50, FINDINGS_COUNT);
  const evidencePool: string[] = [];

  const existingEvidence = await prisma.evidenceItem.findMany({
    where: { tenantId: tenant.id, runId: copilotRun.id },
    select: { id: true },
    take: EVIDENCE_POOL_SIZE,
  });
  evidencePool.push(...existingEvidence.map((e: { id: string }) => e.id));

  if (evidencePool.length < EVIDENCE_POOL_SIZE) {
    const needed = EVIDENCE_POOL_SIZE - evidencePool.length;
    const evidenceData = Array.from({ length: needed }, () => ({
      id: randomUUID(),
      tenantId: tenant.id,
      caseId: dsarCase.id,
      runId: copilotRun.id,
      provider: "M365",
      workload: pick(["EXCHANGE", "SHAREPOINT", "ONEDRIVE"]),
      itemType: pick(["EMAIL", "FILE", "RECORD"] as const),
      location: pick(LOCATIONS),
      title: `Evidence-${randomUUID().slice(0, 8)}`,
      contentHandling: "METADATA_ONLY" as const,
    }));

    await prisma.evidenceItem.createMany({ data: evidenceData });
    evidencePool.push(...evidenceData.map((e) => e.id));
    console.log(`[seed-findings] Created ${needed} EvidenceItems`);
  }

  // 8. Create Findings in batches
  console.log(
    `[seed-findings] Creating ${FINDINGS_COUNT} findings in batches of ${BATCH_SIZE}...`
  );
  const allFindingIds: string[] = [];
  const findingEvidenceMap: Map<string, string[]> = new Map();

  for (let offset = 0; offset < FINDINGS_COUNT; offset += BATCH_SIZE) {
    const batchCount = Math.min(BATCH_SIZE, FINDINGS_COUNT - offset);
    const batch = Array.from({ length: batchCount }, () => {
      const id = randomUUID();
      const cat = pick(DATA_CATEGORIES);
      const sev = pick(SEVERITIES);
      const pii = pick(PII_CATEGORIES);
      const evidenceIds = [pick(evidencePool)];

      allFindingIds.push(id);
      findingEvidenceMap.set(id, evidenceIds);

      const isSpecial = (
        ["HEALTH", "RELIGION", "UNION", "POLITICAL_OPINION", "OTHER_SPECIAL_CATEGORY"] as string[]
      ).includes(cat as string);

      return {
        id,
        tenantId: tenant.id,
        caseId: dsarCase.id,
        runId: copilotRun.id,
        dataCategory: cat,
        severity: sev,
        confidence: Math.round(Math.random() * 100) / 100,
        summary: makeSummary(cat, pii),
        evidenceItemIds: evidenceIds,
        containsSpecialCategory: isSpecial,
        containsThirdPartyDataSuspected: Math.random() < 0.15,
        requiresLegalReview: isSpecial || sev === "CRITICAL",
        systemId: systemIds.length > 0 ? pick(systemIds) : null,
        riskScore: randInt(0, 100),
        status: pick(STATUSES),
        dataAssetLocation: pick(LOCATIONS),
        sampleRedacted: `[REDACTED] Sample ${pii} data snippet for review`,
        sensitivityScore: randInt(0, 100),
        piiCategory: pii,
        piiCount: randInt(1, 50),
        snippetPreview: `...${pii.toLowerCase()} value detected in document...`,
        dataAssetId:
          dataAssetIds.length > 0 ? pick(dataAssetIds) : null,
      };
    });

    await prisma.finding.createMany({ data: batch });
    console.log(
      `[seed-findings]   ... created findings ${offset + 1}–${offset + batchCount}`
    );
  }

  // 9. Create DetectorResults (1-3 per Finding) in batches
  console.log("[seed-findings] Creating DetectorResults (1-3 per finding)...");
  let detectorBatch: Array<{
    id: string;
    tenantId: string;
    caseId: string;
    runId: string;
    evidenceItemId: string;
    detectorType: string;
    detectedElements: { elementType: string; confidence: number; snippetPreview: string }[];
    detectedCategories: { category: string; confidence: number }[];
    containsSpecialCategorySuspected: boolean;
  }> = [];
  let totalDetectorResults = 0;

  for (const findingId of allFindingIds) {
    const count = randInt(1, 3);
    const evidenceIds = findingEvidenceMap.get(findingId) || [
      pick(evidencePool),
    ];

    for (let i = 0; i < count; i++) {
      const cat = pick(DATA_CATEGORIES);
      const confidence = Math.round(Math.random() * 100) / 100;

      detectorBatch.push({
        id: randomUUID(),
        tenantId: tenant.id,
        caseId: dsarCase.id,
        runId: copilotRun.id,
        evidenceItemId: pick(evidenceIds.length > 0 ? evidenceIds : evidencePool),
        detectorType: pick(DETECTOR_TYPES),
        detectedElements: [
          {
            elementType: pick(PII_CATEGORIES),
            confidence,
            snippetPreview: `[redacted ${pick(PII_CATEGORIES).toLowerCase()}]`,
          },
        ],
        detectedCategories: [{ category: cat, confidence }],
        containsSpecialCategorySuspected: (
          ["HEALTH", "RELIGION", "UNION", "POLITICAL_OPINION", "OTHER_SPECIAL_CATEGORY"] as string[]
        ).includes(cat as string),
      });

      totalDetectorResults++;

      if (detectorBatch.length >= BATCH_SIZE) {
        await prisma.detectorResult.createMany({ data: detectorBatch });
        console.log(
          `[seed-findings]   ... flushed ${detectorBatch.length} detector results (total: ${totalDetectorResults})`
        );
        detectorBatch = [];
      }
    }
  }

  // Flush remaining
  if (detectorBatch.length > 0) {
    await prisma.detectorResult.createMany({ data: detectorBatch });
    console.log(
      `[seed-findings]   ... flushed ${detectorBatch.length} detector results (total: ${totalDetectorResults})`
    );
  }

  // 10. Log final counts
  const findingCount = await prisma.finding.count({
    where: { tenantId: tenant.id },
  });
  const detectorResultCount = await prisma.detectorResult.count({
    where: { tenantId: tenant.id },
  });

  console.log("\n[seed-findings] === Done ===");
  console.log(`[seed-findings] Findings total (tenant):        ${findingCount}`);
  console.log(`[seed-findings] DetectorResults total (tenant): ${detectorResultCount}`);
}

main()
  .catch((err) => {
    console.error("[seed-findings] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
