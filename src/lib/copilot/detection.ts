/**
 * Detection Service — DSAR Privacy Copilot
 *
 * Provides regex-based PII detection, GDPR data-category classification,
 * Art. 9 special-category keyword detection, and basic PDF metadata
 * extraction. All sample output is redacted before it leaves this module.
 *
 * Updated to match the expanded DataCategory enum and DetectorResult schema.
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
  /** Return a redacted representation of the match (e.g. "DE89 **** **** 0000") */
  redactSample: (match: string) => string;
}

/**
 * Matches the DetectorResult model in the Prisma schema.
 *
 * Each DetectionResult represents the output of one detector type run
 * against a piece of evidence. It aggregates detected elements (individual
 * matches) and detected categories (GDPR data categories found).
 */
export interface DetectionResult {
  detectorType: string; // "REGEX" | "PDF_METADATA" | "OCR" | "LLM_CLASSIFIER"
  detectedElements: Array<{
    elementType: string;
    confidence: number;
    snippetPreview: string | null; // Redacted/truncated
    offsets?: { start: number; end: number };
  }>;
  detectedCategories: Array<{
    category: DataCategoryType;
    confidence: number;
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

// ---------------------------------------------------------------------------
// Redaction helpers
// ---------------------------------------------------------------------------

/**
 * Generic redaction: keep the first `keepStart` and last `keepEnd` characters,
 * replace everything in between with asterisks. Whitespace in the middle is
 * preserved to maintain format readability.
 */
function redactMiddle(
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

/** Redact an IBAN — keep country code + last 4 */
function redactIban(match: string): string {
  const clean = match.replace(/\s+/g, "");
  if (clean.length <= 6) return "*".repeat(clean.length);
  const country = clean.slice(0, 2);
  const last4 = clean.slice(-4);
  const masked = "*".repeat(clean.length - 6);
  return `${country}${masked}${last4}`;
}

/** Redact a credit card number — keep first 4 and last 4 */
function redactCreditCard(match: string): string {
  const digits = match.replace(/[\s-]/g, "");
  if (digits.length <= 8) return "*".repeat(digits.length);
  const first4 = digits.slice(0, 4);
  const last4 = digits.slice(-4);
  const masked = "*".repeat(digits.length - 8);
  return `${first4} ${masked} ${last4}`;
}

/** Redact an email — keep first char of local part and domain */
function redactEmail(match: string): string {
  const [local, domain] = match.split("@");
  if (!local || !domain) return "***@***.***";
  const maskedLocal =
    local.length > 1
      ? local[0] + "*".repeat(local.length - 1)
      : "*";
  return `${maskedLocal}@${domain}`;
}

/** Redact a phone number — keep country code area (first 3-4 chars) + last 2 */
function redactPhone(match: string): string {
  return redactMiddle(match, 4, 2);
}

/** Redact a German tax ID — keep first 2 and last 2 digits */
function redactTaxId(match: string): string {
  const digits = match.replace(/[\s/.-]/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return digits.slice(0, 2) + "*".repeat(digits.length - 4) + digits.slice(-2);
}

/** Redact a social security number — keep last 4 */
function redactSSN(match: string): string {
  const digits = match.replace(/[\s-]/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return "*".repeat(digits.length - 4) + digits.slice(-4);
}

/** Redact a passport number — keep first letter + last 2 */
function redactPassport(match: string): string {
  return redactMiddle(match.trim(), 1, 2);
}

/** Redact a date of birth — keep the year portion */
function redactDob(match: string): string {
  // Try to detect year at end (DD.MM.YYYY or DD/MM/YYYY)
  const parts = match.split(/[./-]/);
  if (parts.length === 3) {
    // If year is last and 4 digits
    const last = parts[parts.length - 1].trim();
    if (/^\d{4}$/.test(last)) {
      return `**${match[2]}**${match[5]}${last}`;
    }
    // If year is first (YYYY-MM-DD)
    const first = parts[0].trim();
    if (/^\d{4}$/.test(first)) {
      return `${first}${match[4]}**${match[7]}**`;
    }
  }
  return redactMiddle(match, 0, 4);
}

/** Redact a keyword match — return the keyword itself (no PII to mask) */
function redactKeyword(match: string): string {
  return `[${match.trim().toLowerCase()}]`;
}

// ---------------------------------------------------------------------------
// PII Detection Patterns
// ---------------------------------------------------------------------------

export const PII_PATTERNS: DetectionPattern[] = [
  // ---- IBAN (DE / AT / CH + generic EU) ----
  {
    name: "IBAN_DE",
    type: "regex",
    pattern: /\bDE\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2}\b/gi,
    category: "PAYMENT",
    isSpecial: false,
    redactSample: redactIban,
  },
  {
    name: "IBAN_AT",
    type: "regex",
    pattern: /\bAT\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/gi,
    category: "PAYMENT",
    isSpecial: false,
    redactSample: redactIban,
  },
  {
    name: "IBAN_CH",
    type: "regex",
    pattern: /\bCH\d{2}\s?\d{4}\s?\d{1}[A-Za-z0-9]{3}\s?[A-Za-z0-9]{4}\s?[A-Za-z0-9]{4}\s?[A-Za-z0-9]{1}\b/gi,
    category: "PAYMENT",
    isSpecial: false,
    redactSample: redactIban,
  },
  {
    name: "IBAN_EU_GENERIC",
    type: "regex",
    pattern: /\b[A-Z]{2}\d{2}\s?[\dA-Za-z]{4}(?:\s?[\dA-Za-z]{4}){2,7}(?:\s?[\dA-Za-z]{1,4})?\b/g,
    category: "PAYMENT",
    isSpecial: false,
    redactSample: redactIban,
  },

  // ---- Credit card numbers ----
  {
    name: "CREDIT_CARD_VISA",
    type: "regex",
    pattern: /\b4\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    category: "PAYMENT",
    isSpecial: false,
    redactSample: redactCreditCard,
  },
  {
    name: "CREDIT_CARD_MASTERCARD",
    type: "regex",
    pattern: /\b5[1-5]\d{2}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    category: "PAYMENT",
    isSpecial: false,
    redactSample: redactCreditCard,
  },
  {
    name: "CREDIT_CARD_AMEX",
    type: "regex",
    pattern: /\b3[47]\d{2}[\s-]?\d{6}[\s-]?\d{5}\b/g,
    category: "PAYMENT",
    isSpecial: false,
    redactSample: redactCreditCard,
  },

  // ---- Email addresses ----
  {
    name: "EMAIL_ADDRESS",
    type: "regex",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    category: "CONTACT",
    isSpecial: false,
    redactSample: redactEmail,
  },

  // ---- Phone numbers (EU formats) ----
  {
    name: "PHONE_EU_INTERNATIONAL",
    type: "regex",
    pattern: /\b\+?\d{1,3}[\s.-]?\(?\d{2,5}\)?[\s.-]?\d{3,4}[\s.-]?\d{2,4}[\s.-]?\d{0,4}\b/g,
    category: "CONTACT",
    isSpecial: false,
    redactSample: redactPhone,
  },
  {
    name: "PHONE_DE",
    type: "regex",
    pattern: /\b(?:\+49|0049|0)\s?\(?\d{2,5}\)?[\s./-]?\d{3,8}[\s./-]?\d{0,5}\b/g,
    category: "CONTACT",
    isSpecial: false,
    redactSample: redactPhone,
  },
  {
    name: "PHONE_AT",
    type: "regex",
    pattern: /\b(?:\+43|0043|0)\s?\(?\d{1,4}\)?[\s./-]?\d{3,10}\b/g,
    category: "CONTACT",
    isSpecial: false,
    redactSample: redactPhone,
  },
  {
    name: "PHONE_CH",
    type: "regex",
    pattern: /\b(?:\+41|0041|0)\s?\(?\d{2}\)?[\s./-]?\d{3}[\s./-]?\d{2}[\s./-]?\d{2}\b/g,
    category: "CONTACT",
    isSpecial: false,
    redactSample: redactPhone,
  },

  // ---- German Tax ID (Steuerliche Identifikationsnummer, 11 digits) ----
  {
    name: "TAX_ID_DE",
    type: "regex",
    pattern: /\b\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/g,
    category: "IDENTIFICATION",
    isSpecial: false,
    redactSample: redactTaxId,
  },

  // ---- Social Security Numbers ----
  {
    name: "SSN_DE",
    type: "regex",
    // German Sozialversicherungsnummer: 12 characters, letter at position 9
    pattern: /\b\d{2}[0-3]\d[0-1]\d{2}[A-Za-z]\d{3}\b/g,
    category: "HR",
    isSpecial: false,
    redactSample: redactSSN,
  },
  {
    name: "SSN_AT",
    type: "regex",
    // Austrian Sozialversicherungsnummer: 10 digits (NNNN DDMMYY)
    pattern: /\b\d{4}\s?\d{2}[01]\d[0-3]\d\b/g,
    category: "HR",
    isSpecial: false,
    redactSample: redactSSN,
  },
  {
    name: "SSN_GENERIC",
    type: "regex",
    // US-style SSN (###-##-####) — included for international coverage
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    category: "HR",
    isSpecial: false,
    redactSample: redactSSN,
  },

  // ---- Passport numbers ----
  {
    name: "PASSPORT_DE",
    type: "regex",
    // German passport: C + 8 alphanumeric characters (e.g., C01X00T47)
    pattern: /\b[Cc][A-Za-z0-9]{8}\b/g,
    category: "IDENTIFICATION",
    isSpecial: false,
    redactSample: redactPassport,
  },
  {
    name: "PASSPORT_AT",
    type: "regex",
    // Austrian passport: letter + 7 digits
    pattern: /\b[A-Za-z]\d{7}\b/g,
    category: "IDENTIFICATION",
    isSpecial: false,
    redactSample: redactPassport,
  },
  {
    name: "PASSPORT_GENERIC",
    type: "regex",
    // Generic: 1-2 letters followed by 6-8 digits
    pattern: /\b[A-Za-z]{1,2}\d{6,8}\b/g,
    category: "IDENTIFICATION",
    isSpecial: false,
    redactSample: redactPassport,
  },

  // ---- Date of birth patterns ----
  {
    name: "DOB_EU_FORMAT",
    type: "regex",
    // DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
    pattern: /\b(0[1-9]|[12]\d|3[01])[./-](0[1-9]|1[0-2])[./-](19|20)\d{2}\b/g,
    category: "IDENTIFICATION",
    isSpecial: false,
    redactSample: redactDob,
  },
  {
    name: "DOB_ISO_FORMAT",
    type: "regex",
    // YYYY-MM-DD
    pattern: /\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g,
    category: "IDENTIFICATION",
    isSpecial: false,
    redactSample: redactDob,
  },
];

// ---------------------------------------------------------------------------
// Art. 9 Special Category Detection (keyword-based)
// ---------------------------------------------------------------------------

function buildKeywordPattern(keywords: string[]): RegExp {
  // Word-boundary, case-insensitive match for any of the keywords
  const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "gi");
}

const HEALTH_KEYWORDS = [
  "medical",
  "diagnosis",
  "diagnose",
  "treatment",
  "prescription",
  "doctor",
  "hospital",
  "disability",
  "allergy",
  "allergies",
  "medication",
  "medicine",
  "patient",
  "clinical",
  "therapy",
  "chronic",
  "symptom",
  "symptoms",
  "surgery",
  "vaccination",
  "vaccine",
  "blood type",
  "health insurance",
  "health record",
  "mental health",
  "psychiatric",
  "psychotherapy",
  "illness",
  "disease",
  "Krankheit",
  "Diagnose",
  "Behandlung",
  "Rezept",
  "Arzt",
  "Krankenhaus",
  "Behinderung",
  "Allergie",
  "Medikament",
  "Patient",
  "Therapie",
  "Impfung",
  "Krankenversicherung",
  "Gesundheit",
];

const BIOMETRIC_KEYWORDS = [
  "biometric",
  "fingerprint",
  "retina scan",
  "iris scan",
  "facial recognition",
  "face id",
  "voice recognition",
  "voiceprint",
  "palm print",
  "dna",
  "genetic",
  "biometrisch",
  "Fingerabdruck",
  "Gesichtserkennung",
  "genetisch",
];

const POLITICAL_KEYWORDS = [
  "political opinion",
  "political party",
  "political affiliation",
  "political belief",
  "party member",
  "party membership",
  "politische Meinung",
  "Parteimitglied",
  "Parteimitgliedschaft",
  "politische Zugehoerigkeit",
];

const RELIGIOUS_KEYWORDS = [
  "religious belief",
  "religion",
  "religious affiliation",
  "church membership",
  "faith",
  "denomination",
  "church tax",
  "Kirchensteuer",
  "Religionszugehoerigkeit",
  "Konfession",
  "Glaubensbekenntnis",
  "Kirchenmitgliedschaft",
];

const TRADE_UNION_KEYWORDS = [
  "trade union",
  "union membership",
  "labor union",
  "trade union membership",
  "works council",
  "Gewerkschaft",
  "Gewerkschaftsmitgliedschaft",
  "Betriebsrat",
];

const ETHNIC_KEYWORDS = [
  "ethnic origin",
  "ethnicity",
  "racial origin",
  "race",
  "ethnic background",
  "ethnische Herkunft",
  "Rasse",
  "rassische Herkunft",
];

const SEXUAL_ORIENTATION_KEYWORDS = [
  "sexual orientation",
  "sexual preference",
  "sexuelle Orientierung",
  "geschlechtliche Identitaet",
  "gender identity",
];

const CRIMINAL_KEYWORDS = [
  "criminal conviction",
  "criminal record",
  "criminal offence",
  "criminal offense",
  "penal record",
  "police record",
  "conviction",
  "court ruling",
  "Strafregister",
  "Vorstrafe",
  "strafrechtliche Verurteilung",
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
    redactSample: redactKeyword,
  }),
);

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
  }>;
  redactSample: (match: string) => string;
}

