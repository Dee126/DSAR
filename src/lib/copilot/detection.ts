/**
 * Detection Engine — DSAR Privacy Copilot
 *
 * A five-step pipeline for automated PII and special-category data detection:
 *
 *   Step A — Metadata Classification (always runs, metadata-only)
 *   Step B — RegEx / Keyword Detection (runs on text content)
 *   Step C — PDF Metadata Extraction (runs on PDF buffers)
 *   Step D — OCR Extraction (optional, requires explicit opt-in)
 *   Step E — LLM Classifier (optional, requires explicit opt-in)
 *
 * Privacy-by-Design Principles:
 *   - Default mode is METADATA_ONLY — content scanning requires explicit permission
 *   - All detected PII is masked before leaving this module via `maskPII()`
 *   - Confidence scoring (HIGH/MEDIUM/LOW) attached to every detection
 *   - IBAN checksum validation (ISO 7064 Mod 97-10)
 *   - Credit card Luhn validation
 *   - Third-party data heuristics
 *   - Performance limits (max items, max text length per scan)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DataCategoryType =
  | "IDENTIFICATION"
  | "CONTACT"
  | "CONTRACT"
  | "PAYMENT"
  | "COMMUNICATION"
  | "HR"
  | "CREDITWORTHINESS"
  | "ONLINE_TECHNICAL"
  | "HEALTH"
  | "RELIGION"
  | "UNION"
  | "POLITICAL_OPINION"
  | "OTHER_SPECIAL_CATEGORY"
  | "OTHER";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type ContentHandlingMode = "METADATA_ONLY" | "CONTENT_SCAN" | "FULL_CONTENT";

export type DetectorType = "METADATA" | "REGEX" | "PDF_METADATA" | "OCR" | "LLM_CLASSIFIER";

/**
 * The set of DataCategory values that represent Art. 9 special categories.
 */
export const SPECIAL_CATEGORIES: ReadonlySet<DataCategoryType> = new Set<DataCategoryType>([
  "HEALTH",
  "RELIGION",
  "UNION",
  "POLITICAL_OPINION",
  "OTHER_SPECIAL_CATEGORY",
]);

/**
 * Returns true if the given category is an Art. 9 special category.
 */
export function isSpecialCategory(category: DataCategoryType): boolean {
  return SPECIAL_CATEGORIES.has(category);
}

export interface DetectionPattern {
  name: string;
  type: "regex" | "keyword";
  pattern: RegExp;
  category: DataCategoryType;
  isSpecial: boolean;
  /** Validation function (e.g. Luhn, IBAN checksum). Returns true if valid. */
  validate?: (match: string) => boolean;
  /** Return a redacted representation of the match */
  redactSample: (match: string) => string;
}

/**
 * Each DetectionResult represents the output of one detector step
 * against a piece of evidence. Aggregates detected elements and categories.
 */
export interface DetectionResult {
  detectorType: DetectorType;
  detectedElements: Array<{
    elementType: string;
    confidence: number;
    confidenceLevel: ConfidenceLevel;
    snippetPreview: string | null;
    offsets?: { start: number; end: number };
    validated?: boolean;
  }>;
  detectedCategories: Array<{
    category: DataCategoryType;
    confidence: number;
    confidenceLevel: ConfidenceLevel;
  }>;
  containsSpecialCategorySuspected: boolean;
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modDate?: string;
  pageCount?: number;
}

/**
 * Configuration for a detection pipeline run.
 */
export interface DetectionPipelineConfig {
  /** Content handling mode (default: METADATA_ONLY) */
  contentHandling?: ContentHandlingMode;
  /** Enable Step D: OCR (default: false) */
  enableOcr?: boolean;
  /** Enable Step E: LLM Classifier (default: false) */
  enableLlm?: boolean;
  /** Max text length to scan in bytes (default: MAX_TEXT_SCAN_LENGTH) */
  maxTextLength?: number;
  /** Max items to process in a single run (default: MAX_ITEMS_PER_RUN) */
  maxItemsPerRun?: number;
}

/**
 * Input to the detection pipeline for a single evidence item.
 */
export interface DetectionInput {
  /** Text content (for Step B regex scanning) */
  text?: string;
  /** PDF buffer (for Step C PDF metadata extraction) */
  pdfBuffer?: Buffer;
  /** Metadata fields (for Step A metadata classification) */
  metadata?: Record<string, unknown>;
  /** File name (for metadata classification) */
  fileName?: string;
  /** MIME type (for metadata classification) */
  mimeType?: string;
  /** File size in bytes */
  fileSize?: number;
  /** Source provider name */
  provider?: string;
}

/**
 * Complete pipeline output for a single evidence item.
 */
export interface DetectionPipelineResult {
  results: DetectionResult[];
  containsSpecialCategory: boolean;
  specialCategories: DataCategoryType[];
  allCategories: DataCategoryType[];
  thirdPartyDataSuspected: boolean;
  contentHandlingApplied: ContentHandlingMode;
}

// ---------------------------------------------------------------------------
// Performance Limits
// ---------------------------------------------------------------------------

/** Maximum text length to scan per item (500 KB) */
export const MAX_TEXT_SCAN_LENGTH = 512_000;

/** Maximum items to process in a single pipeline run */
export const MAX_ITEMS_PER_RUN = 10_000;

/** Maximum regex matches per pattern to prevent ReDoS */
const MAX_MATCHES_PER_PATTERN = 500;

// ---------------------------------------------------------------------------
// Confidence Scoring
// ---------------------------------------------------------------------------

/**
 * Map a numeric confidence (0–1) to a ConfidenceLevel.
 *   HIGH:   >= 0.85
 *   MEDIUM: >= 0.50
 *   LOW:    < 0.50
 */
export function toConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.85) return "HIGH";
  if (confidence >= 0.50) return "MEDIUM";
  return "LOW";
}

/**
 * Compute a confidence score for a set of matches.
 * Validated matches (IBAN checksum, Luhn) get a boost.
 */
function computeConfidence(
  type: "regex" | "keyword",
  matchCount: number,
  validated?: boolean,
): number {
  const baseConfidence = type === "regex" ? 0.75 : 0.6;
  const countBoost = Math.min(matchCount * 0.05, 0.2);
  const validationBoost = validated ? 0.15 : 0;
  return parseFloat(Math.min(baseConfidence + countBoost + validationBoost, 1.0).toFixed(2));
}

// ---------------------------------------------------------------------------
// Validation Algorithms
// ---------------------------------------------------------------------------

/**
 * IBAN checksum validation (ISO 7064 Mod 97-10).
 *
 * Steps:
 *   1. Remove spaces, uppercase
 *   2. Move first 4 characters to end
 *   3. Replace letters with digits (A=10..Z=35)
 *   4. Compute mod 97 — must equal 1
 */
