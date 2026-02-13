/**
 * Synthetic Data Generator — Main Orchestrator
 *
 * Coordinates all synthetic data generation components:
 *   - Person generation (identity profiles)
 *   - Case creation
 *   - Evidence generation (mock integrations)
 *   - Detection simulation
 *   - CopilotRun + governance scenario generation
 *
 * SAFETY: Only activatable in Dev Mode / Demo Tenant / explicit setting.
 * Never runs in production automatically.
 */

import { createSeededRandom } from "./random";
import type { SeededRandom } from "./random";
import { generateSyntheticPersons } from "./persons";
import type { SyntheticPerson } from "./persons";
import { generateAllEvidence } from "./evidence";
import type { SyntheticCaseEvidence, SyntheticEvidenceItem } from "./evidence";
import { simulateCopilotRun, simulateGovernanceScenarios } from "./detector-simulation";
import type { SimulatedCopilotRun } from "./detector-simulation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DatasetSize = "small" | "medium" | "large";

export interface SyntheticDataConfig {
  size: DatasetSize;
  seed?: number;
  includeSpecialCategory: boolean;
  includeFinancial: boolean;
  includeHR: boolean;
  includeOcrImages: boolean;
  includeMockIntegrations: boolean;
}

export interface SyntheticCase {
  person: SyntheticPerson;
  caseType: string;
  caseStatus: string;
  casePriority: string;
  evidence: SyntheticCaseEvidence;
  copilotRun: SimulatedCopilotRun | null;
  runScenario: string | null;
}

export interface SyntheticDataset {
  config: SyntheticDataConfig;
  seed: number;
  persons: SyntheticPerson[];
  cases: SyntheticCase[];
  governanceScenarios: ReturnType<typeof simulateGovernanceScenarios>;
  stats: DatasetStats;
}

export interface DatasetStats {
  totalPersons: number;
  totalCases: number;
  totalEvidenceItems: number;
  personsWithFinancial: number;
  personsWithHR: number;
  personsWithArt9: number;
  casesWithRuns: number;
  casesWithSpecialCategory: number;
  casesByType: Record<string, number>;
  casesByStatus: Record<string, number>;
  evidenceByProvider: Record<string, number>;
  governanceScenarioCount: number;
}

// ---------------------------------------------------------------------------
// Mode guard
// ---------------------------------------------------------------------------

export type SyntheticModeEnvironment = "development" | "demo_tenant" | "explicit_setting";

/**
 * Validate that synthetic mode is allowed.
 * Returns null if allowed, or an error message if blocked.
 */
export function validateSyntheticMode(
  environment: SyntheticModeEnvironment | null,
  isDemoTenant?: boolean,
  explicitSetting?: boolean,
): string | null {
  if (environment === "development") return null;
  if (environment === "demo_tenant" && isDemoTenant) return null;
  if (environment === "explicit_setting" && explicitSetting) return null;

  return "Synthetic data generation is only allowed in: development mode, demo tenant, or with explicit 'Enable Synthetic Mode' setting.";
}

// ---------------------------------------------------------------------------
// Dataset size mapping
// ---------------------------------------------------------------------------

function getPersonCount(size: DatasetSize): number {
  switch (size) {
    case "small": return 5;
    case "medium": return 25;
    case "large": return 100;
    default: return 5;
  }
}

// ---------------------------------------------------------------------------
// Case type distribution
// ---------------------------------------------------------------------------

const CASE_TYPES = [
  { type: "ACCESS", weight: 0.85 },
  { type: "ERASURE", weight: 0.10 },
  { type: "RECTIFICATION", weight: 0.05 },
];

const CASE_STATUSES = [
  { status: "NEW", weight: 0.15 },
  { status: "IDENTITY_VERIFICATION", weight: 0.10 },
  { status: "DATA_COLLECTION", weight: 0.25 },
  { status: "REVIEW_LEGAL", weight: 0.20 },
  { status: "RESPONSE_PREPARATION", weight: 0.15 },
  { status: "CLOSED", weight: 0.15 },
];

const CASE_PRIORITIES = [
  { priority: "LOW", weight: 0.20 },
  { priority: "MEDIUM", weight: 0.50 },
  { priority: "HIGH", weight: 0.25 },
  { priority: "CRITICAL", weight: 0.05 },
];

function weightedPick<T extends { weight: number }>(
  items: T[],
  rng: SeededRandom,
): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let r = rng.float(0, total);
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------------------
// CopilotRun scenario assignment
// ---------------------------------------------------------------------------