/**
 * Run a single detection pattern against a text and return raw match info.
 * Returns null if the pattern produced zero matches.
 */
function runPatternRaw(
  text: string,
  dp: DetectionPattern,
): RawPatternMatch | null {
  // Reset lastIndex for global regexps (they are stateful)
  const regex = new RegExp(dp.pattern.source, dp.pattern.flags);
  const matches: Array<{ text: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    matches.push({
      text: m[0],
      start: m.index,
      end: m.index + m[0].length,
    });
    // Safety: prevent infinite loops on zero-length matches
    if (m[0].length === 0) {
      regex.lastIndex += 1;
    }
  }

  if (matches.length === 0) return null;

  return {
    patternName: dp.name,
    type: dp.type,
    category: dp.category,
    isSpecial: dp.isSpecial,
    matches,
    redactSample: dp.redactSample,
  };
}

/**
 * Compute a confidence score for a set of matches.
 * Regex matches get a higher baseline than keywords.
 * More matches increase confidence with diminishing returns.
 */
function computeConfidence(type: "regex" | "keyword", matchCount: number): number {
  const baseConfidence = type === "regex" ? 0.75 : 0.6;
  const countBoost = Math.min(matchCount * 0.05, 0.2);
  return parseFloat(Math.min(baseConfidence + countBoost, 1.0).toFixed(2));
}

