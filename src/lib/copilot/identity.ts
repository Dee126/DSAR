/**
 * Identity Resolution Service for the DSAR Privacy Copilot.
 *
 * Resolves a data subject's identity across multiple systems by building
 * an "Identity Graph" from the case's data subject information and any
 * accounts discovered during connector queries.
 *
 * The graph tracks all known identifiers (emails, phone numbers, employee
 * IDs, etc.), their sources, and confidence scores. Resolved systems are
 * now tracked as alternateIdentifiers with a source field rather than as
 * a separate resolvedSystems array.
 *
 * Updated to match the expanded IdentityProfile Prisma model which uses
 * displayName, primaryIdentifierType, primaryIdentifierValue, and
 * alternateIdentifiers instead of the previous primaryEmail/primaryName/
 * identifiers/resolvedSystems structure.
 */

/* ── Types ────────────────────────────────────────────────────────────── */

export type PrimaryIdentifierType =
  | "EMAIL"
  | "UPN"
  | "OBJECT_ID"
  | "CUSTOMER_ID"
  | "EMPLOYEE_ID"
  | "PHONE"
  | "IBAN"
  | "OTHER";

export interface AlternateIdentifier {
  type: string; // "email" | "upn" | "objectId" | "employeeId" | "phone" | "name" | "custom"
  value: string;
  confidence: number; // 0-1 (note: stored as 0-100 in DB)
  source: string; // Provider name or "case_data"
}

export interface IdentityGraph {
  displayName: string;
  primaryIdentifierType: PrimaryIdentifierType;
  primaryIdentifierValue: string;
  alternateIdentifiers: AlternateIdentifier[];
  confidenceScore: number; // 0-100
}

/* ── Constants ────────────────────────────────────────────────────────── */

/** Confidence score assigned to identifiers sourced directly from case data (0-100). */
export const CASE_DATA_CONFIDENCE = 90;

/** Confidence score assigned to identifiers discovered via connectors (0-100). */
export const DISCOVERY_CONFIDENCE = 80;

/** Minimum confidence threshold (0-1 scale) for an identifier to be considered valid. */
const MIN_CONFIDENCE_THRESHOLD = 0.1;

/** Maximum confidence value on the 0-1 scale (clamped). */
const MAX_CONFIDENCE = 1.0;

/** Source label for identifiers derived from the original case record. */
const CASE_DATA_SOURCE = "case_data";

/* ── Helpers ──────────────────────────────────────────────────────────── */

/**
 * Clamp a number between 0 and MAX_CONFIDENCE (0-1 scale).
 */
function clampConfidence(value: number): number {
  return Math.min(MAX_CONFIDENCE, Math.max(0, value));
}

/**
 * Normalize a string value for comparison purposes.
 * Trims whitespace and lowercases. Used to detect duplicates.
 */
function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Check if two alternate identifiers refer to the same identifier.
 * Two entries match when they share the same type and normalized value.
 */
function isSameIdentifier(a: AlternateIdentifier, b: AlternateIdentifier): boolean {
  return a.type === b.type && normalizeValue(a.value) === normalizeValue(b.value);
}

/**
 * Convert a confidence value from the 0-1 scale to the 0-100 scale used in the DB.
 */
function toDbConfidence(value: number): number {
  return Math.round(clampConfidence(value) * 100);
}

/**
 * Convert a confidence value from the 0-100 DB scale to the 0-1 scale.
 */
function fromDbConfidence(value: number): number {
  return Math.min(1, Math.max(0, value / 100));
}

/**
 * Extract additional identifiers from a DataSubject's `identifiers` JSON field.
 * The field is a Record<string, unknown> where keys map to identifier types.
 */
function extractCustomIdentifiers(
  identifiers: Record<string, unknown>
): AlternateIdentifier[] {
  const entries: AlternateIdentifier[] = [];

  // Known key-to-type mappings
  const keyTypeMap: Record<string, string> = {
    upn: "upn",
    userPrincipalName: "upn",
    objectId: "objectId",
    object_id: "objectId",
    entraId: "objectId",
    employeeId: "employeeId",
    employee_id: "employeeId",
    staffId: "employeeId",
    email: "email",
    secondaryEmail: "email",
    alternateEmail: "email",
    phone: "phone",
    mobile: "phone",
    mobilePhone: "phone",
    customerId: "customerId",
    customer_id: "customerId",
    iban: "iban",
  };

  for (const [key, value] of Object.entries(identifiers)) {
    if (value === null || value === undefined) {
      continue;
    }

    const stringValue = typeof value === "string" ? value.trim() : String(value).trim();

    if (stringValue.length === 0) {
      continue;
    }

    const identifierType = keyTypeMap[key] ?? "custom";

    entries.push({
      type: identifierType,
      value: stringValue,
      confidence: fromDbConfidence(CASE_DATA_CONFIDENCE),
      source: CASE_DATA_SOURCE,
    });
  }

  return entries;
}

/* ── Public API ───────────────────────────────────────────────────────── */