export function validateIBAN(iban: string): boolean {
  const clean = iban.replace(/\s+/g, "").toUpperCase();
  if (clean.length < 5 || clean.length > 34) return false;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(clean)) return false;

  // Move first 4 chars to end
  const rearranged = clean.slice(4) + clean.slice(0, 4);

  // Replace letters with digits
  let numericStr = "";
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      numericStr += (code - 55).toString();
    } else {
      numericStr += char;
    }
  }

  // Mod 97 using chunked arithmetic (to avoid BigInt for compat)
  let remainder = 0;
  for (let i = 0; i < numericStr.length; i++) {
    remainder = (remainder * 10 + parseInt(numericStr[i], 10)) % 97;
  }

  return remainder === 1;
}

/**
 * Luhn algorithm for credit card number validation.
 *
 * Steps:
 *   1. Strip spaces and hyphens
 *   2. From right to left, double every second digit
 *   3. If doubled value > 9, subtract 9
 *   4. Sum all digits — must be divisible by 10
 */
export function validateLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(digits)) return false;

  let sum = 0;
  let alternate = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

// ---------------------------------------------------------------------------
// Central Masking Policy — maskPII()
// ---------------------------------------------------------------------------

/**
 * The central masking policy. Every PII type has a specific masking rule.
 * This is the ONLY function used to produce masked output.
 *
 * Rules:
 *   EMAIL:           keep first char of local + full domain   → t***@example.com
 *   PHONE:           keep prefix (4 chars) + last 2           → +491*****67
 *   ADDRESS:         first word + "***"                       → Musterstr. ***
 *   NAME:            first initial + "."                      → M. M.
 *   IBAN:            country code + "****" + last 4           → DE****3000
 *   CREDIT_CARD:     first 4 + "****" + last 4               → 4111 **** 1111
 *   BANK_ACCOUNT:    first 2 + "****" + last 2               → 12****90
 *   CUSTOMER_NUMBER: "CUST-****"                              → CUST-****
 *   TAX_ID:          first 2 + "****" + last 2               → 12****01
 *   ID_DOCUMENT:     first char + "****" + last 2             → C****47
 *   EMPLOYEE_ID:     "EMP-****"                               → EMP-****
 *   IP_ADDRESS:      first octet + ".***.***.***"             → 192.***.***.**
 *   DEVICE_ID:       first 4 + "****"                         → a1b2****
 *   KEYWORD:         bracketed lowercase                      → [diagnosis]
 *   DEFAULT:         middle redacted                          → ab****xy
 */
export function maskPII(value: string, piiType: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "***";

  switch (piiType) {
    case "EMAIL":
    case "EMAIL_ADDRESS":
      return maskEmail(trimmed);

    case "PHONE":
    case "PHONE_EU_INTERNATIONAL":
    case "PHONE_DE":
    case "PHONE_AT":
    case "PHONE_CH":
      return maskPhone(trimmed);

    case "ADDRESS":
    case "ADDRESS_DE":
    case "ADDRESS_GENERIC":
      return maskAddress(trimmed);

    case "NAME":
    case "NAME_FULL":
      return maskName(trimmed);

    case "IBAN":
    case "IBAN_DE":
    case "IBAN_AT":
    case "IBAN_CH":
    case "IBAN_EU_GENERIC":
      return maskIban(trimmed);

    case "CREDIT_CARD":
    case "CREDIT_CARD_VISA":
    case "CREDIT_CARD_MASTERCARD":
    case "CREDIT_CARD_AMEX":
      return maskCreditCard(trimmed);

    case "BANK_ACCOUNT":
    case "BANK_ACCOUNT_DE":
      return maskBankAccount(trimmed);

    case "CUSTOMER_NUMBER":
    case "CUSTOMER_NUMBER_GENERIC":
      return "CUST-****";

    case "TAX_ID":
    case "TAX_ID_DE":
      return maskTaxId(trimmed);

    case "ID_DOCUMENT":
    case "PASSPORT_DE":
    case "PASSPORT_AT":
    case "PASSPORT_GENERIC":
    case "SSN_DE":
    case "SSN_AT":
    case "SSN_GENERIC":
      return maskIdDocument(trimmed);

    case "EMPLOYEE_ID":
    case "EMPLOYEE_ID_GENERIC":
      return "EMP-****";

    case "IP_ADDRESS":
    case "IP_V4":
    case "IP_V6":
      return maskIpAddress(trimmed);

    case "DEVICE_ID":
    case "DEVICE_ID_GENERIC":
    case "MAC_ADDRESS":
      return maskDeviceId(trimmed);

    case "DOB":
    case "DOB_EU_FORMAT":
    case "DOB_ISO_FORMAT":
      return maskDob(trimmed);

    case "KEYWORD":
      return `[${trimmed.toLowerCase()}]`;

    default:
      return maskDefault(trimmed);
  }
}

// ---------------------------------------------------------------------------
// Masking helpers (internal)
// ---------------------------------------------------------------------------

function maskEmail(match: string): string {
  const [local, domain] = match.split("@");
  if (!local || !domain) return "***@***.***";
  const maskedLocal =
    local.length > 1
      ? local[0] + "*".repeat(local.length - 1)
      : "*";
  return `${maskedLocal}@${domain}`;
}

function maskPhone(match: string): string {
  return maskMiddle(match, 4, 2);
}

function maskAddress(match: string): string {
  const words = match.split(/\s+/);
  if (words.length <= 1) return "***";
  return words[0] + " ***";
}

function maskName(match: string): string {
  const parts = match.trim().split(/\s+/);
  return parts.map((p) => (p.length > 0 ? p[0] + "." : "")).join(" ");
}

function maskIban(match: string): string {
  const clean = match.replace(/\s+/g, "");
  if (clean.length <= 6) return "*".repeat(clean.length);
  const country = clean.slice(0, 2);
  const last4 = clean.slice(-4);
  const masked = "*".repeat(clean.length - 6);
  return `${country}${masked}${last4}`;
}

function maskCreditCard(match: string): string {
  const digits = match.replace(/[\s-]/g, "");
  if (digits.length <= 8) return "*".repeat(digits.length);
  const first4 = digits.slice(0, 4);
  const last4 = digits.slice(-4);
  const masked = "*".repeat(digits.length - 8);
  return `${first4} ${masked} ${last4}`;
}

