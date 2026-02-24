/**
 * seed_large_findings.ts — Seed a large number of Copilot Findings + DetectorResults
 * WITHOUT resetting the database.
 *
 * Usage:
 *   npx tsx scripts/seed_large_findings.ts
 *   FINDINGS_COUNT=2000 npx tsx scripts/seed_large_findings.ts
 *   TENANT_ID=xxx CASE_ID=yyy RUN_ID=zzz npx tsx scripts/seed_large_findings.ts
 *   TEST_EMAIL=user@example.com npx tsx scripts/seed_large_findings.ts
 *
 * Environment:
 *   DATABASE_URL       — Required (or POSTGRES_PRISMA_URL as fallback)
 *   FINDINGS_COUNT     — Number of findings to create (default: 800)
 *   TENANT_ID          — Use this tenant (by ID). Takes highest priority.
 *   TENANT_NAME        — Use this tenant (by name). Second priority.
 *   TEST_EMAIL         — Find tenant via this user's email (default: daniel.schormann@gmail.com)
 *   CASE_ID            — Use this specific case (must belong to tenant). If unset: newest case for tenant, then first case.
 *   RUN_ID             — Use this specific CopilotRun (must belong to tenant). If unset: newest run for case, or create one.
 *
 * Tenant resolution order:
 *   1. TENANT_ID env var (exact match by ID)
 *   2. TENANT_NAME env var (exact match by name)
 *   3. TEST_EMAIL env var → look up user → use their tenantId
 *   4. Fallback: "Acme Corp" tenant → first tenant in DB
 *
 * When TENANT_ID, CASE_ID, or RUN_ID are provided, the script validates that
 * they exist and that CASE_ID/RUN_ID belong to the resolved tenant. If validation
 * fails, the script throws with a clear error message.
 *
 * The script:
 *   1. Connects to the DB via PrismaClient
 *   2. Resolves Prisma delegate names (handles naming variations across client versions)
 *   3. Resolves tenant (see priority above) and DSAR case
 *   4. Reuses (or creates) a CopilotRun + EvidenceItems to satisfy FK constraints
 *   5. Creates FINDINGS_COUNT Findings in batches of 200
 *   6. Creates 1-3 DetectorResults per Finding in batches of 200 (if delegate available)
 *   7. Logs final counts
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

// Import enums safely — they may not exist in every generated client version
let _DataCategory: Record<string, string> | undefined;
let _FindingSeverity: Record<string, string> | undefined;
let _FindingStatus: Record<string, string> | undefined;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const client = require("@prisma/client");
  _DataCategory = client.DataCategory;
  _FindingSeverity = client.FindingSeverity;
  _FindingStatus = client.FindingStatus;
} catch {
  // Prisma client not generated or enums missing — use fallbacks below
}

type DataCategory = string;
type FindingSeverity = string;
type FindingStatus = string;

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

const ENV_TENANT_ID = process.env.TENANT_ID || undefined;
const ENV_TENANT_NAME = process.env.TENANT_NAME || undefined;
const ENV_TEST_EMAIL = process.env.TEST_EMAIL || "daniel.schormann@gmail.com";
const ENV_CASE_ID = process.env.CASE_ID || undefined;
const ENV_RUN_ID = process.env.RUN_ID || undefined;

const prisma = new PrismaClient();

// ── ID Validation Helper ────────────────────────────────────────────────────

/**
 * Validate that explicitly provided IDs (TENANT_ID, CASE_ID, RUN_ID) exist in
 * the database. For CASE_ID and RUN_ID, also verify they belong to the resolved
 * tenant. Throws with a clear message if any validation fails.
 *
 * Call this AFTER tenant resolution so we have the tenantId to check ownership.
 */
