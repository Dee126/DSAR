/**
 * Detector Simulation — Synthetic Data
 *
 * Generates pre-filled DetectorResults for synthetic evidence items.
 * When Mock Mode is active, creates detection results with:
 *   - Appropriate confidence levels
 *   - Correct masking
 *   - Proper special category flags
 */

import type { SeededRandom } from "./random";
import type { SyntheticEvidenceItem } from "./evidence";
import type { SyntheticPerson } from "./persons";
import {
  runAllDetectors,
  hasSpecialCategory,
  getSpecialCategories,
  classifyFindings,
  maskPII,
} from "../detection";
import type { DetectionResult } from "../detection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SimulatedDetectorResult {
  detectorType: string;
  detectedElements: Array<{
    elementType: string;
    confidence: number;
    confidenceLevel: string;
    snippetPreview: string | null;
    validated?: boolean;
  }>;
  detectedCategories: Array<{
    category: string;
    confidence: number;
    confidenceLevel: string;
  }>;
  containsSpecialCategorySuspected: boolean;
}

export interface SimulatedFinding {
  dataCategory: string;
  severity: string;
  confidence: number;
  summary: string;
  containsSpecialCategory: boolean;
  containsThirdPartyDataSuspected: boolean;
  requiresLegalReview: boolean;
}

export interface SimulatedCopilotRun {
  status: string;
  justification: string;
  containsSpecialCategory: boolean;
  legalApprovalStatus: string;
  totalFindings: number;
  totalEvidenceItems: number;
  errorDetails: string | null;
  detectorResults: SimulatedDetectorResult[];
  findings: SimulatedFinding[];
}

// ---------------------------------------------------------------------------
// Detector result simulation
// ---------------------------------------------------------------------------

/**
 * Simulate detection results for a synthetic evidence item.
 *
 * Uses the actual Detection Engine to analyze the injected content,
 * producing real DetectorResults with proper confidence and masking.
 */
export function simulateDetection(
  item: SyntheticEvidenceItem,
): SimulatedDetectorResult[] {
  const text = item.injectedContent.text;
  if (!text || text.trim().length === 0) return [];

  // Use actual detection engine
  const results = runAllDetectors(text);

  return results.map((r) => ({
    detectorType: r.detectorType,
    detectedElements: r.detectedElements.map((e) => ({
      elementType: e.elementType,
      confidence: e.confidence,
      confidenceLevel: e.confidenceLevel,
      snippetPreview: e.snippetPreview,
      validated: e.validated,
    })),
    detectedCategories: r.detectedCategories.map((c) => ({
      category: c.category,
      confidence: c.confidence,
      confidenceLevel: c.confidenceLevel,
    })),
    containsSpecialCategorySuspected: r.containsSpecialCategorySuspected,
  }));
}

/**
 * Generate findings from detection results.
 * Groups by data category and determines severity.
 */
