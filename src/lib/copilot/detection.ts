/**
 * Detection Service — DSAR Privacy Copilot
 *
 * Provides regex-based PII detection, GDPR data-category classification,
 * Art. 9 special-category keyword detection, and basic PDF metadata
 * extraction. All sample output is redacted before it leaves this module.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DataCategoryType =
  | "IDENTIFICATION"
  | "CONTACT"
  | "CONTRACT"
  | "PAYMENT_BANK"
  | "COMMUNICATION"
  | "HR_EMPLOYMENT"
  | "CREDIT_FINANCIAL"
  | "ONLINE_TECHNICAL"
  | "SPECIAL_CATEGORY_ART9";

export interface DetectionPattern {
  name: string;
  type: "regex" | "keyword";
  pattern: RegExp;
  category: DataCategoryType;
  isArt9: boolean;
  art9Type?: string;
  /** Return a redacted representation of the match (e.g. "DE89 **** **** 0000") */
  redactSample: (match: string) => string;
}

export interface DetectionResult {
  patternName: string;
  detectorType: string;
  matchCount: number;
  /** Redacted first match — null when nothing was found */
  sampleMatch: string | null;
  /** 0-1 confidence score */
  confidence: number;
  category: DataCategoryType;
  isArt9: boolean;
  art9Type?: string;
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
    category: "PAYMENT_BANK",
    isArt9: false,
    redactSample: redactIban,
  },
  {
    name: "IBAN_AT",
    type: "regex",
    pattern: /\bAT\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/gi,
    category: "PAYMENT_BANK",
    isArt9: false,
    redactSample: redactIban,
  },
  {
    name: "IBAN_CH",
    type: "regex",
    pattern: /\bCH\d{2}\s?\d{4}\s?\d{1}[A-Za-z0-9]{3}\s?[A-Za-z0-9]{4}\s?[A-Za-z0-9]{4}\s?[A-Za-z0-9]{1}\b/gi,
    category: "PAYMENT_BANK",
    isArt9: false,
    redactSample: redactIban,
  },
  {
    name: "IBAN_EU_GENERIC",
    type: "regex",
    pattern: /\b[A-Z]{2}\d{2}\s?[\dA-Za-z]{4}(?:\s?[\dA-Za-z]{4}){2,7}(?:\s?[\dA-Za-z]{1,4})?\b/g,
    category: "PAYMENT_BANK",
    isArt9: false,
    redactSample: redactIban,
  },

  // ---- Credit card numbers ----
  {
    name: "CREDIT_CARD_VISA",
    type: "regex",
    pattern: /\b4\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    category: "PAYMENT_BANK",
    isArt9: false,
    redactSample: redactCreditCard,
  },
  {
    name: "CREDIT_CARD_MASTERCARD",
    type: "regex",
    pattern: /\b5[1-5]\d{2}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    category: "PAYMENT_BANK",
    isArt9: false,
    redactSample: redactCreditCard,
  },
  {
    name: "CREDIT_CARD_AMEX",
    type: "regex",
    pattern: /\b3[47]\d{2}[\s-]?\d{6}[\s-]?\d{5}\b/g,
    category: "PAYMENT_BANK",
    isArt9: false,
    redactSample: redactCreditCard,
  },

  // ---- Email addresses ----
  {
    name: "EMAIL_ADDRESS",
    type: "regex",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    category: "CONTACT",
    isArt9: false,
    redactSample: redactEmail,
  },

  // ---- Phone numbers (EU formats) ----
  {
    name: "PHONE_EU_INTERNATIONAL",
    type: "regex",
    pattern: /\b\+?\d{1,3}[\s.-]?\(?\d{2,5}\)?[\s.-]?\d{3,4}[\s.-]?\d{2,4}[\s.-]?\d{0,4}\b/g,
    category: "CONTACT",
    isArt9: false,
    redactSample: redactPhone,
  },
  {
    name: "PHONE_DE",
    type: "regex",
    pattern: /\b(?:\+49|0049|0)\s?\(?\d{2,5}\)?[\s./-]?\d{3,8}[\s./-]?\d{0,5}\b/g,
    category: "CONTACT",
    isArt9: false,
    redactSample: redactPhone,
  },
  {
    name: "PHONE_AT",
    type: "regex",
    pattern: /\b(?:\+43|0043|0)\s?\(?\d{1,4}\)?[\s./-]?\d{3,10}\b/g,
    category: "CONTACT",
    isArt9: false,
    redactSample: redactPhone,
  },
  {
    name: "PHONE_CH",
    type: "regex",
    pattern: /\b(?:\+41|0041|0)\s?\(?\d{2}\)?[\s./-]?\d{3}[\s./-]?\d{2}[\s./-]?\d{2}\b/g,
    category: "CONTACT",
    isArt9: false,
    redactSample: redactPhone,
  },

  // ---- German Tax ID (Steuerliche Identifikationsnummer, 11 digits) ----
  {
    name: "TAX_ID_DE",
    type: "regex",
    pattern: /\b\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/g,
    category: "IDENTIFICATION",
    isArt9: false,
    redactSample: redactTaxId,
  },

  // ---- Social Security Numbers ----
  {
    name: "SSN_DE",
    type: "regex",
    // German Sozialversicherungsnummer: 12 characters, letter at position 9
    pattern: /\b\d{2}[0-3]\d[0-1]\d{2}[A-Za-z]\d{3}\b/g,
    category: "HR_EMPLOYMENT",
    isArt9: false,
    redactSample: redactSSN,
  },
  {
    name: "SSN_AT",
    type: "regex",
    // Austrian Sozialversicherungsnummer: 10 digits (NNNN DDMMYY)
    pattern: /\b\d{4}\s?\d{2}[01]\d[0-3]\d\b/g,
    category: "HR_EMPLOYMENT",
    isArt9: false,
    redactSample: redactSSN,
  },
  {
    name: "SSN_GENERIC",
    type: "regex",
    // US-style SSN (###-##-####) — included for international coverage
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    category: "HR_EMPLOYMENT",
    isArt9: false,
    redactSample: redactSSN,
  },

  // ---- Passport numbers ----
  {
    name: "PASSPORT_DE",
    type: "regex",
    // German passport: C + 8 alphanumeric characters (e.g., C01X00T47)
    pattern: /\b[Cc][A-Za-z0-9]{8}\b/g,
    category: "IDENTIFICATION",
    isArt9: false,
    redactSample: redactPassport,
  },
  {
    name: "PASSPORT_AT",
    type: "regex",
    // Austrian passport: letter + 7 digits
    pattern: /\b[A-Za-z]\d{7}\b/g,
    category: "IDENTIFICATION",
    isArt9: false,
    redactSample: redactPassport,
  },
  {
    name: "PASSPORT_GENERIC",
    type: "regex",
    // Generic: 1-2 letters followed by 6-8 digits
    pattern: /\b[A-Za-z]{1,2}\d{6,8}\b/g,
    category: "IDENTIFICATION",
    isArt9: false,
    redactSample: redactPassport,
  },

  // ---- Date of birth patterns ----
  {
    name: "DOB_EU_FORMAT",
    type: "regex",
    // DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
    pattern: /\b(0[1-9]|[12]\d|3[01])[./-](0[1-9]|1[0-2])[./-](19|20)\d{2}\b/g,
    category: "IDENTIFICATION",
    isArt9: false,
    redactSample: redactDob,
  },
  {
    name: "DOB_ISO_FORMAT",
    type: "regex",
    // YYYY-MM-DD
    pattern: /\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g,
    category: "IDENTIFICATION",
    isArt9: false,
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
  art9Type: string;
  keywords: string[];
}