function maskBankAccount(match: string): string {
  const digits = match.replace(/[\s-]/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return digits.slice(0, 2) + "*".repeat(digits.length - 4) + digits.slice(-2);
}

function maskTaxId(match: string): string {
  const digits = match.replace(/[\s/.-]/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return digits.slice(0, 2) + "*".repeat(digits.length - 4) + digits.slice(-2);
}

function maskIdDocument(match: string): string {
  const trimmed = match.trim();
  if (trimmed.length <= 3) return "*".repeat(trimmed.length);
  return trimmed[0] + "*".repeat(trimmed.length - 3) + trimmed.slice(-2);
}

function maskIpAddress(match: string): string {
  // IPv4
  if (match.includes(".")) {
    const parts = match.split(".");
    if (parts.length === 4) {
      return parts[0] + ".***.***." + parts[3];
    }
  }
  // IPv6 or other
  if (match.length > 8) {
    return match.slice(0, 4) + ":" + "****:****:****";
  }
  return maskDefault(match);
}

function maskDeviceId(match: string): string {
  if (match.length <= 4) return "*".repeat(match.length);
  return match.slice(0, 4) + "*".repeat(Math.min(match.length - 4, 8));
}

function maskDob(match: string): string {
  const parts = match.split(/[./-]/);
  if (parts.length === 3) {
    const last = parts[parts.length - 1].trim();
    if (/^\d{4}$/.test(last)) {
      return `**${match[2]}**${match[5]}${last}`;
    }
    const first = parts[0].trim();
    if (/^\d{4}$/.test(first)) {
      return `${first}${match[4]}**${match[7]}**`;
    }
  }
  return maskMiddle(match, 0, 4);
}

/**
 * Generic redaction: keep the first `keepStart` and last `keepEnd` characters,
 * replace everything in between with asterisks. Whitespace is preserved.
 */
function maskMiddle(
  value: string,
  keepStart: number = 2,
  keepEnd: number = 2,
): string {
  const trimmed = value.trim();
  if (trimmed.length <= keepStart + keepEnd) {
    return "*".repeat(trimmed.length);
  }
  const start = trimmed.slice(0, keepStart);
  const end = trimmed.slice(-keepEnd);
  const middle = trimmed.slice(keepStart, trimmed.length - keepEnd);
  const masked = middle.replace(/[^\s]/g, "*");
  return `${start}${masked}${end}`;
}

function maskDefault(value: string): string {
  return maskMiddle(value, 2, 2);
}

// ---------------------------------------------------------------------------
// PII Detection Patterns — Expanded Catalog
// ---------------------------------------------------------------------------

export const PII_PATTERNS: DetectionPattern[] = [
  // ---- IBAN (DE / AT / CH + generic EU) with checksum validation ----
  {
    name: "IBAN_DE",
    type: "regex",
    pattern: /\bDE\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2}\b/gi,
    category: "PAYMENT",
    isSpecial: false,
    validate: validateIBAN,
    redactSample: (m) => maskPII(m, "IBAN"),
  },
  {
    name: "IBAN_AT",
    type: "regex",
    pattern: /\bAT\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/gi,
    category: "PAYMENT",
    isSpecial: false,
    validate: validateIBAN,
    redactSample: (m) => maskPII(m, "IBAN"),
  },
  {
    name: "IBAN_CH",
    type: "regex",
    pattern: /\bCH\d{2}\s?\d{4}\s?\d{1}[A-Za-z0-9]{3}\s?[A-Za-z0-9]{4}\s?[A-Za-z0-9]{4}\s?[A-Za-z0-9]{1}\b/gi,
    category: "PAYMENT",
    isSpecial: false,
    validate: validateIBAN,
    redactSample: (m) => maskPII(m, "IBAN"),
  },
  {
    name: "IBAN_EU_GENERIC",
    type: "regex",
    pattern: /\b[A-Z]{2}\d{2}\s?[\dA-Za-z]{4}(?:\s?[\dA-Za-z]{4}){2,7}(?:\s?[\dA-Za-z]{1,4})?\b/g,
    category: "PAYMENT",
    isSpecial: false,
    validate: validateIBAN,
    redactSample: (m) => maskPII(m, "IBAN"),
  },

  // ---- Credit card numbers with Luhn validation ----
  {
    name: "CREDIT_CARD_VISA",
    type: "regex",
    pattern: /\b4\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    category: "PAYMENT",
    isSpecial: false,
    validate: validateLuhn,
    redactSample: (m) => maskPII(m, "CREDIT_CARD"),
  },
  {
    name: "CREDIT_CARD_MASTERCARD",
    type: "regex",
    pattern: /\b5[1-5]\d{2}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    category: "PAYMENT",
    isSpecial: false,
    validate: validateLuhn,
    redactSample: (m) => maskPII(m, "CREDIT_CARD"),
  },
  {
    name: "CREDIT_CARD_AMEX",
    type: "regex",
    pattern: /\b3[47]\d{2}[\s-]?\d{6}[\s-]?\d{5}\b/g,
    category: "PAYMENT",
    isSpecial: false,
    validate: validateLuhn,
    redactSample: (m) => maskPII(m, "CREDIT_CARD"),
  },

  // ---- Bank account numbers (German BLZ + account) ----
  {
    name: "BANK_ACCOUNT_DE",
    type: "regex",
    pattern: /\b\d{8}\s?\/?\s?\d{7,10}\b/g,
    category: "PAYMENT",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "BANK_ACCOUNT"),
  },

  // ---- Email addresses ----
  {
    name: "EMAIL_ADDRESS",
    type: "regex",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    category: "CONTACT",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "EMAIL"),
  },

  // ---- Phone numbers (EU formats) ----
  {
    name: "PHONE_EU_INTERNATIONAL",
    type: "regex",
    pattern: /\b\+?\d{1,3}[\s.-]?\(?\d{2,5}\)?[\s.-]?\d{3,4}[\s.-]?\d{2,4}[\s.-]?\d{0,4}\b/g,
    category: "CONTACT",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "PHONE"),
  },
  {
    name: "PHONE_DE",
    type: "regex",
    pattern: /\b(?:\+49|0049|0)\s?\(?\d{2,5}\)?[\s./-]?\d{3,8}[\s./-]?\d{0,5}\b/g,
    category: "CONTACT",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "PHONE"),
  },
  {
    name: "PHONE_AT",
    type: "regex",
    pattern: /\b(?:\+43|0043|0)\s?\(?\d{1,4}\)?[\s./-]?\d{3,10}\b/g,
    category: "CONTACT",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "PHONE"),
  },
  {
    name: "PHONE_CH",
    type: "regex",
    pattern: /\b(?:\+41|0041|0)\s?\(?\d{2}\)?[\s./-]?\d{3}[\s./-]?\d{2}[\s./-]?\d{2}\b/g,
    category: "CONTACT",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "PHONE"),
  },

  // ---- Address patterns ----
  {
    name: "ADDRESS_DE",
    type: "regex",
    // German: "Straßenname Nr, PLZ Ort" pattern
    pattern: /\b[A-ZÄÖÜ][a-zäöüß]+(?:straße|strasse|str\.|weg|platz|gasse|allee|ring|damm)\s+\d{1,4}[a-z]?\s*,?\s*\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+\b/g,
    category: "CONTACT",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "ADDRESS"),
  },
  {
    name: "ADDRESS_GENERIC",
    type: "regex",
    // Generic postal code + city (5 digit European PLZ)
    pattern: /\b\d{4,5}\s+[A-ZÄÖÜ][a-zäöüß]{2,}\b/g,
    category: "CONTACT",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "ADDRESS"),
  },

  // ---- Name patterns ----
  {
    name: "NAME_FULL",
    type: "regex",
    // Two or more capitalized words (common name pattern)
    // Only triggers with context keywords to reduce false positives
    pattern: /(?:(?:Herr|Frau|Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?)\s+)?[A-ZÄÖÜ][a-zäöüß]{1,30}\s+[A-ZÄÖÜ][a-zäöüß]{1,30}(?:\s+[A-ZÄÖÜ][a-zäöüß]{1,30})?/g,
    category: "IDENTIFICATION",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "NAME"),
  },

  // ---- German Tax ID (Steuerliche Identifikationsnummer, 11 digits) ----
  {
    name: "TAX_ID_DE",
    type: "regex",
    pattern: /\b\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/g,
    category: "IDENTIFICATION",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "TAX_ID"),
  },

  // ---- Customer numbers ----
  {
    name: "CUSTOMER_NUMBER_GENERIC",
    type: "regex",
    // Patterns like KNR-123456, KUND-789, CID-001234
    pattern: /\b(?:KNR|KUND|CID|CUST|KD)[-\s]?\d{4,12}\b/gi,
    category: "CONTRACT",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "CUSTOMER_NUMBER"),
  },

  // ---- Employee IDs ----
  {
    name: "EMPLOYEE_ID_GENERIC",
    type: "regex",
    // Patterns like EMP-001234, PNR-5678, MA-Nr. 12345
    pattern: /\b(?:EMP|PNR|MA[-\s]?Nr\.?)[-\s]?\d{3,10}\b/gi,
    category: "HR",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "EMPLOYEE_ID"),
  },

  // ---- Social Security Numbers ----
  {
    name: "SSN_DE",
    type: "regex",
    pattern: /\b\d{2}[0-3]\d[0-1]\d{2}[A-Za-z]\d{3}\b/g,
    category: "HR",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "ID_DOCUMENT"),
  },
  {
    name: "SSN_AT",
    type: "regex",
    pattern: /\b\d{4}\s?\d{2}[01]\d[0-3]\d\b/g,
    category: "HR",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "ID_DOCUMENT"),
  },
  {
    name: "SSN_GENERIC",
    type: "regex",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    category: "HR",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "ID_DOCUMENT"),
  },

  // ---- Passport numbers ----
  {
    name: "PASSPORT_DE",
    type: "regex",
    pattern: /\b[Cc][A-Za-z0-9]{8}\b/g,
    category: "IDENTIFICATION",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "ID_DOCUMENT"),
  },
  {
    name: "PASSPORT_AT",
    type: "regex",
    pattern: /\b[A-Za-z]\d{7}\b/g,
    category: "IDENTIFICATION",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "ID_DOCUMENT"),
  },
  {
    name: "PASSPORT_GENERIC",
    type: "regex",
    pattern: /\b[A-Za-z]{1,2}\d{6,8}\b/g,
    category: "IDENTIFICATION",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "ID_DOCUMENT"),
  },

  // ---- Date of birth patterns ----
  {
    name: "DOB_EU_FORMAT",
    type: "regex",
    pattern: /\b(0[1-9]|[12]\d|3[01])[./-](0[1-9]|1[0-2])[./-](19|20)\d{2}\b/g,
    category: "IDENTIFICATION",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "DOB"),
  },
  {
    name: "DOB_ISO_FORMAT",
    type: "regex",
    pattern: /\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g,
    category: "IDENTIFICATION",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "DOB"),
  },

  // ---- IP Addresses ----
  {
    name: "IP_V4",
    type: "regex",
    pattern: /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    category: "ONLINE_TECHNICAL",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "IP_ADDRESS"),
  },
  {
    name: "IP_V6",
    type: "regex",
    pattern: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    category: "ONLINE_TECHNICAL",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "IP_ADDRESS"),
  },

  // ---- Device identifiers ----
  {
    name: "MAC_ADDRESS",
    type: "regex",
    pattern: /\b([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g,
    category: "ONLINE_TECHNICAL",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "DEVICE_ID"),
  },
  {
    name: "DEVICE_ID_GENERIC",
    type: "regex",
    // UUID-like device identifiers
    pattern: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
    category: "ONLINE_TECHNICAL",
    isSpecial: false,
    redactSample: (m) => maskPII(m, "DEVICE_ID"),
  },
];