export function simulateFindings(
  detectorResults: SimulatedDetectorResult[],
  evidenceItemIds: string[],
): SimulatedFinding[] {
  const categoryMap = new Map<string, {
    elements: number;
    maxConfidence: number;
    isSpecial: boolean;
  }>();

  for (const result of detectorResults) {
    for (const cat of result.detectedCategories) {
      const existing = categoryMap.get(cat.category);
      if (existing) {
        existing.elements += result.detectedElements.length;
        existing.maxConfidence = Math.max(existing.maxConfidence, cat.confidence);
        if (result.containsSpecialCategorySuspected) {
          existing.isSpecial = true;
        }
      } else {
        categoryMap.set(cat.category, {
          elements: result.detectedElements.length,
          maxConfidence: cat.confidence,
          isSpecial: result.containsSpecialCategorySuspected,
        });
      }
    }
  }

  const findings: SimulatedFinding[] = [];
  for (const [category, info] of Array.from(categoryMap.entries())) {
    const severity =
      info.isSpecial ? "CRITICAL" :
      info.maxConfidence >= 0.85 ? "WARNING" :
      "INFO";

    findings.push({
      dataCategory: category,
      severity,
      confidence: info.maxConfidence,
      summary: `Detected ${info.elements} element(s) of category ${category} across ${evidenceItemIds.length} evidence item(s).`,
      containsSpecialCategory: info.isSpecial,
      containsThirdPartyDataSuspected: false,
      requiresLegalReview: info.isSpecial,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// CopilotRun simulation
// ---------------------------------------------------------------------------

/**
 * Simulate a CopilotRun for a case with detection results.
 */
export function simulateCopilotRun(
  items: SyntheticEvidenceItem[],
  person: SyntheticPerson,
  rng: SeededRandom,
  scenario: "completed" | "special_category" | "approved" | "failed" = "completed",
): SimulatedCopilotRun {
  // Run detection on all items
  const allDetectorResults: SimulatedDetectorResult[] = [];
  for (const item of items) {
    const results = simulateDetection(item);
    allDetectorResults.push(...results);
  }

  const evidenceIds = items.map((_, i) => `synth-ev-${i}`);
  const findings = simulateFindings(allDetectorResults, evidenceIds);

  const containsSpecial = allDetectorResults.some((r) => r.containsSpecialCategorySuspected);

  let status: string;
  let legalApprovalStatus: string;
  let errorDetails: string | null = null;
  const justification = `Art. 15 GDPR access request – response preparation for ${person.fullName}`;

  switch (scenario) {
    case "completed":
      status = "COMPLETED";
      legalApprovalStatus = containsSpecial ? "REQUIRED" : "NOT_REQUIRED";
      break;
    case "special_category":
      status = "COMPLETED";
      legalApprovalStatus = "REQUIRED";
      break;
    case "approved":
      status = "COMPLETED";
      legalApprovalStatus = "APPROVED";
      break;
    case "failed":
      status = "FAILED";
      legalApprovalStatus = "NOT_REQUIRED";
      errorDetails = "Simulated failure: connector timeout after 30s";
      break;
    default:
      status = "COMPLETED";
      legalApprovalStatus = containsSpecial ? "REQUIRED" : "NOT_REQUIRED";
  }

  return {
    status,
    justification,
    containsSpecialCategory: containsSpecial || scenario === "special_category",
    legalApprovalStatus,
    totalFindings: findings.length,
    totalEvidenceItems: items.length,
    errorDetails,
    detectorResults: allDetectorResults,
    findings,
  };
}

/**
 * Simulate governance test scenarios (failed runs).
 */
export function simulateGovernanceScenarios(rng: SeededRandom): Array<{
  scenarioName: string;
  status: string;
  justification: string;
  errorDetails: string;
  legalApprovalStatus: string;
  containsSpecialCategory: boolean;
}> {
  return [
    {
      scenarioName: "missing_justification",
      status: "FAILED",
      justification: "",
      errorDetails: "Governance check failed: A justification of at least 10 characters is required for every Copilot run.",
      legalApprovalStatus: "NOT_REQUIRED",
      containsSpecialCategory: false,
    },
    {
      scenarioName: "rate_limit_exceeded",
      status: "FAILED",
      justification: "Art. 15 request - rate limited",
      errorDetails: "Governance check failed: User daily limit reached (20 runs/day).",
      legalApprovalStatus: "NOT_REQUIRED",
      containsSpecialCategory: false,
    },
    {
      scenarioName: "export_blocked_art9",
      status: "COMPLETED",
      justification: "Art. 15 access request with Art. 9 data",
      errorDetails: "",
      legalApprovalStatus: "REQUIRED",
      containsSpecialCategory: true,
    },
    {
      scenarioName: "export_approved_by_dpo",
      status: "COMPLETED",
      justification: "Art. 15 access request - DPO approved",
      errorDetails: "",
      legalApprovalStatus: "APPROVED",
      containsSpecialCategory: true,
    },
  ];
}