const ART9_CATEGORIES: Art9CategoryDef[] = [
  { art9Type: "health_data", keywords: HEALTH_KEYWORDS },
  { art9Type: "biometric_data", keywords: BIOMETRIC_KEYWORDS },
  { art9Type: "political_opinions", keywords: POLITICAL_KEYWORDS },
  { art9Type: "religious_beliefs", keywords: RELIGIOUS_KEYWORDS },
  { art9Type: "trade_union_membership", keywords: TRADE_UNION_KEYWORDS },
  { art9Type: "ethnic_origin", keywords: ETHNIC_KEYWORDS },
  { art9Type: "sexual_orientation", keywords: SEXUAL_ORIENTATION_KEYWORDS },
  { art9Type: "criminal_convictions", keywords: CRIMINAL_KEYWORDS },
];

export const ART9_KEYWORDS: DetectionPattern[] = ART9_CATEGORIES.map(
  ({ art9Type, keywords }) => ({
    name: `ART9_${art9Type.toUpperCase()}`,
    type: "keyword" as const,
    pattern: buildKeywordPattern(keywords),
    category: "SPECIAL_CATEGORY_ART9" as DataCategoryType,
    isArt9: true,
    art9Type,
    redactSample: redactKeyword,
  }),
);

// ---------------------------------------------------------------------------
// Core detection functions
// ---------------------------------------------------------------------------