// ---------------------------------------------------------------------------
// Art. 9 Special Category Detection (keyword-based)
// ---------------------------------------------------------------------------

function buildKeywordPattern(keywords: string[]): RegExp {
  const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "gi");
}

const HEALTH_KEYWORDS = [
  "medical", "diagnosis", "diagnose", "treatment", "prescription",
  "doctor", "hospital", "disability", "allergy", "allergies",
  "medication", "medicine", "patient", "clinical", "therapy",
  "chronic", "symptom", "symptoms", "surgery", "vaccination",
  "vaccine", "blood type", "health insurance", "health record",
  "mental health", "psychiatric", "psychotherapy", "illness", "disease",
  "Krankheit", "Diagnose", "Behandlung", "Rezept", "Arzt",
  "Krankenhaus", "Behinderung", "Allergie", "Medikament", "Patient",
  "Therapie", "Impfung", "Krankenversicherung", "Gesundheit",
];

const BIOMETRIC_KEYWORDS = [
  "biometric", "fingerprint", "retina scan", "iris scan",
  "facial recognition", "face id", "voice recognition", "voiceprint",
  "palm print", "dna", "genetic",
  "biometrisch", "Fingerabdruck", "Gesichtserkennung", "genetisch",
];

const POLITICAL_KEYWORDS = [
  "political opinion", "political party", "political affiliation",
  "political belief", "party member", "party membership",
  "politische Meinung", "Parteimitglied", "Parteimitgliedschaft",
  "politische Zugehoerigkeit",
];

const RELIGIOUS_KEYWORDS = [
  "religious belief", "religion", "religious affiliation",
  "church membership", "faith", "denomination", "church tax",
  "Kirchensteuer", "Religionszugehoerigkeit", "Konfession",
  "Glaubensbekenntnis", "Kirchenmitgliedschaft",
];

const TRADE_UNION_KEYWORDS = [
  "trade union", "union membership", "labor union",
  "trade union membership", "works council",
  "Gewerkschaft", "Gewerkschaftsmitgliedschaft", "Betriebsrat",
];