// ---------------------------------------------------------------------------
// Core detection functions
// ---------------------------------------------------------------------------

/**
 * Build a DetectionResult from raw pattern matches for a single detector type.
 * Groups all pattern matches into detectedElements and detectedCategories.
 */
function buildDetectionResult(
  detectorType: string,
  rawMatches: RawPatternMatch[],
): DetectionResult {
  const detectedElements: DetectionResult["detectedElements"] = [];
  const categoryMap = new Map<DataCategoryType, { totalConfidence: number; count: number }>();
  let containsSpecial = false;

  for (const raw of rawMatches) {
    const confidence = computeConfidence(raw.type, raw.matches.length);

    // Add each individual match as an element
    for (const match of raw.matches) {
      detectedElements.push({
        elementType: raw.patternName,
        confidence,
        snippetPreview: raw.redactSample(match.text),
        offsets: { start: match.start, end: match.end },
      });
    }

    // Accumulate category confidence (take the max per category)
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
    });
  });

  // Sort categories by confidence descending
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

/**
 * Run all detectors (PII regex + Art. 9 keywords) against the given text.
 *
 * Returns an array of DetectionResult objects — one per detector type that
 * produced matches. Currently produces up to two results:
 *   - "REGEX" for PII pattern matches
 *   - "REGEX" for Art. 9 keyword matches (keyword patterns use regex under the hood)
 *
 * Each result contains detectedElements (individual matches) and
 * detectedCategories (GDPR data categories with confidence scores).
 */
