/**
 * Confidence Score Model for Data Inventory Systems
 *
 * Calculates a 0–100 confidence score representing how well-documented
 * a system is in the data inventory. Higher scores mean better DSAR readiness.
 *
 * Formula:
 *   base  = 50
 *   +10   if system owner assigned
 *   +10   if at least one data category filled
 *   +10   if at least one location defined
 *   +10   if retention defined on any category
 *   +10   if automation profile configured (not MANUAL + NONE)
 *   cap   = 100
 */

export interface ConfidenceInput {
  /** Whether ownerUserId is set */
  hasOwner: boolean;
  /** Number of data categories linked to this system */
  dataCategoryCount: number;
  /** Whether dataResidencyPrimary or processingRegions are set */
  hasLocation: boolean;
  /** Whether any linked data category has retentionPeriod or retentionDays set */
  hasRetention: boolean;
  /** Whether automation readiness is not MANUAL or connector type is not NONE */
  hasAutomationProfile: boolean;
}

export function calculateConfidenceScore(input: ConfidenceInput): number {
  let score = 50;

  if (input.hasOwner) score += 10;
  if (input.dataCategoryCount > 0) score += 10;
  if (input.hasLocation) score += 10;
  if (input.hasRetention) score += 10;
  if (input.hasAutomationProfile) score += 10;

  return Math.min(score, 100);
}

/**
 * Compute the confidence input from raw system data.
 * This avoids coupling the scoring logic to Prisma types.
 */
export function buildConfidenceInput(system: {
  ownerUserId?: string | null;
  dataResidencyPrimary?: string | null;
  processingRegions?: string[];
  automationReadiness?: string;
  connectorType?: string;
  dataCategories?: Array<{
    retentionPeriod?: string | null;
    retentionDays?: number | null;
  }>;
}): ConfidenceInput {
  const categories = system.dataCategories ?? [];
  return {
    hasOwner: !!system.ownerUserId,
    dataCategoryCount: categories.length,
    hasLocation: !!(system.dataResidencyPrimary || (system.processingRegions && system.processingRegions.length > 0)),
    hasRetention: categories.some(c => !!(c.retentionPeriod || c.retentionDays)),
    hasAutomationProfile:
      (system.automationReadiness !== "MANUAL" && system.automationReadiness !== undefined) ||
      (system.connectorType !== "NONE" && system.connectorType !== undefined),
  };
}