/**
 * Build initial identity graph from case data subject info.
 *
 * Takes the DataSubject record from the case and populates the graph
 * with all known identifiers. The primary identifier is chosen based on
 * availability: email first, then phone, then falls back to the full name
 * with type OTHER.
 *
 * All identifiers sourced from case data receive CASE_DATA_CONFIDENCE (90).
 */
export function buildInitialIdentityGraph(dataSubject: {
  fullName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  identifiers?: Record<string, unknown> | null;
}): IdentityGraph {
  const alternateIdentifiers: AlternateIdentifier[] = [];
  const caseConfidence01 = fromDbConfidence(CASE_DATA_CONFIDENCE);

  // Determine primary identifier type and value
  let primaryIdentifierType: PrimaryIdentifierType;
  let primaryIdentifierValue: string;

  if (dataSubject.email && dataSubject.email.trim().length > 0) {
    primaryIdentifierType = "EMAIL";
    primaryIdentifierValue = dataSubject.email.trim();
  } else if (dataSubject.phone && dataSubject.phone.trim().length > 0) {
    primaryIdentifierType = "PHONE";
    primaryIdentifierValue = dataSubject.phone.trim();
  } else {
    primaryIdentifierType = "OTHER";
    primaryIdentifierValue = dataSubject.fullName.trim();
  }

  // Add email as alternate identifier (if it exists and is not already the primary)
  if (dataSubject.email && dataSubject.email.trim().length > 0) {
    alternateIdentifiers.push({
      type: "email",
      value: dataSubject.email.trim(),
      confidence: caseConfidence01,
      source: CASE_DATA_SOURCE,
    });
  }

  // Add phone as alternate identifier
  if (dataSubject.phone && dataSubject.phone.trim().length > 0) {
    alternateIdentifiers.push({
      type: "phone",
      value: dataSubject.phone.trim(),
      confidence: caseConfidence01,
      source: CASE_DATA_SOURCE,
    });
  }

  // Add full name as alternate identifier
  if (dataSubject.fullName && dataSubject.fullName.trim().length > 0) {
    alternateIdentifiers.push({
      type: "name",
      value: dataSubject.fullName.trim(),
      confidence: caseConfidence01,
      source: CASE_DATA_SOURCE,
    });
  }

  // Extract any additional identifiers from the JSON field
  if (dataSubject.identifiers && typeof dataSubject.identifiers === "object") {
    const customEntries = extractCustomIdentifiers(
      dataSubject.identifiers as Record<string, unknown>
    );

    // De-duplicate against identifiers already added
    for (const entry of customEntries) {
      const isDuplicate = alternateIdentifiers.some((existing) =>
        isSameIdentifier(existing, entry)
      );
      if (!isDuplicate) {
        alternateIdentifiers.push(entry);
      }
    }
  }

  const graph: IdentityGraph = {
    displayName: dataSubject.fullName?.trim() || "",
    primaryIdentifierType,
    primaryIdentifierValue,
    alternateIdentifiers,
    confidenceScore: CASE_DATA_CONFIDENCE,
  };

  return graph;
}

/**
 * Build QuerySpec subject identifiers from the identity graph.
 *
 * Returns a primary identifier derived from the graph's primary identifier
 * fields, and a list of alternative identifiers from alternateIdentifiers,
 * sorted by confidence descending. The primary identifier is excluded from
 * alternatives to avoid redundancy.
 */
export function buildSubjectIdentifiers(graph: IdentityGraph): {
  primary: { type: string; value: string };
  alternatives: Array<{ type: string; value: string }>;
} {
  const primary = {
    type: graph.primaryIdentifierType,
    value: graph.primaryIdentifierValue,
  };

  if (graph.alternateIdentifiers.length === 0) {
    return { primary, alternatives: [] };
  }

  // Build alternatives from alternateIdentifiers, excluding the primary
  const primaryNormalized = normalizeValue(graph.primaryIdentifierValue);
  const alternatives = graph.alternateIdentifiers
    .filter((entry) => {
      // Exclude entries that match the primary identifier value
      return normalizeValue(entry.value) !== primaryNormalized;
    })
    .filter((entry) => entry.confidence >= MIN_CONFIDENCE_THRESHOLD)
    .sort((a, b) => b.confidence - a.confidence)
    .map((entry) => ({
      type: entry.type,
      value: entry.value,
    }));

  return { primary, alternatives };
}

/**
 * Merge new alternate identifiers into the graph, deduplicating by type+value.
 *
 * De-duplication rules:
 * - If an identifier with the same type+value already exists, keep the one
 *   with the higher confidence. If the new entry comes from a different source
 *   and is at least moderately confident, apply a small corroboration boost.
 * - New unique identifiers are appended.
 * - Identifiers below the minimum confidence threshold are dropped.
 *
 * The source parameter labels all new entries that do not already have
 * a source set.
 *
 * Returns a new IdentityGraph with the merged alternateIdentifiers and
 * recalculated confidenceScore.
 */