async function validateProvidedIds(resolvedTenantId: string): Promise<void> {
  // TENANT_ID: already validated during tenant resolution (if it didn't match,
  // tenant resolution would have fallen through). But we do a hard check here
  // if the env var was set — the tenant we resolved MUST match it.
  if (ENV_TENANT_ID && resolvedTenantId !== ENV_TENANT_ID) {
    throw new Error(
      `[seed-findings] TENANT_ID="${ENV_TENANT_ID}" was provided but the resolved tenant ` +
      `has id="${resolvedTenantId}". This should not happen — please check your TENANT_ID value.`
    );
  }

  // CASE_ID: must exist and belong to the resolved tenant
  if (ENV_CASE_ID) {
    const caseRow = await prisma.dSARCase.findUnique({
      where: { id: ENV_CASE_ID },
      select: { id: true, tenantId: true },
    });
    if (!caseRow) {
      throw new Error(
        `[seed-findings] CASE_ID="${ENV_CASE_ID}" does not exist in the database. ` +
        `Please provide a valid case ID.`
      );
    }
    if (caseRow.tenantId !== resolvedTenantId) {
      throw new Error(
        `[seed-findings] CASE_ID="${ENV_CASE_ID}" exists but belongs to tenant ` +
        `"${caseRow.tenantId}", not the resolved tenant "${resolvedTenantId}". ` +
        `The case must belong to the selected tenant.`
      );
    }
  }

  // RUN_ID: must exist and belong to the resolved tenant
  if (ENV_RUN_ID && copilotRunDelegate) {
    let runRow: { id: string; tenantId: string } | null = null;
    try {
      runRow = await copilotRunDelegate.findUnique({
        where: { id: ENV_RUN_ID },
        select: { id: true, tenantId: true },
      });
    } catch {
      // findUnique may not be available; try findFirst
      const rows = await copilotRunDelegate.findFirst({
        where: { id: ENV_RUN_ID },
        select: { id: true, tenantId: true },
      });
      runRow = rows;
    }
    if (!runRow) {
      throw new Error(
        `[seed-findings] RUN_ID="${ENV_RUN_ID}" does not exist in the database. ` +
        `Please provide a valid CopilotRun ID.`
      );
    }
    if (runRow.tenantId !== resolvedTenantId) {
      throw new Error(
        `[seed-findings] RUN_ID="${ENV_RUN_ID}" exists but belongs to tenant ` +
        `"${runRow.tenantId}", not the resolved tenant "${resolvedTenantId}". ` +
        `The run must belong to the selected tenant.`
      );
    }
  } else if (ENV_RUN_ID && !copilotRunDelegate) {
    console.warn(
      `[seed-findings] WARN: RUN_ID="${ENV_RUN_ID}" was provided but copilotRun delegate ` +
      `is not available — cannot validate. Will attempt to use it anyway.`
    );
  }
}

// ── Delegate Resolution ─────────────────────────────────────────────────────

/**
 * Resolve a Prisma delegate by trying multiple candidate names.
 * Returns the delegate (the model accessor on the PrismaClient) or null if none found.
 */
function getDelegate(nameCandidates: string[]): any | null {
  for (const n of nameCandidates) {
    if ((prisma as any)[n]) return (prisma as any)[n];
  }
  return null;
}

// Resolve all delegates with candidate lists to handle naming variations
const findingDelegate = getDelegate(["finding", "Finding"]);
const detectorDelegate = getDelegate([
  "detectorResult",
  "DetectorResult",
  "findingDetectorResult",
  "DetectorResults",
]);
const copilotRunDelegate = getDelegate([
  "copilotRun",
  "CopilotRun",
  "aICopilotRun",
  "copilot_run",
]);
const evidenceDelegate = getDelegate([
  "evidenceItem",
  "EvidenceItem",
  "copilotEvidenceItem",
  "evidence",
]);
const systemDelegate = getDelegate(["system", "System"]);
// NOTE: dataAsset is intentionally NOT queried — some schemas lack this model.

function printDelegateResolution() {
  const delegates = [
    { name: "finding", resolved: findingDelegate },
    { name: "detectorResult", resolved: detectorDelegate },
    { name: "copilotRun", resolved: copilotRunDelegate },
    { name: "evidenceItem", resolved: evidenceDelegate },
    { name: "system", resolved: systemDelegate },
    // dataAsset intentionally omitted — not all schemas include it
  ];

  console.log("[seed-findings] Delegate resolution:");
  for (const d of delegates) {
    const status = d.resolved ? "OK" : "NOT FOUND (will skip)";
    console.log(`[seed-findings]   ${d.name.padEnd(20)} → ${status}`);
  }
}

// ── DMMF-based Payload Sanitizer ────────────────────────────────────────────

/**
 * Build a Set of allowed scalar/enum field names for a model from Prisma DMMF.
 * Excludes relation fields (kind === 'object') which are not valid in createMany.
 * Returns null if the model is not found in DMMF.
 */
function buildAllowedFields(modelName: string): Set<string> | null {
  try {
    const model = Prisma.dmmf.datamodel.models.find(
      (m) => m.name === modelName
    );
    if (!model) return null;
    return new Set(
      model.fields
        .filter((f) => f.kind !== "object")
        .map((f) => f.name)
    );
  } catch {
    return null;
  }
}

