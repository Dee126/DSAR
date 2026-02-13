/**
 * Scalable Data Generator — Performance Test Mode
 *
 * Generates large-scale synthetic datasets (up to 50,000 persons, 500,000+
 * evidence items) using batch processing to prevent memory exhaustion.
 *
 * Evidence distribution: 40% Email, 30% SharePoint, 20% OneDrive, 10% Misc
 */

import { createSeededRandom } from "../synthetic/random";
import type { SeededRandom } from "../synthetic/random";
import { generateSyntheticPersons } from "../synthetic/persons";
import type { SyntheticPerson } from "../synthetic/persons";
import { injectPII } from "../synthetic/pii-injection";
import type { InjectedContent } from "../synthetic/pii-injection";
import type { SyntheticEvidenceItem } from "../synthetic/evidence";
import type {
  PerformanceConfig,
  EvidenceDensity,
  PerformanceLimits,
  BatchResult,
  DEFAULT_PERFORMANCE_LIMITS,
} from "./types";
import {
  EVIDENCE_DISTRIBUTION,
  getEvidencePerPerson,
} from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScalableDataset {
  persons: SyntheticPerson[];
  totalEvidenceItems: number;
  evidenceByProvider: Record<string, number>;
  generationTimeMs: number;
  batchCount: number;
  specialCategoryPersonCount: number;
}