const ETHNIC_KEYWORDS = [
  "ethnic origin", "ethnicity", "racial origin", "race",
  "ethnic background", "ethnische Herkunft", "Rasse", "rassische Herkunft",
];

const SEXUAL_ORIENTATION_KEYWORDS = [
  "sexual orientation", "sexual preference",
  "sexuelle Orientierung", "geschlechtliche Identitaet", "gender identity",
];

const CRIMINAL_KEYWORDS = [
  "criminal conviction", "criminal record", "criminal offence",
  "criminal offense", "penal record", "police record",
  "conviction", "court ruling",
  "Strafregister", "Vorstrafe", "strafrechtliche Verurteilung",
  "Fuehrungszeugnis",
];

interface Art9CategoryDef {
  name: string;
  category: DataCategoryType;
  isSpecial: boolean;
  keywords: string[];
}

const ART9_CATEGORIES: Art9CategoryDef[] = [
  { name: "HEALTH_DATA", category: "HEALTH", isSpecial: true, keywords: HEALTH_KEYWORDS },
  { name: "BIOMETRIC_DATA", category: "OTHER_SPECIAL_CATEGORY", isSpecial: true, keywords: BIOMETRIC_KEYWORDS },
  { name: "POLITICAL_OPINIONS", category: "POLITICAL_OPINION", isSpecial: true, keywords: POLITICAL_KEYWORDS },
  { name: "RELIGIOUS_BELIEFS", category: "RELIGION", isSpecial: true, keywords: RELIGIOUS_KEYWORDS },
  { name: "TRADE_UNION_MEMBERSHIP", category: "UNION", isSpecial: true, keywords: TRADE_UNION_KEYWORDS },
  { name: "ETHNIC_ORIGIN", category: "OTHER_SPECIAL_CATEGORY", isSpecial: true, keywords: ETHNIC_KEYWORDS },
  { name: "SEXUAL_ORIENTATION", category: "OTHER_SPECIAL_CATEGORY", isSpecial: true, keywords: SEXUAL_ORIENTATION_KEYWORDS },
  { name: "CRIMINAL_CONVICTIONS", category: "OTHER_SPECIAL_CATEGORY", isSpecial: true, keywords: CRIMINAL_KEYWORDS },
];

export const ART9_KEYWORDS: DetectionPattern[] = ART9_CATEGORIES.map(
  ({ name, category, isSpecial: isSpecialFlag, keywords }) => ({
    name: `ART9_${name}`,
    type: "keyword" as const,
    pattern: buildKeywordPattern(keywords),
    category,
    isSpecial: isSpecialFlag,
    redactSample: (m: string) => maskPII(m, "KEYWORD"),
  }),
);

// ---------------------------------------------------------------------------
// Third-Party Data Heuristics
// ---------------------------------------------------------------------------

/**
 * Keywords that suggest the text refers to a DIFFERENT person than
 * the data subject. If these appear near PII, the finding is flagged
 * as potentially containing third-party data.
 */
const THIRD_PARTY_INDICATORS = [
  "spouse", "partner", "child", "parent", "guardian",
  "emergency contact", "next of kin", "beneficiary",
  "dependent", "relative", "family member",
  "Ehepartner", "Ehepartnerin", "Kind", "Elternteil",
  "Notfallkontakt", "Angehoerige", "Angehöriger",
  "Begünstigter", "Begünstigte",
];

const THIRD_PARTY_PATTERN = buildKeywordPattern(THIRD_PARTY_INDICATORS);

/**
 * Check whether text contains indicators of third-party personal data.
 */
export function detectThirdPartyData(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const regex = new RegExp(THIRD_PARTY_PATTERN.source, THIRD_PARTY_PATTERN.flags);
  return regex.test(text);
}

// ---------------------------------------------------------------------------
// Internal: run a single pattern and collect raw match data
// ---------------------------------------------------------------------------

interface RawPatternMatch {
  patternName: string;
  type: "regex" | "keyword";
  category: DataCategoryType;
  isSpecial: boolean;
  matches: Array<{
    text: string;
    start: number;
    end: number;
    validated?: boolean;
  }>;
  redactSample: (match: string) => string;
  validatedCount: number;
  totalCount: number;
}

/**
 * Run a single detection pattern against a text and return raw match info.
 * Applies validation (e.g. Luhn, IBAN checksum) if the pattern has a
 * validate function. Invalid matches are excluded.
 */
function runPatternRaw(
  text: string,
  dp: DetectionPattern,
): RawPatternMatch | null {
  const regex = new RegExp(dp.pattern.source, dp.pattern.flags);
  const matches: Array<{ text: string; start: number; end: number; validated?: boolean }> = [];
  let m: RegExpExecArray | null;
  let iterCount = 0;

  while ((m = regex.exec(text)) !== null) {
    iterCount++;
    if (iterCount > MAX_MATCHES_PER_PATTERN) break;

    const matchText = m[0];
    let validated: boolean | undefined = undefined;

    // Apply validation if available
    if (dp.validate) {
      validated = dp.validate(matchText);
      if (!validated) {
        // Skip invalid matches for patterns with validators
        if (m[0].length === 0) regex.lastIndex += 1;
        continue;
      }
    }

    matches.push({
      text: matchText,
      start: m.index,
      end: m.index + matchText.length,
      validated,
    });

    if (m[0].length === 0) {
      regex.lastIndex += 1;
    }
  }

  if (matches.length === 0) return null;

  const validatedCount = matches.filter((m) => m.validated === true).length;

  return {
    patternName: dp.name,
    type: dp.type,
    category: dp.category,
    isSpecial: dp.isSpecial,
    matches,
    redactSample: dp.redactSample,
    validatedCount,
    totalCount: matches.length,
  };
}

// ---------------------------------------------------------------------------
// Core detection functions
// ---------------------------------------------------------------------------

/**
 * Build a DetectionResult from raw pattern matches for a single detector type.
 */
function buildDetectionResult(
  detectorType: DetectorType,
  rawMatches: RawPatternMatch[],
): DetectionResult {
  const detectedElements: DetectionResult["detectedElements"] = [];
  const categoryMap = new Map<DataCategoryType, { totalConfidence: number; count: number }>();
  let containsSpecial = false;

  for (const raw of rawMatches) {
    const hasValidation = raw.matches.some((m) => m.validated !== undefined);
    const confidence = computeConfidence(
      raw.type,
      raw.matches.length,
      hasValidation ? raw.validatedCount > 0 : undefined,
    );
    const confidenceLevel = toConfidenceLevel(confidence);

    for (const match of raw.matches) {
      detectedElements.push({
        elementType: raw.patternName,
        confidence,
        confidenceLevel,
        snippetPreview: raw.redactSample(match.text),
        offsets: { start: match.start, end: match.end },
        validated: match.validated,
      });
    }

    const existing = categoryMap.get(raw.category);
    if (!existing || confidence > existing.totalConfidence) {
      categoryMap.set(raw.category, { totalConfidence: confidence, count: (existing?.count ?? 0) + raw.matches.length });
    }

    if (raw.isSpecial) {
      containsSpecial = true;
    }
  }

  const detectedCategories: DetectionResult["detectedCategories"] = [];
  categoryMap.forEach((info, category) => {
    detectedCategories.push({
      category,
      confidence: info.totalConfidence,
      confidenceLevel: toConfidenceLevel(info.totalConfidence),
    });
  });

  detectedCategories.sort((a, b) => b.confidence - a.confidence);

  return {
    detectorType,
    detectedElements,
    detectedCategories,
    containsSpecialCategorySuspected: containsSpecial,
  };
}

