/**
 * Deterministic AI Scoring Service
 *
 * Enriches Findings with AI Assist fields using rule-based logic.
 * No LLM calls — purely deterministic scoring based on sensitivity,
 * special-category flags, and data-category metadata.
 */

export type AiScoreResult = {
  aiRiskScore: number;
  aiConfidence: number;
  aiSuggestedAction: string;
  aiLegalReference: string;
  aiRationale: string;
};

export function scoreFinding(finding: {
  sensitivityScore?: number | null;
  containsSpecialCategory?: boolean | null;
  dataCategory?: string | null;
}): AiScoreResult {
  const sensitivity = finding.sensitivityScore ?? 0;
  const isSpecial = finding.containsSpecialCategory === true;

  // ── 1. Risk score ──────────────────────────────────────────────────────
  let riskScore = sensitivity;
  if (isSpecial) {
    riskScore += 25;
  }
  riskScore = Math.min(riskScore, 100);

  // ── 2. Suggested action ────────────────────────────────────────────────
  let suggestedAction: string;
  if (sensitivity >= 85) {
    suggestedAction = "DELETE";
  } else if (sensitivity >= 70) {
    suggestedAction = "REVIEW_REQUIRED";
  } else {
    suggestedAction = "RETAIN";
  }

  // ── 3. Legal reference ─────────────────────────────────────────────────
  let legalReference = "";
  if (isSpecial) {
    legalReference = "Art. 9 GDPR";
  }

  // ── 4. Confidence ──────────────────────────────────────────────────────
  let confidence = 0.75;
  if (isSpecial) {
    confidence = 0.9;
  } else if (sensitivity >= 80) {
    confidence = 0.85;
  }

  // ── 5. Rationale (dynamic based on rules triggered) ────────────────────
  const rationale = buildRationale(sensitivity, isSpecial, suggestedAction, finding.dataCategory);

  return {
    aiRiskScore: riskScore,
    aiConfidence: confidence,
    aiSuggestedAction: suggestedAction,
    aiLegalReference: legalReference,
    aiRationale: rationale,
  };
}

function buildRationale(
  sensitivity: number,
  isSpecial: boolean,
  suggestedAction: string,
  dataCategory?: string | null,
): string {
  const parts: string[] = [];

  if (sensitivity >= 85) {
    parts.push("Very high sensitivity score indicates significant personal data exposure");
  } else if (sensitivity >= 70) {
    parts.push("High sensitivity score requires careful review");
  } else if (sensitivity >= 40) {
    parts.push("Moderate sensitivity score within acceptable thresholds");
  } else {
    parts.push("Low sensitivity score indicates minimal risk");
  }

  if (isSpecial) {
    parts.push("special category data requires human review under Art. 9 GDPR");
  }

  if (dataCategory) {
    parts.push(`data category: ${dataCategory}`);
  }

  if (suggestedAction === "DELETE") {
    parts.push("recommendation: delete to minimise data exposure");
  } else if (suggestedAction === "REVIEW_REQUIRED") {
    parts.push("recommendation: manual review required before any action");
  } else {
    parts.push("recommendation: retain with standard controls");
  }

  // Capitalise first letter, join with "; ", end with period.
  const text = parts.join("; ");
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}