export interface EvidenceBatch {
  batchIndex: number;
  personIndex: number;
  items: SyntheticEvidenceItem[];
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MAX_PERSONS = 50000;
const MAX_EVIDENCE_TOTAL = 5000000;

export function validatePerformanceConfig(config: PerformanceConfig): string | null {
  if (config.personCount < 1 || config.personCount > MAX_PERSONS) {
    return `Person count must be between 1 and ${MAX_PERSONS}. Got: ${config.personCount}`;
  }

  const evidencePerPerson = getEvidencePerPerson(config.evidenceDensity);
  const totalEvidence = config.personCount * evidencePerPerson;
  if (totalEvidence > MAX_EVIDENCE_TOTAL) {
    return `Total evidence items (${totalEvidence}) exceeds maximum of ${MAX_EVIDENCE_TOTAL}.`;
  }

  if (config.parallelRuns < 1 || config.parallelRuns > 25) {
    return `Parallel runs must be between 1 and 25. Got: ${config.parallelRuns}`;
  }

  if (config.specialCategoryRatio < 0 || config.specialCategoryRatio > 1) {
    return `Special category ratio must be between 0 and 1. Got: ${config.specialCategoryRatio}`;
  }

  return null;
}

/**
 * Validate that performance mode is allowed.
 */
export function validatePerformanceMode(
  nodeEnv: string | undefined,
  isDemoTenant?: boolean,
  isTestEnv?: boolean,
): string | null {
  if (nodeEnv === "development") return null;
  if (nodeEnv === "test") return null;
  if (isDemoTenant) return null;
  if (isTestEnv) return null;

  return "Performance test mode is only allowed in: development, test, or demo tenant environments.";
}

// ---------------------------------------------------------------------------
// Batch-based person generation
// ---------------------------------------------------------------------------

/**
 * Generate persons in batches to manage memory.
 */
export function generatePersonsBatched(
  totalCount: number,
  rng: SeededRandom,
  specialCategoryRatio: number,
  batchSize: number,
): BatchResult<SyntheticPerson>[] {
  const batches: BatchResult<SyntheticPerson>[] = [];
  let generated = 0;
  let batchIndex = 0;

  while (generated < totalCount) {
    const start = performance.now();
    const remaining = totalCount - generated;
    const count = Math.min(batchSize, remaining);

    const persons = generateSyntheticPersons(count, rng, {
      includeSpecialCategory: specialCategoryRatio > 0,
      includeFinancial: true,
      includeHR: true,
    });

    const durationMs = performance.now() - start;

    batches.push({
      batchIndex,
      items: persons,
      processedCount: persons.length,
      durationMs,
    });

    generated += count;
    batchIndex++;
  }

  return batches;
}

// ---------------------------------------------------------------------------
// Evidence generation (lightweight, scalable)
// ---------------------------------------------------------------------------

const EMAIL_SUBJECTS = [
  "Re: Q{q} Report", "Meeting Notes {d}", "Invoice #{n}",
  "Status Update", "Project Timeline", "Feedback", "Holiday {y}",
  "Offboarding {name}", "Access Request", "Weekly Sync",
];

const SP_FILES = [
  "Payroll_{y}.pdf", "Contract_{name}.pdf", "Review_{name}.docx",
  "Invoice_{n}.xlsx", "Expense_{name}.xlsx", "Policy_v{v}.pdf",
  "Meeting_{d}.docx", "CRM_Export.csv", "Proposal_{n}.pdf",
  "Tax_{y}.pdf",
];

const OD_FILES = [
  "Bewerbung.pdf", "Lebenslauf.docx", "Krankmeldung.pdf",
  "Bankverbindung.txt", "Steuerbescheid.pdf", "Arbeitszeugnis.pdf",
  "Gehaltsnachweis.pdf", "Notizen.txt",
];

const MISC_RECORDS = [
  "CRM_Record", "ERP_Export", "HelpDesk_Ticket",
  "SAP_Employee_Extract", "JIRA_Comment",
];

function generateEvidenceTitle(
  templates: string[],
  person: SyntheticPerson,
  rng: SeededRandom,
): string {
  const t = rng.pick(templates);
  return t
    .replace("{q}", String(rng.int(1, 4)))
    .replace("{d}", `${rng.int(1, 28)}.${rng.int(1, 12)}.${rng.int(2022, 2025)}`)
    .replace("{n}", String(rng.int(10000, 99999)))
    .replace("{y}", String(rng.int(2022, 2025)))
    .replace("{v}", `${rng.int(1, 5)}.${rng.int(0, 9)}`)
    .replace("{name}", person.lastName);
}

function generateSourceDate(rng: SeededRandom): Date {
  return new Date(rng.int(2022, 2025), rng.int(0, 11), rng.int(1, 28), rng.int(6, 22), rng.int(0, 59));
}

/**
 * Generate a single lightweight evidence item.
 * Uses minimal PII injection for performance at scale.
 */
function generateLightweightEvidence(
  person: SyntheticPerson,
  provider: string,
  rng: SeededRandom,
): SyntheticEvidenceItem {
  let title: string;
  let workload: string;
  let itemType: string;
  let location: string;

  switch (provider) {
    case "EXCHANGE_ONLINE":
      title = generateEvidenceTitle(EMAIL_SUBJECTS, person, rng);
      workload = "EXCHANGE";
      itemType = "EMAIL";
      location = `EXCHANGE_ONLINE:Mailbox:${person.email}/Inbox`;
      break;
    case "SHAREPOINT":
      title = generateEvidenceTitle(SP_FILES, person, rng);
      workload = "SHAREPOINT";
      itemType = "FILE";
      location = `SHAREPOINT:sites/testcorp/Documents/${title}`;
      break;
    case "ONEDRIVE":
      title = generateEvidenceTitle(OD_FILES, person, rng);
      workload = "ONEDRIVE";
      itemType = "FILE";
      location = `ONEDRIVE:personal/${person.upn}/Documents/${title}`;
      break;
    default:
      title = generateEvidenceTitle(MISC_RECORDS, person, rng);
      workload = "MISC";
      itemType = "RECORD";
      location = `MISC:system/${title}`;
      break;
  }

  const isSensitive = rng.chance(0.25);
  const createdAt = generateSourceDate(rng);

  const content = injectPII(person, rng, {
    includeFinancial: isSensitive && person.includeFinancial,
    includeHR: isSensitive && person.includeHR,
    includeArt9: isSensitive && person.includeArt9,
    art9Categories: person.art9Categories,
  });

  return {
    provider,
    workload,
    itemType,
    location,
    title,
    contentHandling: "METADATA_ONLY",
    createdAtSource: createdAt,
    modifiedAtSource: new Date(createdAt.getTime() + rng.int(0, 86400000)),
    metadata: { synthetic: true },
    injectedContent: content,
    sensitivityScore: isSensitive ? rng.int(50, 95) : rng.int(5, 40),
  };
}

/**
 * Determine which provider to assign based on weighted distribution.
 */
function pickProvider(rng: SeededRandom): string {
  const r = rng.next();
  if (r < EVIDENCE_DISTRIBUTION.email) return "EXCHANGE_ONLINE";
  if (r < EVIDENCE_DISTRIBUTION.email + EVIDENCE_DISTRIBUTION.sharepoint) return "SHAREPOINT";
  if (r < EVIDENCE_DISTRIBUTION.email + EVIDENCE_DISTRIBUTION.sharepoint + EVIDENCE_DISTRIBUTION.onedrive) return "ONEDRIVE";
  return "MISC";
}

/**
 * Generate evidence for a person at the specified density.
 */
export function generateEvidenceForPerson(
  person: SyntheticPerson,
  density: EvidenceDensity,
  rng: SeededRandom,
): SyntheticEvidenceItem[] {
  const count = getEvidencePerPerson(density);
  const items: SyntheticEvidenceItem[] = [];

  for (let i = 0; i < count; i++) {
    const provider = pickProvider(rng);
    items.push(generateLightweightEvidence(person, provider, rng));
  }

  return items;
}

/**
 * Generate evidence in batches across all persons.
 * Yields batch results to support streaming / memory-safe processing.
 */
export function generateEvidenceBatched(
  persons: SyntheticPerson[],
  density: EvidenceDensity,
  rng: SeededRandom,
  batchSize: number,
): EvidenceBatch[] {
  const batches: EvidenceBatch[] = [];
  const evidencePerPerson = getEvidencePerPerson(density);
  let batchItems: SyntheticEvidenceItem[] = [];
  let batchIndex = 0;
  let currentPersonIndex = 0;
  let batchStart = performance.now();

  for (let p = 0; p < persons.length; p++) {
    const personItems = generateEvidenceForPerson(persons[p], density, rng);

    for (const item of personItems) {
      batchItems.push(item);

      if (batchItems.length >= batchSize) {
        batches.push({
          batchIndex,
          personIndex: currentPersonIndex,
          items: batchItems,
          durationMs: performance.now() - batchStart,
        });
        batchItems = [];
        batchIndex++;
        currentPersonIndex = p;
        batchStart = performance.now();
      }
    }
  }

  // Flush remaining
  if (batchItems.length > 0) {
    batches.push({
      batchIndex,
      personIndex: currentPersonIndex,
      items: batchItems,
      durationMs: performance.now() - batchStart,
    });
  }

  return batches;
}

// ---------------------------------------------------------------------------
// Full scalable dataset generation
// ---------------------------------------------------------------------------

/**
 * Generate a complete performance-scale dataset.
 *
 * For 10,000 persons × medium density:
 *   → 10,000 persons × 25 = 250,000 EvidenceItems
 *
 * Uses batch processing to avoid memory spikes.
 */
export function generateScalableDataset(
  config: PerformanceConfig,
): ScalableDataset {
  const start = performance.now();
  const rng = createSeededRandom(config.seed);

  // Generate persons in batches
  const personBatches = generatePersonsBatched(
    config.personCount,
    rng,
    config.specialCategoryRatio,
    config.limits.batchSize,
  );

  const allPersons = personBatches.flatMap((b) => b.items);

  // Count evidence without holding all items in memory for stats
  const evidencePerPerson = getEvidencePerPerson(config.evidenceDensity);
  const totalEvidence = allPersons.length * evidencePerPerson;

  // Calculate distribution
  const evidenceByProvider: Record<string, number> = {
    EXCHANGE_ONLINE: Math.round(totalEvidence * EVIDENCE_DISTRIBUTION.email),
    SHAREPOINT: Math.round(totalEvidence * EVIDENCE_DISTRIBUTION.sharepoint),
    ONEDRIVE: Math.round(totalEvidence * EVIDENCE_DISTRIBUTION.onedrive),
    MISC: Math.round(totalEvidence * EVIDENCE_DISTRIBUTION.misc),
  };

  const specialCategoryCount = allPersons.filter((p) => p.includeArt9).length;

  return {
    persons: allPersons,
    totalEvidenceItems: totalEvidence,
    evidenceByProvider,
    generationTimeMs: performance.now() - start,
    batchCount: personBatches.length,
    specialCategoryPersonCount: specialCategoryCount,
  };
}