/**
 * Run a single detection pattern against a text and return a result.
 * Returns null if the pattern produced zero matches.
 */
function runPattern(
  text: string,
  dp: DetectionPattern,
): DetectionResult | null {
  // Reset lastIndex for global regexps (they are stateful)
  const regex = new RegExp(dp.pattern.source, dp.pattern.flags);
  const matches: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    matches.push(m[0]);
    // Safety: prevent infinite loops on zero-length matches
    if (m[0].length === 0) {
      regex.lastIndex += 1;
    }
  }

  if (matches.length === 0) return null;

  // Compute confidence heuristic:
  //  - regex matches get higher baseline than keywords
  //  - more matches increase confidence (diminishing returns)
  const baseConfidence = dp.type === "regex" ? 0.75 : 0.6;
  const countBoost = Math.min(matches.length * 0.05, 0.2);
  const confidence = Math.min(baseConfidence + countBoost, 1.0);

  return {
    patternName: dp.name,
    detectorType: dp.type,
    matchCount: matches.length,
    sampleMatch: dp.redactSample(matches[0]),
    confidence: parseFloat(confidence.toFixed(2)),
    category: dp.category,
    isArt9: dp.isArt9,
    ...(dp.art9Type ? { art9Type: dp.art9Type } : {}),
  };
}

/**
 * Detect PII patterns (non-Art. 9) in the given text.
 */
export function detectPII(text: string): DetectionResult[] {
  if (!text || typeof text !== "string") return [];

  const results: DetectionResult[] = [];
  for (const pattern of PII_PATTERNS) {
    const result = runPattern(text, pattern);
    if (result) results.push(result);
  }
  return results;
}

/**
 * Detect Art. 9 special-category keywords in the given text.
 */
export function detectArt9(text: string): DetectionResult[] {
  if (!text || typeof text !== "string") return [];

  const results: DetectionResult[] = [];
  for (const pattern of ART9_KEYWORDS) {
    const result = runPattern(text, pattern);
    if (result) results.push(result);
  }
  return results;
}

/**
 * Run all detectors (PII + Art. 9) against the given text.
 * Results are sorted by confidence descending.
 */
export function runAllDetectors(text: string): DetectionResult[] {
  const piiResults = detectPII(text);
  const art9Results = detectArt9(text);
  const combined = [...piiResults, ...art9Results];
  combined.sort((a, b) => b.confidence - a.confidence);
  return combined;
}

/**
 * Extract the unique GDPR data categories from a set of detection results.
 */
export function classifyFindings(results: DetectionResult[]): DataCategoryType[] {
  const categories = new Set<DataCategoryType>();
  for (const r of results) {
    categories.add(r.category);
  }
  return Array.from(categories);
}

/**
 * Returns true if any result indicates Art. 9 special-category data.
 */
export function hasArt9Content(results: DetectionResult[]): boolean {
  return results.some((r) => r.isArt9);
}

/**
 * Return the distinct Art. 9 sub-categories found (e.g. "health_data").
 */
export function getArt9Categories(results: DetectionResult[]): string[] {
  const types = new Set<string>();
  for (const r of results) {
    if (r.isArt9 && r.art9Type) {
      types.add(r.art9Type);
    }
  }
  return Array.from(types);
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
