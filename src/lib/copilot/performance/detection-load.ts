/**
 * Detection Engine Load Simulation
 *
 * Two modes:
 *   A) Real Detection — run full RegEx/keyword detection pipeline
 *   B) Simulated Detection — generate detection results directly (test infra, not RegEx perf)
 */

import type { SeededRandom } from "../synthetic/random";
import type { SyntheticEvidenceItem } from "../synthetic/evidence";
import { runAllDetectors, hasSpecialCategory } from "../detection";
import type { DetectionResult } from "../detection";
import type { SimulatedDetectorResult } from "../synthetic/detector-simulation";
import type { DetectionMode, RunMetrics } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetectionBatchResult {
  batchIndex: number;
  itemCount: number;
  detectionTimeMs: number;
  specialCategoryCount: number;
  totalDetections: number;
}

export interface DetectionLoadResult {
  mode: DetectionMode;
  totalItems: number;
  totalDetections: number;
  specialCategoryItems: number;
  totalTimeMs: number;
  throughputItemsPerSec: number;
  batches: DetectionBatchResult[];
}

// ---------------------------------------------------------------------------
// Real Detection
// ---------------------------------------------------------------------------

/**
 * Run real detection engine on a batch of evidence items.
 */
export function runRealDetectionBatch(
  items: SyntheticEvidenceItem[],
  batchIndex: number,
): DetectionBatchResult {
  const start = performance.now();
  let totalDetections = 0;
  let specialCount = 0;

  for (const item of items) {
    const text = item.injectedContent.text;
    if (!text || text.trim().length === 0) continue;

    const results = runAllDetectors(text);
    totalDetections += results.length;
    if (hasSpecialCategory(results)) {
      specialCount++;
    }
  }

  return {
    batchIndex,
    itemCount: items.length,
    detectionTimeMs: performance.now() - start,
    specialCategoryCount: specialCount,
    totalDetections,
  };
}

// ---------------------------------------------------------------------------
// Simulated Detection
// ---------------------------------------------------------------------------

const SIMULATED_CATEGORIES = [
  "COMMUNICATION", "IDENTITY", "PAYMENT", "CONTRACT",
  "HEALTH", "HR_DATA", "LOCATION",
];

const SIMULATED_ELEMENT_TYPES = [
  "EMAIL", "PHONE", "IBAN", "NAME", "ADDRESS",
  "EMPLOYEE_ID", "CUSTOMER_NUMBER", "IP_ADDRESS",
];

/**
 * Generate simulated detection results without running the actual engine.
 * Used for testing infrastructure/pipeline performance.
 */
export function generateSimulatedDetection(
  item: SyntheticEvidenceItem,
  rng: SeededRandom,
): SimulatedDetectorResult {
  const hasSpecial = item.injectedContent.containsSpecialCategory;
  const piiCount = item.injectedContent.injectedPiiTypes.length;
  const elementCount = Math.max(1, Math.min(piiCount, rng.int(1, 5)));

  const elements: SimulatedDetectorResult["detectedElements"] = [];
  for (let i = 0; i < elementCount; i++) {
    const type = item.injectedContent.injectedPiiTypes[i] ?? rng.pick(SIMULATED_ELEMENT_TYPES);
    const confidence = rng.float(0.5, 0.99);
    elements.push({
      elementType: type,
      confidence,
      confidenceLevel: confidence >= 0.85 ? "HIGH" : confidence >= 0.6 ? "MEDIUM" : "LOW",
      snippetPreview: "[simulated]",
      validated: true,
    });
  }

  const categories: SimulatedDetectorResult["detectedCategories"] = [];
  const catCount = rng.int(1, 3);
  for (let i = 0; i < catCount; i++) {
    const cat = hasSpecial && i === 0
      ? rng.pick(["HEALTH", "RELIGION", "UNION", "POLITICAL_OPINION"])
      : rng.pick(SIMULATED_CATEGORIES);
    const confidence = rng.float(0.5, 0.99);
    categories.push({
      category: cat,
      confidence,
      confidenceLevel: confidence >= 0.85 ? "HIGH" : confidence >= 0.6 ? "MEDIUM" : "LOW",
    });
  }

  return {
    detectorType: "REGEX",
    detectedElements: elements,
    detectedCategories: categories,
    containsSpecialCategorySuspected: hasSpecial,
  };
}

/**
 * Run simulated detection on a batch of items.
 */
export function runSimulatedDetectionBatch(
  items: SyntheticEvidenceItem[],
  rng: SeededRandom,
  batchIndex: number,
): DetectionBatchResult {
  const start = performance.now();
  let totalDetections = 0;
  let specialCount = 0;

  for (const item of items) {
    const result = generateSimulatedDetection(item, rng);
    totalDetections++;
    if (result.containsSpecialCategorySuspected) {
      specialCount++;
    }
  }

  return {
    batchIndex,
    itemCount: items.length,
    detectionTimeMs: performance.now() - start,
    specialCategoryCount: specialCount,
    totalDetections,
  };
}

// ---------------------------------------------------------------------------
// Orchestrated load runner
// ---------------------------------------------------------------------------

/**
 * Run detection on all evidence items in batches, using specified mode.
 */
export function runDetectionLoad(
  items: SyntheticEvidenceItem[],
  mode: DetectionMode,
  rng: SeededRandom,
  batchSize: number = 500,
): DetectionLoadResult {
  const start = performance.now();
  const batches: DetectionBatchResult[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);

    const result = mode === "real"
      ? runRealDetectionBatch(batch, batchIndex)
      : runSimulatedDetectionBatch(batch, rng, batchIndex);

    batches.push(result);
  }

  const totalTimeMs = performance.now() - start;
  const totalDetections = batches.reduce((s, b) => s + b.totalDetections, 0);
  const specialCount = batches.reduce((s, b) => s + b.specialCategoryCount, 0);

  return {
    mode,
    totalItems: items.length,
    totalDetections,
    specialCategoryItems: specialCount,
    totalTimeMs,
    throughputItemsPerSec: totalTimeMs > 0 ? (items.length / totalTimeMs) * 1000 : 0,
    batches,
  };
}