/**
 * Detect PII patterns (non-Art. 9) in the given text.
 */
function detectPIIRaw(text: string): RawPatternMatch[] {
  if (!text || typeof text !== "string") return [];
  const results: RawPatternMatch[] = [];
  for (const pattern of PII_PATTERNS) {
    const result = runPatternRaw(text, pattern);
    if (result) results.push(result);
  }
  return results;
}

/**
 * Detect Art. 9 special-category keywords in the given text.
 */
function detectArt9Raw(text: string): RawPatternMatch[] {
  if (!text || typeof text !== "string") return [];
  const results: RawPatternMatch[] = [];
  for (const pattern of ART9_KEYWORDS) {
    const result = runPatternRaw(text, pattern);
    if (result) results.push(result);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Step A: Metadata Classification
// ---------------------------------------------------------------------------

/**
 * Step A — Classify an evidence item based solely on its metadata
 * (file name, MIME type, provider, etc.). No content scanning.
 */
export function runMetadataClassification(input: DetectionInput): DetectionResult | null {
  const elements: DetectionResult["detectedElements"] = [];
  const categoryMap = new Map<DataCategoryType, number>();

  // Classify by MIME type
  if (input.mimeType) {
    const mime = input.mimeType.toLowerCase();
    if (mime.includes("pdf") || mime.includes("document")) {
      addCategoryHit(categoryMap, "COMMUNICATION", 0.3);
    }
    if (mime.includes("image")) {
      addCategoryHit(categoryMap, "OTHER", 0.2);
    }
    if (mime.includes("spreadsheet") || mime.includes("csv")) {
      addCategoryHit(categoryMap, "CONTRACT", 0.3);
    }
  }

  // Classify by file name keywords
  if (input.fileName) {
    const fn = input.fileName.toLowerCase();
    const fileNameRules: Array<{ keywords: string[]; category: DataCategoryType; confidence: number }> = [
      { keywords: ["invoice", "rechnung", "billing"], category: "PAYMENT", confidence: 0.5 },
      { keywords: ["contract", "vertrag", "agreement"], category: "CONTRACT", confidence: 0.5 },
      { keywords: ["payroll", "gehalt", "salary", "lohn"], category: "HR", confidence: 0.5 },
      { keywords: ["medical", "health", "arzt", "patient"], category: "HEALTH", confidence: 0.6 },
      { keywords: ["resume", "cv", "lebenslauf", "bewerbung"], category: "HR", confidence: 0.5 },
      { keywords: ["passport", "ausweis", "id card"], category: "IDENTIFICATION", confidence: 0.6 },
      { keywords: ["tax", "steuer", "steuerbescheid"], category: "IDENTIFICATION", confidence: 0.5 },
    ];

    for (const rule of fileNameRules) {
      for (const keyword of rule.keywords) {
        if (fn.includes(keyword)) {
          addCategoryHit(categoryMap, rule.category, rule.confidence);
          elements.push({
            elementType: `METADATA_FILENAME_${rule.category}`,
            confidence: rule.confidence,
            confidenceLevel: toConfidenceLevel(rule.confidence),
            snippetPreview: `[filename contains: ${keyword}]`,
          });
        }
      }
    }
  }

  // Classify by provider
  if (input.provider) {
    const providerCategoryMap: Record<string, DataCategoryType> = {
      EXCHANGE_ONLINE: "COMMUNICATION",
      WORKDAY: "HR",
      SAP_SUCCESSFACTORS: "HR",
      SALESFORCE: "CONTRACT",
    };
    const providerCategory = providerCategoryMap[input.provider];
    if (providerCategory) {
      addCategoryHit(categoryMap, providerCategory, 0.3);
    }
  }

  if (elements.length === 0 && categoryMap.size === 0) return null;

  const detectedCategories: DetectionResult["detectedCategories"] = [];
  categoryMap.forEach((confidence, category) => {
    detectedCategories.push({
      category,
      confidence,
      confidenceLevel: toConfidenceLevel(confidence),
    });
  });

  let containsSpecial = false;
  for (const dc of detectedCategories) {
    if (SPECIAL_CATEGORIES.has(dc.category)) {
      containsSpecial = true;
      break;
    }
  }

  return {
    detectorType: "METADATA",
    detectedElements: elements,
    detectedCategories,
    containsSpecialCategorySuspected: containsSpecial,
  };
}

function addCategoryHit(
  map: Map<DataCategoryType, number>,
  category: DataCategoryType,
  confidence: number,
): void {
  const existing = map.get(category) ?? 0;
  map.set(category, Math.max(existing, confidence));
}

// ---------------------------------------------------------------------------
// Step B: RegEx / Keyword Detection (existing, refactored)
// ---------------------------------------------------------------------------

/**
 * Step B — Run all regex and keyword detectors on text content.
 * Enforces text length limit for performance safety.
 */
export function runRegexDetection(
  text: string,
  maxLength?: number,
): DetectionResult[] {
  if (!text || typeof text !== "string") return [];

  const limit = maxLength ?? MAX_TEXT_SCAN_LENGTH;
  const scanText = text.length > limit ? text.slice(0, limit) : text;

  const results: DetectionResult[] = [];

  const piiRaw = detectPIIRaw(scanText);
  if (piiRaw.length > 0) {
    results.push(buildDetectionResult("REGEX", piiRaw));
  }

  const art9Raw = detectArt9Raw(scanText);
  if (art9Raw.length > 0) {
    results.push(buildDetectionResult("REGEX", art9Raw));
  }

  return results;
}

// ---------------------------------------------------------------------------
// Step C: PDF Metadata Extraction
// ---------------------------------------------------------------------------

/**
 * Step C — Extract PII from PDF metadata fields (author, title, etc.)
 * and run regex detectors on the extracted strings.
 */
export function runPdfMetadataDetection(buffer: Buffer): DetectionResult | null {
  const metadata = extractPdfMetadata(buffer);
  const textParts: string[] = [];

  if (metadata.author) textParts.push(metadata.author);
  if (metadata.title) textParts.push(metadata.title);
  if (metadata.subject) textParts.push(metadata.subject);
  if (metadata.creator) textParts.push(metadata.creator);

  if (textParts.length === 0) return null;

  const combinedText = textParts.join(" ");
  const piiRaw = detectPIIRaw(combinedText);

  if (piiRaw.length === 0) return null;

  return buildDetectionResult("PDF_METADATA", piiRaw);
}

// ---------------------------------------------------------------------------
// Step D: OCR (stub — requires external integration)
// ---------------------------------------------------------------------------

/**
 * Step D — OCR extraction. This is a stub that returns null.
 * In production, integrate with an OCR service (e.g. Tesseract, Azure Vision).
 * OCR requires explicit opt-in via DetectionPipelineConfig.enableOcr.
 */
export function runOcrDetection(_buffer: Buffer): DetectionResult | null {
  // OCR integration point — returns null in current implementation
  return null;
}

// ---------------------------------------------------------------------------
// Step E: LLM Classifier (stub — requires external integration)
// ---------------------------------------------------------------------------

/**
 * Step E — LLM-based classification. This is a stub that returns null.
 * In production, integrate with a privacy-focused LLM classifier.
 * LLM classification requires explicit opt-in via DetectionPipelineConfig.enableLlm.
 */
export function runLlmClassification(_text: string): DetectionResult | null {
  // LLM integration point — returns null in current implementation
  return null;
}

// ---------------------------------------------------------------------------
// Full Pipeline Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the complete 5-step detection pipeline for a single evidence item.
 *
 * Steps:
 *   A) Metadata classification (always runs)
 *   B) RegEx/keyword detection (runs when text available and mode >= CONTENT_SCAN)
 *   C) PDF metadata extraction (runs when PDF buffer available)
 *   D) OCR (optional, requires enableOcr=true)
 *   E) LLM classifier (optional, requires enableLlm=true)
 *
 * Privacy-by-design: In METADATA_ONLY mode, only Steps A and C run.
 * Content scanning (Step B) requires CONTENT_SCAN or FULL_CONTENT mode.
 */