export function runAllDetectors(text: string): DetectionResult[] {
  const results: DetectionResult[] = [];

  const piiRaw = detectPIIRaw(text);
  if (piiRaw.length > 0) {
    results.push(buildDetectionResult("REGEX", piiRaw));
  }

  const art9Raw = detectArt9Raw(text);
  if (art9Raw.length > 0) {
    results.push(buildDetectionResult("REGEX", art9Raw));
  }

  return results;
}

/**
 * Returns true if any result indicates Art. 9 special-category data is suspected.
 */
export function hasSpecialCategory(results: DetectionResult[]): boolean {
  return results.some((r) => r.containsSpecialCategorySuspected);
}

/**
 * Return the distinct Art. 9 special-category types found across all results.
 * Returns the specific DataCategoryType values (HEALTH, RELIGION, etc.).
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
 * Returns a deduplicated list of all DataCategoryType values found.
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
// Basic PDF metadata extraction (no heavy dependencies)
// ---------------------------------------------------------------------------

/**
 * Extract metadata from a PDF buffer by scanning its raw text for the
 * standard Info dictionary keys. This is a best-effort, lightweight
 * approach that does NOT require a full PDF parser.
 *
 * For production use with encrypted or linearised PDFs, consider
 * integrating a full library such as pdf-lib or pdf-parse.
 */
export function extractPdfMetadata(buffer: Buffer): PdfMetadata {
  // Convert the buffer to a latin1 string so we can do simple text scanning
  const raw = buffer.toString("latin1");

  const metadata: PdfMetadata = {};

  const extract = (key: string): string | undefined => {
    // Match /Key (value) or /Key <hex>
    const parenRegex = new RegExp(`/${key}\\s*\\(([^)]{0,512})\\)`, "i");
    const parenMatch = raw.match(parenRegex);
    if (parenMatch) return parenMatch[1].trim();

    // Match /Key <FEFF...> (UTF-16BE hex strings)
    const hexRegex = new RegExp(`/${key}\\s*<([0-9A-Fa-f]{2,1024})>`, "i");
    const hexMatch = raw.match(hexRegex);
    if (hexMatch) {
      try {
        const hex = hexMatch[1];
        // Strip BOM (FEFF) if present and decode UTF-16BE
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

  // Count pages: look for /Type /Page (not /Pages)
  const pageMatches = raw.match(/\/Type\s*\/Page(?!s)\b/g);
  if (pageMatches) {
    metadata.pageCount = pageMatches.length;
  }

  return metadata;
}
