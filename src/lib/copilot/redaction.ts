/**
 * Redaction Governance Service — Privacy Copilot
 *
 * Implements "Redaction Suggestions" — a preparation layer for
 * data schwärzung (redaction/blackout) in DSAR responses.
 *
 * Key principles:
 *   - All redaction suggestions are marked as "suggested" (never automatic)
 *   - Every suggestion must be reviewed by DPO/Legal before application
 *   - All review actions are audit-logged
 *   - No redaction is applied without explicit human confirmation
 *
 * This module is a preparatory framework — actual document redaction
 * (PDF blackout, etc.) is a separate integration point.
 */

import { maskPII } from "./detection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RedactionSuggestionStatus = "SUGGESTED" | "APPROVED" | "REJECTED";

export interface RedactionSuggestionInput {
  elementType: string;
  originalSnippet: string;
  suggestedRedaction: string;
  reason?: string;
  evidenceItemId?: string;
}

export interface RedactionReviewInput {
  suggestionId: string;
  status: "APPROVED" | "REJECTED";
  reviewNote?: string;
  reviewerUserId: string;
  reviewerRole: string;
}

export interface RedactionReviewResult {
  allowed: boolean;
  reason?: string;
  code?: string;
}

// ---------------------------------------------------------------------------
// Role checks
// ---------------------------------------------------------------------------

const REDACTION_REVIEW_ROLES = new Set(["DPO", "TENANT_ADMIN", "SUPER_ADMIN"]);

/**
 * Check whether a role can review (approve/reject) redaction suggestions.
 */
export function canReviewRedaction(role: string): boolean {
  return REDACTION_REVIEW_ROLES.has(role);
}

/**
 * Validate a redaction review action.
 */
export function validateRedactionReview(
  reviewInput: RedactionReviewInput,
): RedactionReviewResult {
  if (!canReviewRedaction(reviewInput.reviewerRole)) {
    return {
      allowed: false,
      reason: `Role '${reviewInput.reviewerRole}' does not have permission to review redaction suggestions.`,
      code: "REDACTION_REVIEW_FORBIDDEN",
    };
  }

  if (!["APPROVED", "REJECTED"].includes(reviewInput.status)) {
    return {
      allowed: false,
      reason: "Redaction review status must be 'APPROVED' or 'REJECTED'.",
      code: "INVALID_REDACTION_STATUS",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Suggestion generation
// ---------------------------------------------------------------------------

/**
 * Generate redaction suggestions from detection results.
 *
 * For each detected element, create a suggestion with:
 *   - The element type (e.g. EMAIL_ADDRESS, IBAN_DE)
 *   - A masked version of the original snippet (never the raw PII)
 *   - A suggested redaction text (e.g. "[REDACTED EMAIL]")
 *   - A reason explaining why this should be redacted
 *
 * All suggestions start in "SUGGESTED" status — DPO/Legal must approve.
 */
export function generateRedactionSuggestions(
  detectedElements: Array<{
    elementType: string;
    snippetPreview: string | null;
    confidence: number;
    confidenceLevel: string;
  }>,
  evidenceItemId?: string,
): RedactionSuggestionInput[] {
  const suggestions: RedactionSuggestionInput[] = [];

  for (const element of detectedElements) {
    if (!element.snippetPreview) continue;

    const redactionLabel = getRedactionLabel(element.elementType);
    const reason = getRedactionReason(element.elementType, element.confidenceLevel);

    suggestions.push({
      elementType: element.elementType,
      originalSnippet: element.snippetPreview, // Already masked from detection
      suggestedRedaction: redactionLabel,
      reason,
      evidenceItemId,
    });
  }

  return suggestions;
}

/**
 * Get a standardized redaction label for a PII element type.
 */
export function getRedactionLabel(elementType: string): string {
  const labels: Record<string, string> = {
    EMAIL_ADDRESS: "[REDACTED EMAIL]",
    PHONE_EU_INTERNATIONAL: "[REDACTED PHONE]",
    PHONE_DE: "[REDACTED PHONE]",
    PHONE_AT: "[REDACTED PHONE]",
    PHONE_CH: "[REDACTED PHONE]",
    ADDRESS_DE: "[REDACTED ADDRESS]",
    ADDRESS_GENERIC: "[REDACTED ADDRESS]",
    NAME_FULL: "[REDACTED NAME]",
    IBAN_DE: "[REDACTED IBAN]",
    IBAN_AT: "[REDACTED IBAN]",
    IBAN_CH: "[REDACTED IBAN]",
    IBAN_EU_GENERIC: "[REDACTED IBAN]",
    CREDIT_CARD_VISA: "[REDACTED CREDIT CARD]",
    CREDIT_CARD_MASTERCARD: "[REDACTED CREDIT CARD]",
    CREDIT_CARD_AMEX: "[REDACTED CREDIT CARD]",
    BANK_ACCOUNT_DE: "[REDACTED BANK ACCOUNT]",
    TAX_ID_DE: "[REDACTED TAX ID]",
    SSN_DE: "[REDACTED SSN]",
    SSN_AT: "[REDACTED SSN]",
    SSN_GENERIC: "[REDACTED SSN]",
    PASSPORT_DE: "[REDACTED PASSPORT]",
    PASSPORT_AT: "[REDACTED PASSPORT]",
    PASSPORT_GENERIC: "[REDACTED ID DOCUMENT]",
    EMPLOYEE_ID_GENERIC: "[REDACTED EMPLOYEE ID]",
    CUSTOMER_NUMBER_GENERIC: "[REDACTED CUSTOMER NUMBER]",
    IP_V4: "[REDACTED IP ADDRESS]",
    IP_V6: "[REDACTED IP ADDRESS]",
    MAC_ADDRESS: "[REDACTED MAC ADDRESS]",
    DEVICE_ID_GENERIC: "[REDACTED DEVICE ID]",
    DOB_EU_FORMAT: "[REDACTED DATE OF BIRTH]",
    DOB_ISO_FORMAT: "[REDACTED DATE OF BIRTH]",
  };

  // Art. 9 keyword patterns
  if (elementType.startsWith("ART9_")) {
    return "[REDACTED SPECIAL CATEGORY DATA]";
  }

  return labels[elementType] ?? "[REDACTED]";
}

/**
 * Generate a reason string for why a particular element should be redacted.
 */
function getRedactionReason(
  elementType: string,
  confidenceLevel: string,
): string {
  const isArt9 = elementType.startsWith("ART9_");
  const isThirdParty = elementType.startsWith("THIRD_PARTY_");

  if (isArt9) {
    return `Art. 9 special category data detected (${confidenceLevel} confidence). ` +
           "Redaction strongly recommended unless explicit legal basis for disclosure exists.";
  }

  if (isThirdParty) {
    return `Third-party personal data detected (${confidenceLevel} confidence). ` +
           "Redaction required unless the third party has consented to disclosure.";
  }

  return `Personal data element (${elementType}) detected with ${confidenceLevel} confidence. ` +
         "Review for potential redaction in DSAR response to protect third-party rights.";
}