export function runDetectionPipeline(
  input: DetectionInput,
  config?: DetectionPipelineConfig,
): DetectionPipelineResult {
  const contentHandling = config?.contentHandling ?? "METADATA_ONLY";
  const results: DetectionResult[] = [];

  // Step A: Metadata Classification (always runs)
  const metadataResult = runMetadataClassification(input);
  if (metadataResult) {
    results.push(metadataResult);
  }

  // Step B: RegEx / Keyword Detection (only with content scanning permission)
  if (
    input.text &&
    (contentHandling === "CONTENT_SCAN" || contentHandling === "FULL_CONTENT")
  ) {
    const regexResults = runRegexDetection(input.text, config?.maxTextLength);
    results.push(...regexResults);
  }

  // Step C: PDF Metadata Extraction (always runs when PDF buffer available)
  if (input.pdfBuffer) {
    const pdfResult = runPdfMetadataDetection(input.pdfBuffer);
    if (pdfResult) {
      results.push(pdfResult);
    }
  }

  // Step D: OCR (optional)
  if (config?.enableOcr && input.pdfBuffer) {
    const ocrResult = runOcrDetection(input.pdfBuffer);
    if (ocrResult) {
      results.push(ocrResult);
    }
  }

  // Step E: LLM Classifier (optional)
  if (config?.enableLlm && input.text) {
    const llmResult = runLlmClassification(input.text);
    if (llmResult) {
      results.push(llmResult);
    }
  }

  // Aggregate results
  const containsSpecial = hasSpecialCategory(results);
  const specialCats = getSpecialCategories(results);
  const allCats = classifyFindings(results);

  // Third-party data heuristic
  let thirdPartyDataSuspected = false;
  if (input.text && (contentHandling === "CONTENT_SCAN" || contentHandling === "FULL_CONTENT")) {
    thirdPartyDataSuspected = detectThirdPartyData(input.text);
  }

  return {
    results,
    containsSpecialCategory: containsSpecial,
    specialCategories: specialCats,
    allCategories: allCats,
    thirdPartyDataSuspected,
    contentHandlingApplied: contentHandling,
  };
}

// ---------------------------------------------------------------------------
// Legacy API (backward compatible)
// ---------------------------------------------------------------------------

/**
 * Run all detectors (PII regex + Art. 9 keywords) against the given text.
 * This is the legacy API — prefer `runDetectionPipeline()` for new code.
 */
export function runAllDetectors(text: string): DetectionResult[] {
  return runRegexDetection(text);
}

/**
 * Returns true if any result indicates Art. 9 special-category data is suspected.
 */
export function hasSpecialCategory(results: DetectionResult[]): boolean {
  return results.some((r) => r.containsSpecialCategorySuspected);
}

/**
 * Return the distinct Art. 9 special-category types found across all results.
 */
export function getSpecialCategories(results: DetectionResult[]): DataCategoryType[] {
  const specialCats = new Set<DataCategoryType>();
  for (const r of results) {
    for (const dc of r.detectedCategories) {
      if (isSpecialCategory(dc.category)) {
        specialCats.add(dc.category);
      }
    }
  }
  return Array.from(specialCats);
}

/**
 * Extract the unique GDPR data categories from a set of detection results.
 */
export function classifyFindings(results: DetectionResult[]): DataCategoryType[] {
  const categories = new Set<DataCategoryType>();
  for (const r of results) {
    for (const dc of r.detectedCategories) {
      categories.add(dc.category);
    }
  }
  return Array.from(categories);
}

// ---------------------------------------------------------------------------
// Data Category Mapping
// ---------------------------------------------------------------------------

/**
 * Map a detected element type to its GDPR data category.
 * Used when individual elements need to be re-categorized.
 */
