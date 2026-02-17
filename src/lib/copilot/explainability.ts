/**
 * Explainability & Non-Hallucination Controls — Privacy Copilot
 *
 * Ensures that all Copilot outputs are:
 *   - Evidence-based (never speculative)
 *   - Properly disclaimed
 *   - Free of absolute statements about data absence
 *   - Attributable to specific systems and evidence
 *
 * Key rules:
 *   1. Every summary references the systems it is based on
 *   2. "No evidence" != "no data" — always use "no evidence found"
 *   3. All summaries include mandatory disclaimers
 *   4. Confidence levels are transparent
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExplainabilityContext {
  systemsSearched: string[];
  systemsNotSearched?: string[];
  evidenceCount: number;
  findingCount: number;
  containsSpecialCategory: boolean;
  contentScanningUsed: boolean;
}

export interface CopilotResponse {
  content: string;
  disclaimers: string[];
  basedOnSystems: string[];
  evidenceBased: boolean;
  confidenceStatement: string;
}

// ---------------------------------------------------------------------------
// Disclaimers
// ---------------------------------------------------------------------------

export const MANDATORY_DISCLAIMERS = {
  baseDisclaimer:
    "This output is based on automated discovery and classification. " +
    "It does not constitute legal advice and should be reviewed by a qualified professional.",
  noAbsoluteAbsence:
    "No evidence does not guarantee absence of data. " +
    "Only the systems listed above were queried during this discovery run.",
  specialCategoryWarning:
    "Art. 9 GDPR special category data was detected. " +
    "Legal review and explicit DPO approval are required before any disclosure.",
  contentScanNote:
    "Content scanning was used in this analysis. " +
    "Only masked snippets of detected PII are stored — no full document content is retained.",
  metadataOnlyNote:
    "This analysis was performed in metadata-only mode. " +
    "Content scanning was NOT used. Results are based solely on file metadata and system records.",
  thirdPartyDataNote:
    "Third-party personal data may be present in the evidence. " +
    "Such data must be redacted before disclosure unless the third party has consented.",
} as const;

// ---------------------------------------------------------------------------
// Evidence-based response generation
// ---------------------------------------------------------------------------

/**
 * Build an evidence-based response statement for a data search query.
 *
 * NEVER produces absolute statements about data absence.
 * Always frames results in terms of "evidence found" or "no evidence found".
 */
export function buildEvidenceBasedResponse(
  context: ExplainabilityContext,
): CopilotResponse {
  const disclaimers: string[] = [MANDATORY_DISCLAIMERS.baseDisclaimer];
  const lines: string[] = [];

  // System attribution
  if (context.systemsSearched.length > 0) {
    lines.push(
      `Based on collected evidence from: ${context.systemsSearched.join(", ")}`,
    );
  } else {
    lines.push("No systems were queried in this discovery run.");
  }

  lines.push("");

  // Result framing
  if (context.evidenceCount > 0) {
    lines.push(
      `Found evidence in ${context.systemsSearched.length} system(s): ` +
      `${context.evidenceCount} evidence item(s), ${context.findingCount} finding(s).`,
    );
  } else {
    lines.push(
      "No evidence found in systems searched.",
    );
    disclaimers.push(MANDATORY_DISCLAIMERS.noAbsoluteAbsence);
  }

  // Special category warning
  if (context.containsSpecialCategory) {
    lines.push("");
    lines.push(
      "*** WARNING: Art. 9 special category data detected ***",
    );
    disclaimers.push(MANDATORY_DISCLAIMERS.specialCategoryWarning);
  }

  // Content scanning note
  if (context.contentScanningUsed) {
    disclaimers.push(MANDATORY_DISCLAIMERS.contentScanNote);
  } else {
    disclaimers.push(MANDATORY_DISCLAIMERS.metadataOnlyNote);
  }

  // Systems not searched
  if (context.systemsNotSearched && context.systemsNotSearched.length > 0) {
    lines.push("");
    lines.push(
      `Note: The following systems were NOT searched: ${context.systemsNotSearched.join(", ")}`,
    );
  }

  // Confidence statement
  const confidenceStatement = buildConfidenceStatement(context);

  return {
    content: lines.join("\n"),
    disclaimers,
    basedOnSystems: context.systemsSearched,
    evidenceBased: context.evidenceCount > 0,
    confidenceStatement,
  };
}

/**
 * Build a confidence statement based on the discovery context.
 */
function buildConfidenceStatement(
  context: ExplainabilityContext,
): string {
  if (context.systemsSearched.length === 0) {
    return "No systems were queried — confidence level: NONE.";
  }

  if (context.contentScanningUsed && context.evidenceCount > 0) {
    return "Content-level analysis performed — detection confidence is based on regex/keyword matching with validation where applicable.";
  }

  if (context.evidenceCount > 0) {
    return "Metadata-level analysis performed — confidence is based on metadata classification only. Content scanning may provide higher accuracy.";
  }

  return "No evidence found — this does not confirm absence of data. Additional systems or content scanning may yield different results.";
}

// ---------------------------------------------------------------------------
// Summary validation
// ---------------------------------------------------------------------------

/**
 * Validate that a summary text includes required explainability elements.
 * Returns a list of missing elements.
 */
export function validateSummaryExplainability(
  summaryText: string,
  context: ExplainabilityContext,
): string[] {
  const missing: string[] = [];

  // Must reference the systems searched
  if (context.systemsSearched.length > 0) {
    const hasSystemRef = context.systemsSearched.some(
      (s) => summaryText.includes(s),
    );
    if (!hasSystemRef) {
      missing.push("Summary does not reference the systems searched.");
    }
  }

  // Must include a disclaimer
  const hasDisclaimer = summaryText.toLowerCase().includes("disclaimer") ||
    summaryText.toLowerCase().includes("does not guarantee") ||
    summaryText.toLowerCase().includes("does not constitute");
  if (!hasDisclaimer) {
    missing.push("Summary is missing a disclaimer statement.");
  }

  // Must not make absolute absence claims
  const absolutePatterns = [
    /\bno data exists\b/i,
    /\bthere is no data\b/i,
    /\bno personal data\b.*\bfound\b/i,
    /\bwe do not have\b/i,
    /\bwe have no\b.*\bdata\b/i,
  ];

  for (const pattern of absolutePatterns) {
    if (pattern.test(summaryText)) {
      missing.push(
        "Summary contains an absolute absence statement. Use 'no evidence found' instead.",
      );
      break;
    }
  }

  return missing;
}

// ---------------------------------------------------------------------------
// Template responses
// ---------------------------------------------------------------------------

/**
 * Generate a standardized "data found" response.
 */
export function dataFoundResponse(
  systems: string[],
  categoryCount: number,
  findingCount: number,
): string {
  return `Found evidence in systems ${systems.join(", ")}. ` +
    `${findingCount} finding(s) across ${categoryCount} data categor${categoryCount === 1 ? "y" : "ies"} identified. ` +
    "See detailed findings for specifics.";
}

/**
 * Generate a standardized "no evidence found" response.
 * NEVER says "no data exists" — only "no evidence found".
 */
export function noEvidenceFoundResponse(
  systemsSearched: string[],
): string {
  return `No evidence found in systems searched (${systemsSearched.join(", ")}). ` +
    "This does not guarantee absence of data — only the listed systems were queried.";
}