export function mergeIdentifiers(
  graph: IdentityGraph,
  newEntries: AlternateIdentifier[],
  source: string
): IdentityGraph {
  // Clone the existing identifiers to avoid mutating the original graph
  const merged: AlternateIdentifier[] = [...graph.alternateIdentifiers];

  for (const entry of newEntries) {
    // Apply the source label if the entry doesn't have one
    const labeledEntry: AlternateIdentifier = {
      ...entry,
      source: entry.source || source,
      confidence: clampConfidence(entry.confidence),
    };

    // Skip entries below the minimum confidence threshold
    if (labeledEntry.confidence < MIN_CONFIDENCE_THRESHOLD) {
      continue;
    }

    // Check for existing duplicate
    const existingIndex = merged.findIndex((existing) =>
      isSameIdentifier(existing, labeledEntry)
    );

    if (existingIndex !== -1) {
      const existing = merged[existingIndex];

      // Keep the higher confidence value. If they come from different sources
      // and the new one is at least moderately confident, give a small
      // corroboration boost.
      let updatedConfidence = Math.max(existing.confidence, labeledEntry.confidence);

      if (
        existing.source !== labeledEntry.source &&
        labeledEntry.confidence >= 0.5
      ) {
        // Cross-source corroboration: small boost capped at MAX_CONFIDENCE
        updatedConfidence = clampConfidence(updatedConfidence + 0.05);
      }

      merged[existingIndex] = {
        ...existing,
        confidence: updatedConfidence,
        // Keep the original source unless the new entry is higher confidence
        source:
          labeledEntry.confidence > existing.confidence
            ? labeledEntry.source
            : existing.source,
      };
    } else {
      // New unique identifier — append it
      merged.push(labeledEntry);
    }
  }

  const updatedGraph: IdentityGraph = {
    ...graph,
    alternateIdentifiers: merged,
    confidenceScore: 0,
  };

  updatedGraph.confidenceScore = calculateConfidence(updatedGraph);

  return updatedGraph;
}

/**
 * Add a resolved system account to the graph as an alternate identifier.
 *
 * System accounts are represented as AlternateIdentifier entries with a
 * type like "system_account" and the source set to the provider name.
 * For example: { type: "system_account", value: "M365:user@acme",
 * source: "M365", confidence: 0.85 }
 *
 * If a matching identifier (same type+value) already exists, its confidence
 * and source are updated. Otherwise the system identifier is appended.
 *
 * Returns a new IdentityGraph with the updated alternateIdentifiers and
 * recalculated confidenceScore.
 */
export function addResolvedSystem(
  graph: IdentityGraph,
  system: AlternateIdentifier
): IdentityGraph {
  const identifiers = [...graph.alternateIdentifiers];

  const existingIndex = identifiers.findIndex((existing) =>
    isSameIdentifier(existing, system)
  );

  if (existingIndex !== -1) {
    // Update existing entry — keep the higher confidence
    const existing = identifiers[existingIndex];
    identifiers[existingIndex] = {
      ...existing,
      confidence: Math.max(existing.confidence, system.confidence),
      source: system.source || existing.source,
    };
  } else {
    identifiers.push({ ...system });
  }

  const updatedGraph: IdentityGraph = {
    ...graph,
    alternateIdentifiers: identifiers,
    confidenceScore: 0,
  };

  updatedGraph.confidenceScore = calculateConfidence(updatedGraph);

  return updatedGraph;
}

/**
 * Recalculate the overall confidenceScore (0-100) for the identity graph.
 *
 * Strategy:
 * - Uses a weighted average of alternate identifier confidences where
 *   stronger identifier types (email, upn) carry more weight.
 * - Applies a corroboration bonus based on the number of distinct sources
 *   present in the graph — more cross-system confirmation yields a higher
 *   score.
 * - The result is clamped to the 0-100 range.
 */
export function calculateConfidence(graph: IdentityGraph): number {
  const { alternateIdentifiers } = graph;

  if (alternateIdentifiers.length === 0) {
    // No alternate identifiers; base confidence on whether we have a primary
    return graph.primaryIdentifierValue ? 50 : 0;
  }

  // Weight map: strong identifiers weigh more in the overall score
  const typeWeights: Record<string, number> = {
    email: 1.0,
    upn: 1.0,
    objectId: 0.9,
    employeeId: 0.85,
    customerId: 0.85,
    phone: 0.7,
    iban: 0.7,
    name: 0.5,
    system_account: 0.6,
    custom: 0.4,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const entry of alternateIdentifiers) {
    const weight = typeWeights[entry.type] ?? 0.4;
    weightedSum += entry.confidence * weight;
    totalWeight += weight;
  }

  const baseConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Count distinct sources for corroboration bonus
  const distinctSources = new Set(
    alternateIdentifiers.map((entry) => entry.source)
  );

  // Each source beyond the first adds a small bonus (up to +0.10 on the 0-1 scale),
  // rewarding cross-system identity confirmation.
  const corroborationBonus = Math.min(
    0.10,
    Math.max(0, distinctSources.size - 1) * 0.03
  );

  const finalConfidence01 = clampConfidence(baseConfidence + corroborationBonus);

  // Convert from 0-1 scale to 0-100 scale for the DB
  return toDbConfidence(finalConfidence01);
}