export function mapElementToCategory(elementType: string): DataCategoryType {
  const mapping: Record<string, DataCategoryType> = {
    // Contact
    EMAIL_ADDRESS: "CONTACT",
    PHONE_EU_INTERNATIONAL: "CONTACT",
    PHONE_DE: "CONTACT",
    PHONE_AT: "CONTACT",
    PHONE_CH: "CONTACT",
    ADDRESS_DE: "CONTACT",
    ADDRESS_GENERIC: "CONTACT",

    // Payment
    IBAN_DE: "PAYMENT",
    IBAN_AT: "PAYMENT",
    IBAN_CH: "PAYMENT",
    IBAN_EU_GENERIC: "PAYMENT",
    CREDIT_CARD_VISA: "PAYMENT",
    CREDIT_CARD_MASTERCARD: "PAYMENT",
    CREDIT_CARD_AMEX: "PAYMENT",
    BANK_ACCOUNT_DE: "PAYMENT",

    // Identification
    TAX_ID_DE: "IDENTIFICATION",
    PASSPORT_DE: "IDENTIFICATION",
    PASSPORT_AT: "IDENTIFICATION",
    PASSPORT_GENERIC: "IDENTIFICATION",
    DOB_EU_FORMAT: "IDENTIFICATION",
    DOB_ISO_FORMAT: "IDENTIFICATION",
    NAME_FULL: "IDENTIFICATION",

    // HR
    SSN_DE: "HR",
    SSN_AT: "HR",
    SSN_GENERIC: "HR",
    EMPLOYEE_ID_GENERIC: "HR",

    // Contract
    CUSTOMER_NUMBER_GENERIC: "CONTRACT",

    // Online / Technical
    IP_V4: "ONLINE_TECHNICAL",
    IP_V6: "ONLINE_TECHNICAL",
    MAC_ADDRESS: "ONLINE_TECHNICAL",
    DEVICE_ID_GENERIC: "ONLINE_TECHNICAL",

    // Art. 9 Special Categories
    ART9_HEALTH_DATA: "HEALTH",
    ART9_BIOMETRIC_DATA: "OTHER_SPECIAL_CATEGORY",
    ART9_POLITICAL_OPINIONS: "POLITICAL_OPINION",
    ART9_RELIGIOUS_BELIEFS: "RELIGION",
    ART9_TRADE_UNION_MEMBERSHIP: "UNION",
    ART9_ETHNIC_ORIGIN: "OTHER_SPECIAL_CATEGORY",
    ART9_SEXUAL_ORIENTATION: "OTHER_SPECIAL_CATEGORY",
    ART9_CRIMINAL_CONVICTIONS: "OTHER_SPECIAL_CATEGORY",
  };

  return mapping[elementType] ?? "OTHER";
}

// ---------------------------------------------------------------------------
// PDF Metadata Extraction
// ---------------------------------------------------------------------------

/**
 * Extract metadata from a PDF buffer by scanning its raw text for the
 * standard Info dictionary keys. Lightweight, no external dependencies.
 */
export function extractPdfMetadata(buffer: Buffer): PdfMetadata {
  const raw = buffer.toString("latin1");
  const metadata: PdfMetadata = {};

  const extract = (key: string): string | undefined => {
    const parenRegex = new RegExp(`/${key}\\s*\\(([^)]{0,512})\\)`, "i");
    const parenMatch = raw.match(parenRegex);
    if (parenMatch) return parenMatch[1].trim();

    const hexRegex = new RegExp(`/${key}\\s*<([0-9A-Fa-f]{2,1024})>`, "i");
    const hexMatch = raw.match(hexRegex);
    if (hexMatch) {
      try {
        const hex = hexMatch[1];
        const clean = hex.startsWith("FEFF") ? hex.slice(4) : hex;
        let decoded = "";
        for (let i = 0; i < clean.length; i += 4) {
          const code = parseInt(clean.slice(i, i + 4), 16);
          if (!isNaN(code) && code > 0) decoded += String.fromCharCode(code);
        }
        return decoded.trim() || undefined;
      } catch {
        return undefined;
      }
    }

    return undefined;
  };

  metadata.title = extract("Title");
  metadata.author = extract("Author");
  metadata.subject = extract("Subject");
  metadata.creator = extract("Creator");
  metadata.producer = extract("Producer");
  metadata.creationDate = extract("CreationDate");
  metadata.modDate = extract("ModDate");

  const pageMatches = raw.match(/\/Type\s*\/Page(?!s)\b/g);
  if (pageMatches) {
    metadata.pageCount = pageMatches.length;
  }

  return metadata;
}

// ---------------------------------------------------------------------------
// Output Artifacts
// ---------------------------------------------------------------------------

/**
 * Generate an Evidence Index CSV string from detection results.
 *
 * Columns: EvidenceItemId, Provider, Location, ElementType, Category,
 *          Confidence, ConfidenceLevel, Validated, SpecialCategory, MaskedPreview
 */
export function generateEvidenceIndexCSV(
  items: Array<{
    evidenceItemId: string;
    provider: string;
    location: string;
    results: DetectionResult[];
  }>,
): string {
  const header = [
    "EvidenceItemId",
    "Provider",
    "Location",
    "DetectorType",
    "ElementType",
    "Category",
    "Confidence",
    "ConfidenceLevel",
    "Validated",
    "SpecialCategory",
    "MaskedPreview",
  ].join(",");

  const rows: string[] = [header];

  for (const item of items) {
    for (const result of item.results) {
      for (const element of result.detectedElements) {
        const category = mapElementToCategory(element.elementType);
        const isSpecial = isSpecialCategory(category);
        const row = [
          csvEscape(item.evidenceItemId),
          csvEscape(item.provider),
          csvEscape(item.location),
          csvEscape(result.detectorType),
          csvEscape(element.elementType),
          csvEscape(category),
          element.confidence.toFixed(2),
          element.confidenceLevel,
          element.validated !== undefined ? String(element.validated) : "",
          isSpecial ? "YES" : "NO",
          csvEscape(element.snippetPreview ?? ""),
        ].join(",");
        rows.push(row);
      }
    }
  }

  return rows.join("\n");
}

/**
 * Generate a Findings Summary JSON structure from detection results.
 */
export function generateFindingsSummaryJSON(
  items: Array<{
    evidenceItemId: string;
    provider: string;
    results: DetectionResult[];
  }>,
): {
  totalItems: number;
  totalElements: number;
  categoryCounts: Record<string, number>;
  specialCategoryDetected: boolean;
  specialCategories: string[];
  thirdPartyDataSuspected: boolean;
  detectorTypeCounts: Record<string, number>;
  confidenceDistribution: { HIGH: number; MEDIUM: number; LOW: number };
} {
  let totalElements = 0;
  const categoryCounts: Record<string, number> = {};
  const detectorTypeCounts: Record<string, number> = {};
  const confidenceDistribution = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const specialCats = new Set<string>();
  let specialCategoryDetected = false;

  for (const item of items) {
    for (const result of item.results) {
      detectorTypeCounts[result.detectorType] = (detectorTypeCounts[result.detectorType] ?? 0) + 1;

      for (const element of result.detectedElements) {
        totalElements++;
        const category = mapElementToCategory(element.elementType);
        categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
        confidenceDistribution[element.confidenceLevel]++;

        if (isSpecialCategory(category)) {
          specialCategoryDetected = true;
          specialCats.add(category);
        }
      }
    }
  }

  return {
    totalItems: items.length,
    totalElements,
    categoryCounts,
    specialCategoryDetected,
    specialCategories: Array.from(specialCats),
    thirdPartyDataSuspected: false,
    detectorTypeCounts,
    confidenceDistribution,
  };
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