function assignRunScenario(
  person: SyntheticPerson,
  rng: SeededRandom,
): { scenario: "completed" | "special_category" | "approved" | "failed"; include: boolean } {
  // 30% of cases get a CopilotRun
  if (!rng.chance(0.30)) {
    return { scenario: "completed", include: false };
  }

  if (person.includeArt9) {
    // Art. 9 persons get special scenarios
    return {
      scenario: rng.pick(["special_category", "approved"] as const),
      include: true,
    };
  }

  if (rng.chance(0.15)) {
    return { scenario: "failed", include: true };
  }

  return { scenario: "completed", include: true };
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate a complete synthetic dataset.
 *
 * This is the main entry point for the synthetic data generator.
 * Returns a self-contained dataset with all entities needed.
 */
export function generateSyntheticDataset(
  config: SyntheticDataConfig,
): SyntheticDataset {
  const seed = config.seed ?? 42;
  const rng = createSeededRandom(seed);
  const personCount = getPersonCount(config.size);

  // 1. Generate persons
  const persons = generateSyntheticPersons(personCount, rng, {
    includeSpecialCategory: config.includeSpecialCategory,
    includeFinancial: config.includeFinancial,
    includeHR: config.includeHR,
  });

  // 2. Generate cases + evidence + runs
  const cases: SyntheticCase[] = [];

  for (const person of persons) {
    // Case type
    const caseType = weightedPick(CASE_TYPES, rng).type;
    const caseStatus = weightedPick(CASE_STATUSES, rng).status;
    const casePriority = weightedPick(CASE_PRIORITIES, rng).priority;

    // Evidence
    const evidence = generateAllEvidence(
      person,
      rng,
      config.includeMockIntegrations,
    );

    // CopilotRun
    const runAssignment = assignRunScenario(person, rng);
    let copilotRun: SimulatedCopilotRun | null = null;
    let runScenario: string | null = null;

    if (runAssignment.include && evidence.allItems.length > 0) {
      copilotRun = simulateCopilotRun(
        evidence.allItems,
        person,
        rng,
        runAssignment.scenario,
      );
      runScenario = runAssignment.scenario;
    }

    cases.push({
      person,
      caseType,
      caseStatus,
      casePriority,
      evidence,
      copilotRun,
      runScenario,
    });
  }

  // 3. Generate governance test scenarios
  const governanceScenarios = simulateGovernanceScenarios(rng);

  // 4. Compute stats
  const stats = computeStats(persons, cases, governanceScenarios);

  return {
    config,
    seed,
    persons,
    cases,
    governanceScenarios,
    stats,
  };
}

// ---------------------------------------------------------------------------
// Stats computation
// ---------------------------------------------------------------------------

function computeStats(
  persons: SyntheticPerson[],
  cases: SyntheticCase[],
  governanceScenarios: ReturnType<typeof simulateGovernanceScenarios>,
): DatasetStats {
  const casesByType: Record<string, number> = {};
  const casesByStatus: Record<string, number> = {};
  const evidenceByProvider: Record<string, number> = {};
  let totalEvidence = 0;
  let casesWithRuns = 0;
  let casesWithSpecial = 0;

  for (const c of cases) {
    casesByType[c.caseType] = (casesByType[c.caseType] ?? 0) + 1;
    casesByStatus[c.caseStatus] = (casesByStatus[c.caseStatus] ?? 0) + 1;

    for (const item of c.evidence.allItems) {
      evidenceByProvider[item.provider] = (evidenceByProvider[item.provider] ?? 0) + 1;
      totalEvidence++;
    }

    if (c.copilotRun) {
      casesWithRuns++;
      if (c.copilotRun.containsSpecialCategory) casesWithSpecial++;
    }
  }

  return {
    totalPersons: persons.length,
    totalCases: cases.length,
    totalEvidenceItems: totalEvidence,
    personsWithFinancial: persons.filter((p) => p.includeFinancial).length,
    personsWithHR: persons.filter((p) => p.includeHR).length,
    personsWithArt9: persons.filter((p) => p.includeArt9).length,
    casesWithRuns,
    casesWithSpecialCategory: casesWithSpecial,
    casesByType,
    casesByStatus,
    evidenceByProvider,
    governanceScenarioCount: governanceScenarios.length,
  };
}

// ---------------------------------------------------------------------------
// Reset function descriptor
// ---------------------------------------------------------------------------

/**
 * Get the list of entity types that will be deleted during reset.
 * The actual deletion happens in the API layer via Prisma.
 */
export function getResetTargets(): string[] {
  return [
    "ExportApproval",
    "RedactionSuggestion",
    "BreakGlassEvent",
    "ExportArtifact",
    "CopilotSummary",
    "Finding",
    "DetectorResult",
    "EvidenceItem",
    "CopilotQuery",
    "CopilotRun",
    "IdentityProfile",
    "LegalHold",
    "LegalReview",
    "DataCollectionItem",
    "CommunicationLog",
    "Comment",
    "Document",
    "Task",
    "DSARStateTransition",
    "DSARCase",
    "DataSubject",
  ];
}

/**
 * Validate that reset is allowed.
 */
export function validateResetAllowed(
  environment: SyntheticModeEnvironment | null,
  isDemoTenant?: boolean,
): string | null {
  if (environment === "development") return null;
  if (environment === "demo_tenant" && isDemoTenant) return null;

  return "Reset is only allowed in development mode or for demo tenants.";
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export { createSeededRandom } from "./random";
export type { SeededRandom } from "./random";
export { generateSyntheticPersons } from "./persons";
export type { SyntheticPerson } from "./persons";
export { generateAllEvidence, generateExchangeEvidence, generateSharePointEvidence, generateOneDriveEvidence } from "./evidence";
export type { SyntheticEvidenceItem, SyntheticCaseEvidence } from "./evidence";
export { injectPII, injectSinglePII } from "./pii-injection";
export type { InjectedContent } from "./pii-injection";
export { simulateDetection, simulateFindings, simulateCopilotRun, simulateGovernanceScenarios } from "./detector-simulation";
export type { SimulatedDetectorResult, SimulatedFinding, SimulatedCopilotRun } from "./detector-simulation";