const allowedFindingFields = buildAllowedFields("Finding");
const allowedDetectorFields = buildAllowedFields("DetectorResult");

/**
 * Remove keys from a row that are not in the allowedFields set.
 * If allowedFields is null (DMMF unavailable), returns the row unchanged.
 */
function sanitizeRow(
  row: Record<string, any>,
  allowedFields: Set<string> | null
): Record<string, any> {
  if (!allowedFields) return row;
  const clean: Record<string, any> = {};
  for (const key of Object.keys(row)) {
    if (allowedFields.has(key)) {
      clean[key] = row[key];
    }
  }
  return clean;
}

/**
 * Strip any keys from a Finding row that are not in the DMMF-derived allow-list.
 * If the allow-list could not be built (DMMF unavailable), returns the row unchanged.
 */
function stripUnknownFindingFields<T extends Record<string, any>>(row: T): Partial<T> {
  return sanitizeRow(row, allowedFindingFields) as Partial<T>;
}

function printAllowedFields(modelName: string, fields: Set<string> | null) {
  if (fields) {
    console.log(
      `[seed-findings] ${modelName} allowed fields (${fields.size}): ${[...fields].join(", ")}`
    );
  } else {
    console.log(
      `[seed-findings] ${modelName}: DMMF lookup failed — no field filtering (payloads sent as-is)`
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const DATA_CATEGORIES: string[] = _DataCategory
  ? Object.values(_DataCategory)
  : [
      "IDENTIFICATION", "CONTACT", "CONTRACT", "FINANCIAL", "BEHAVIORAL",
      "TECHNICAL", "LOCATION", "COMMUNICATION", "HEALTH", "RELIGION",
      "UNION", "POLITICAL_OPINION", "OTHER_SPECIAL_CATEGORY",
    ];

const SEVERITIES: string[] = _FindingSeverity
  ? Object.values(_FindingSeverity)
  : ["INFO", "WARNING", "CRITICAL"];

const STATUSES: string[] = _FindingStatus
  ? Object.values(_FindingStatus)
  : ["OPEN", "ACCEPTED", "MITIGATING", "MITIGATED"];

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

function makeSummary(cat: string, pii: string): string {
  return `Detected ${pii} data in ${cat.toLowerCase().replace(/_/g, " ")} category — review recommended.`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[seed-findings] Starting — target: ${FINDINGS_COUNT} findings`);
  console.log(`[seed-findings] Config: TENANT_ID=${ENV_TENANT_ID ?? "(unset)"}, TENANT_NAME=${ENV_TENANT_NAME ?? "(unset)"}, TEST_EMAIL=${ENV_TEST_EMAIL}, CASE_ID=${ENV_CASE_ID ?? "(unset)"}, RUN_ID=${ENV_RUN_ID ?? "(unset)"}`);

  // Print resolved delegate names and allowed fields at start
  printDelegateResolution();
  printAllowedFields("Finding", allowedFindingFields);
  printAllowedFields("DetectorResult", allowedDetectorFields);

  // Validate that the finding delegate exists — it's required
  if (!findingDelegate) {
    console.error(
      "[seed-findings] ERROR: Could not resolve 'finding' delegate on PrismaClient. " +
      "Tried candidates: finding, Finding. Cannot proceed."
    );
    process.exit(1);
  }

  // 1. Resolve tenant — priority: TENANT_ID > TENANT_NAME > TEST_EMAIL user lookup > "Acme Corp" > first tenant
  let tenant: Awaited<ReturnType<typeof prisma.tenant.findFirst>> = null;
  let tenantSource = "";

  if (ENV_TENANT_ID) {
    tenant = await prisma.tenant.findUnique({ where: { id: ENV_TENANT_ID } });
    if (tenant) {
      tenantSource = "TENANT_ID env";
    } else {
      console.warn(`[seed-findings] WARN: TENANT_ID="${ENV_TENANT_ID}" not found — trying next strategy.`);
    }
  }

  if (!tenant && ENV_TENANT_NAME) {
    tenant = await prisma.tenant.findFirst({ where: { name: ENV_TENANT_NAME } });
    if (tenant) {
      tenantSource = "TENANT_NAME env";
    } else {
      console.warn(`[seed-findings] WARN: TENANT_NAME="${ENV_TENANT_NAME}" not found — trying next strategy.`);
    }
  }

  if (!tenant) {
    // Look up user by TEST_EMAIL to derive tenantId
    const testUser = await prisma.user.findFirst({ where: { email: ENV_TEST_EMAIL } });
    if (testUser?.tenantId) {
      tenant = await prisma.tenant.findUnique({ where: { id: testUser.tenantId } });
      if (tenant) {
        tenantSource = `TEST_EMAIL (${ENV_TEST_EMAIL})`;
      }
    }
    if (!tenant) {
      console.warn(`[seed-findings] WARN: No tenant found via TEST_EMAIL="${ENV_TEST_EMAIL}" — falling back to "Acme Corp".`);
    }
  }

  if (!tenant) {
    tenant = await prisma.tenant.findFirst({ where: { name: "Acme Corp" } });
    if (tenant) {
      tenantSource = 'fallback ("Acme Corp")';
    }
  }

  if (!tenant) {
    tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
    if (tenant) {
      tenantSource = "fallback (first tenant)";
    }
  }

  if (!tenant) {
    console.error("[seed-findings] ERROR: No tenant found at all. Run the main seed first.");
    process.exit(1);
  }

  console.log(`[seed-findings] Tenant: ${tenant.name} (${tenant.id}) — resolved via ${tenantSource}`);

  // Validate all explicitly provided IDs before proceeding
  await validateProvidedIds(tenant.id);

  // 2. Resolve DSAR case — priority: CASE_ID > newest case for tenant > first case in DB
  let dsarCase: Awaited<ReturnType<typeof prisma.dSARCase.findFirst>> = null;
  let caseSource = "";

  if (ENV_CASE_ID) {
    // validateProvidedIds already confirmed this exists and belongs to tenant
    dsarCase = await prisma.dSARCase.findUnique({ where: { id: ENV_CASE_ID } });
    caseSource = "CASE_ID env";
  }

  if (!dsarCase) {
    dsarCase = await prisma.dSARCase.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
    });
    if (dsarCase) {
      caseSource = "newest case for tenant";
    }
  }

  if (!dsarCase) {
    console.warn("[seed-findings] WARN: No case for selected tenant — falling back to first case.");
    dsarCase = await prisma.dSARCase.findFirst({ orderBy: { createdAt: "asc" } });
    if (dsarCase) {
      caseSource = "fallback (first case)";
    }
  }

  if (!dsarCase) {
    console.error("[seed-findings] ERROR: No DSAR case found at all. Run the main seed first.");
    process.exit(1);
  }

  console.log(`[seed-findings] Case: ${dsarCase.caseNumber} (${dsarCase.id}) — resolved via ${caseSource}`);

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
  let systemIds: string[] = [];
  if (systemDelegate) {
    try {
      const systems = await systemDelegate.findMany({
        where: { tenantId: tenant.id },
        select: { id: true },
      });
      systemIds = systems.map((s: { id: string }) => s.id);
    } catch (err) {
      console.warn("[seed-findings] WARN: Failed to query systems — skipping systemId population.", err);
    }
  } else {
    console.warn("[seed-findings] WARN: system delegate not found — skipping systemId population.");
  }

  // 5. Resolve CopilotRun — priority: RUN_ID env > existing run for case > create new
  //    (Step 6 — dataAsset query — intentionally removed; not all schemas include DataAsset)
  let copilotRunId: string | null = null;
  let runSource = "";

  // 5a. If RUN_ID is explicitly provided, use it (already validated by validateProvidedIds)
  if (ENV_RUN_ID) {
    copilotRunId = ENV_RUN_ID;
    runSource = "RUN_ID env";
  }

  // 5b. Otherwise, find or create via delegate
  if (!copilotRunId && copilotRunDelegate) {
    try {
      let copilotRun = await copilotRunDelegate.findFirst({
        where: { tenantId: tenant.id, caseId: dsarCase.id },
        orderBy: { createdAt: "desc" },
      });
      if (!copilotRun) {
        copilotRun = await copilotRunDelegate.create({
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
        runSource = "created new";
      } else {
        runSource = "newest run for case";
      }
      copilotRunId = copilotRun.id;
    } catch (err) {
      console.warn("[seed-findings] WARN: Failed to find/create CopilotRun via delegate.", err);
    }
  } else if (!copilotRunId) {
    console.warn("[seed-findings] WARN: copilotRun delegate not found — will attempt raw query fallback.");
  }

  // 5c. Fallback: try to find an existing copilot run via raw SQL if delegate failed
  if (!copilotRunId) {
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM copilot_runs WHERE "tenantId" = $1 AND "caseId" = $2 ORDER BY "createdAt" DESC LIMIT 1`,
        tenant.id,
        dsarCase.id
      );
      if (rows.length > 0) {
        copilotRunId = rows[0].id;
        runSource = "raw query fallback";
      }
    } catch {
      // raw query also failed — fall through
    }
  }

  if (!copilotRunId) {
    console.error(
      "[seed-findings] ERROR: Could not find or create a CopilotRun. " +
      "Findings require a runId FK. Run the main seed first or ensure copilotRun delegate is available."
    );
    process.exit(1);
  }

  console.log(`[seed-findings] CopilotRun: ${copilotRunId} — resolved via ${runSource}`);

  // Summary of resolved IDs for reproducibility
  console.log(`[seed-findings] ── Selection Summary ──`);
  console.log(`[seed-findings]   Tenant:     ${tenant.name} (${tenant.id})`);
  console.log(`[seed-findings]   Case:       ${dsarCase.caseNumber} (${dsarCase.id})`);
  console.log(`[seed-findings]   CopilotRun: ${copilotRunId}`);
  console.log(`[seed-findings] ──────────────────────`);

  // 7. Create a pool of EvidenceItems (DetectorResult needs evidenceItemId)
  //    We'll create one per batch-group so there's variety but not 1:1
  const EVIDENCE_POOL_SIZE = Math.min(50, FINDINGS_COUNT);
  const evidencePool: string[] = [];

  if (evidenceDelegate) {
    try {
      const existingEvidence = await evidenceDelegate.findMany({
        where: { tenantId: tenant.id, runId: copilotRunId },
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
          runId: copilotRunId,
          provider: "M365",
          workload: pick(["EXCHANGE", "SHAREPOINT", "ONEDRIVE"]),
          itemType: pick(["EMAIL", "FILE", "RECORD"] as const),
          location: pick(LOCATIONS),
          title: `Evidence-${randomUUID().slice(0, 8)}`,
          contentHandling: "METADATA_ONLY" as const,
        }));

        await evidenceDelegate.createMany({ data: evidenceData });
        evidencePool.push(...evidenceData.map((e: { id: string }) => e.id));
        console.log(`[seed-findings] Created ${needed} EvidenceItems`);
      }
    } catch (err) {
      console.warn("[seed-findings] WARN: Failed to query/create EvidenceItems.", err);
    }
  } else {
    console.warn(
      "[seed-findings] WARN: evidenceItem delegate not found — " +
      "creating findings without evidence links and skipping DetectorResults."
    );
  }

  // 8. Create Findings in batches
  console.log(
    `[seed-findings] Creating ${FINDINGS_COUNT} findings in batches of ${BATCH_SIZE}...`
  );
  let _strippedFindingKeysLogged = false;
  const allFindingIds: string[] = [];
  const findingEvidenceMap: Map<string, string[]> = new Map();

  for (let offset = 0; offset < FINDINGS_COUNT; offset += BATCH_SIZE) {
    const batchCount = Math.min(BATCH_SIZE, FINDINGS_COUNT - offset);
    const batch = Array.from({ length: batchCount }, () => {
      const id = randomUUID();
      const cat = pick(DATA_CATEGORIES);
      const sev = pick(SEVERITIES);
      const pii = pick(PII_CATEGORIES);
      const evidenceIds = evidencePool.length > 0 ? [pick(evidencePool)] : [];

      allFindingIds.push(id);
      findingEvidenceMap.set(id, evidenceIds);

      const isSpecial = (
        ["HEALTH", "RELIGION", "UNION", "POLITICAL_OPINION", "OTHER_SPECIAL_CATEGORY"] as string[]
      ).includes(cat as string);

      const row: Record<string, any> = {
        id,
        tenantId: tenant.id,
        caseId: dsarCase.id,
        runId: copilotRunId,
        ...(systemIds.length > 0 ? { systemId: pick(systemIds) } : {}),
        dataCategory: cat,
        severity: sev,
        confidence: Math.round(Math.random() * 100) / 100,
        summary: makeSummary(cat, pii),
        evidenceItemIds: evidenceIds,
        containsSpecialCategory: isSpecial,
        containsThirdPartyDataSuspected: Math.random() < 0.15,
        requiresLegalReview: isSpecial || sev === "CRITICAL",riskScore: randInt(0, 100),
        status: pick(STATUSES),
        dataAssetLocation: pick(LOCATIONS),
        sampleRedacted: `[REDACTED] Sample ${pii} data snippet for review`,
        sensitivityScore: randInt(0, 100),
        piiCategory: pii,
        piiCount: randInt(1, 50),
        snippetPreview: `...${pii.toLowerCase()} value detected in document...`,
        // dataAssetId intentionally omitted — not all schemas include the DataAsset model
        // --- optional PII fields (will be stripped if schema doesn't support them) ---
        piiCategory: pii,
        piiCount: randInt(1, 50),
        snippetPreview: `...${pii.toLowerCase()} value detected in document...`,
        sampleRedacted: `[REDACTED] Sample ${pii} data snippet for review`,
        dataAssetLocation: pick(LOCATIONS),
        sensitivityScore: randInt(0, 100),
      };

      const sanitized = stripUnknownFindingFields(row);

      // Log stripped keys once for visibility
      if (!_strippedFindingKeysLogged && allowedFindingFields) {
        const stripped = Object.keys(row).filter(
          (k) => !allowedFindingFields.has(k)
        );
        if (stripped.length > 0) {
          console.log(
            `[seed-findings] NOTE: Stripped unknown Finding fields: ${stripped.join(", ")}`
          );
        }
        _strippedFindingKeysLogged = true;
      }

      return sanitized;
    });

    await findingDelegate.createMany({ data: batch as any });
    console.log(
      `[seed-findings]   ... created findings ${offset + 1}–${offset + batchCount}`
    );
  }

  // 9. Create DetectorResults (1-3 per Finding) in batches — skip if delegate or evidence pool missing
  if (detectorDelegate && evidencePool.length > 0) {
    console.log("[seed-findings] Creating DetectorResults (1-3 per finding)...");
    let detectorBatch: Record<string, any>[] = [];
    let totalDetectorResults = 0;

    for (const findingId of allFindingIds) {
      const count = randInt(1, 3);
      const evidenceIds = findingEvidenceMap.get(findingId) || [
        pick(evidencePool),
      ];

      for (let i = 0; i < count; i++) {
        const cat = pick(DATA_CATEGORIES);
        const confidence = Math.round(Math.random() * 100) / 100;

        const row: Record<string, any> = {
          id: randomUUID(),
          tenantId: tenant.id,
          caseId: dsarCase.id,
          runId: copilotRunId!,
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
        };

        detectorBatch.push(sanitizeRow(row, allowedDetectorFields));
        totalDetectorResults++;

        if (detectorBatch.length >= BATCH_SIZE) {
          await detectorDelegate.createMany({ data: detectorBatch });
          console.log(
            `[seed-findings]   ... flushed ${detectorBatch.length} detector results (total: ${totalDetectorResults})`
          );
          detectorBatch = [];
        }
      }
    }

    // Flush remaining
    if (detectorBatch.length > 0) {
      await detectorDelegate.createMany({ data: detectorBatch });
      console.log(
        `[seed-findings]   ... flushed ${detectorBatch.length} detector results (total: ${totalDetectorResults})`
      );
    }
  } else {
    if (!detectorDelegate) {
      console.warn("[seed-findings] WARN: detectorResult delegate not found — skipping DetectorResult creation.");
    }
    if (evidencePool.length === 0) {
      console.warn("[seed-findings] WARN: No evidence pool available — skipping DetectorResult creation.");
    }
  }

  // 10. Log final counts
  const findingCount = await findingDelegate.count({
    where: { tenantId: tenant.id },
  });

  let detectorResultCount = 0;
  if (detectorDelegate) {
    try {
      detectorResultCount = await detectorDelegate.count({
        where: { tenantId: tenant.id },
      });
    } catch {
      console.warn("[seed-findings] WARN: Could not count detectorResults.");
    }
  }

  let copilotRunCount = 0;
  if (copilotRunDelegate) {
    try {
      copilotRunCount = await copilotRunDelegate.count({
        where: { tenantId: tenant.id },
      });
    } catch {
      console.warn("[seed-findings] WARN: Could not count copilotRuns.");
    }
  }

  console.log("\n[seed-findings] === Done ===");
  console.log(`[seed-findings] finding.count()        = ${findingCount}`);
  console.log(`[seed-findings] detectorResult.count() = ${detectorResultCount}`);
  console.log(`[seed-findings] copilotRun.count()     = ${copilotRunCount}`);
}

main()
  .catch((err) => {
    console.error("[seed-findings] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
