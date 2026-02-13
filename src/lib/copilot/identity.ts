/**
 * Identity Resolution Service for the DSAR Privacy Copilot.
 *
 * Resolves a data subject's identity across multiple systems by building
 * an "Identity Graph" from the case's data subject information and any
 * accounts discovered during connector queries.
 *
 * The graph tracks all known identifiers (emails, phone numbers, employee
 * IDs, etc.), their sources, and confidence scores. It also records which
 * systems the subject has been found in so connectors can target the
 * correct accounts.
 */

/* ── Types ────────────────────────────────────────────────────────────── */

export interface IdentityEntry {
  type: string; // "email" | "upn" | "objectId" | "employeeId" | "phone" | "name" | "custom"
  value: string;
  source: string; // Provider name or "case_data"
  confidence: number; // 0-1
}

export interface ResolvedSystem {
  provider: string;
  accountId: string;
  displayName: string;
  lastSeen?: string;
}

export interface IdentityGraph {
  primaryEmail: string | null;
  primaryName: string | null;
  identifiers: IdentityEntry[];
  resolvedSystems: ResolvedSystem[];
  confidence: number; // overall confidence
}

/* ── Constants ────────────────────────────────────────────────────────── */

/** Confidence assigned to identifiers sourced directly from case data. */
const CASE_DATA_CONFIDENCE = 1.0;

/** Minimum confidence threshold for an identifier to be considered valid. */
const MIN_CONFIDENCE_THRESHOLD = 0.1;

/** Maximum confidence value (clamped). */
const MAX_CONFIDENCE = 1.0;

/** Source label for identifiers derived from the original case record. */
const CASE_DATA_SOURCE = "case_data";

/* ── Helpers ──────────────────────────────────────────────────────────── */

/**
 * Clamp a number between 0 and MAX_CONFIDENCE.
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
 * Check if two identity entries refer to the same identifier.
 * Two entries match when they share the same type and normalized value.
 */
function isSameIdentifier(a: IdentityEntry, b: IdentityEntry): boolean {
  return a.type === b.type && normalizeValue(a.value) === normalizeValue(b.value);
}

/**
 * Check if two resolved systems refer to the same account.
 * Two systems match when they share the same provider and account ID.
 */
function isSameSystem(a: ResolvedSystem, b: ResolvedSystem): boolean {
  return (
    a.provider === b.provider &&
    normalizeValue(a.accountId) === normalizeValue(b.accountId)
  );
}

/**
 * Compute an overall confidence score for the identity graph.
 *
 * Strategy: weighted average where email/upn identifiers carry more
 * weight, boosted by the number of corroborating sources. A graph with
 * identifiers confirmed across multiple systems is more trustworthy than
 * one backed by a single source.
 */
function computeOverallConfidence(graph: IdentityGraph): number {
  const { identifiers, resolvedSystems } = graph;

  if (identifiers.length === 0) {
    return 0;
  }

  // Weight map: strong identifiers weigh more in the overall score
  const typeWeights: Record<string, number> = {
    email: 1.0,
    upn: 1.0,
    objectId: 0.9,
    employeeId: 0.85,
    phone: 0.7,
    name: 0.5,
    custom: 0.4,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const entry of identifiers) {
    const weight = typeWeights[entry.type] ?? 0.4;
    weightedSum += entry.confidence * weight;
    totalWeight += weight;
  }

  const baseConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Corroboration bonus: each resolved system beyond the first adds a small
  // bonus (up to +0.15), rewarding cross-system identity confirmation.
  const corroborationBonus = Math.min(
    0.15,
    Math.max(0, resolvedSystems.length - 1) * 0.05
  );

  return clampConfidence(baseConfidence + corroborationBonus);
}

/**
 * Extract additional identifiers from a DataSubject's `identifiers` JSON field.
 * The field is a Record<string, unknown> where keys map to identifier types.
 */
function extractCustomIdentifiers(
  identifiers: Record<string, unknown>
): IdentityEntry[] {
  const entries: IdentityEntry[] = [];

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
      source: CASE_DATA_SOURCE,
      confidence: CASE_DATA_CONFIDENCE,
    });
  }

  return entries;
}

/* ── Public API ───────────────────────────────────────────────────────── */

/**
 * Build initial identity graph from case data subject info.
 * Takes the DataSubject record from the case and populates the graph
 * with all known identifiers at full confidence.
 */
export function buildInitialIdentityGraph(dataSubject: {
  fullName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  identifiers?: Record<string, unknown> | null;
}): IdentityGraph {
  const identifiers: IdentityEntry[] = [];

  // Always add the full name
  if (dataSubject.fullName && dataSubject.fullName.trim().length > 0) {
    identifiers.push({
      type: "name",
      value: dataSubject.fullName.trim(),
      source: CASE_DATA_SOURCE,
      confidence: CASE_DATA_CONFIDENCE,
    });
  }

  // Add email if present
  if (dataSubject.email && dataSubject.email.trim().length > 0) {
    identifiers.push({
      type: "email",
      value: dataSubject.email.trim(),
      source: CASE_DATA_SOURCE,
      confidence: CASE_DATA_CONFIDENCE,
    });
  }

  // Add phone if present
  if (dataSubject.phone && dataSubject.phone.trim().length > 0) {
    identifiers.push({
      type: "phone",
      value: dataSubject.phone.trim(),
      source: CASE_DATA_SOURCE,
      confidence: CASE_DATA_CONFIDENCE,
    });
  }

  // Extract any additional identifiers from the JSON field
  if (dataSubject.identifiers && typeof dataSubject.identifiers === "object") {
    const customEntries = extractCustomIdentifiers(
      dataSubject.identifiers as Record<string, unknown>
    );

    // De-duplicate against identifiers already added
    for (const entry of customEntries) {
      const isDuplicate = identifiers.some((existing) =>
        isSameIdentifier(existing, entry)
      );
      if (!isDuplicate) {
        identifiers.push(entry);
      }
    }
  }

  const graph: IdentityGraph = {
    primaryEmail: dataSubject.email?.trim() || null,
    primaryName: dataSubject.fullName?.trim() || null,
    identifiers,
    resolvedSystems: [],
    confidence: 0,
  };

  // Compute overall confidence
  graph.confidence = computeOverallConfidence(graph);

  return graph;
}

/**
 * Merge new identifiers discovered from a connector into the graph.
 *
 * De-duplication rules:
 * - If an identifier with the same type+value already exists, keep the
 *   one with the higher confidence. If the new entry has a different source,
 *   the higher confidence is retained (cross-system corroboration).
 * - New unique identifiers are appended.
 * - Identifiers below the minimum confidence threshold are dropped.
 *
 * The source parameter labels all new entries that do not already have
 * a source set.
 */
export function mergeIdentifiers(
  graph: IdentityGraph,
  newEntries: IdentityEntry[],
  source: string
): IdentityGraph {
  // Clone the existing identifiers to avoid mutating the original graph
  const merged: IdentityEntry[] = [...graph.identifiers];

  for (const entry of newEntries) {
    // Apply the source label if the entry doesn't have one
    const labeledEntry: IdentityEntry = {
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

  // Attempt to promote the primary email if we don't have one yet
  let primaryEmail = graph.primaryEmail;
  if (!primaryEmail) {
    const emailEntry = merged
      .filter((e) => e.type === "email")
      .sort((a, b) => b.confidence - a.confidence)[0];
    if (emailEntry) {
      primaryEmail = emailEntry.value;
    }
  }

  // Attempt to promote the primary name if we don't have one yet
  let primaryName = graph.primaryName;
  if (!primaryName) {
    const nameEntry = merged
      .filter((e) => e.type === "name")
      .sort((a, b) => b.confidence - a.confidence)[0];
    if (nameEntry) {
      primaryName = nameEntry.value;
    }
  }

  const updatedGraph: IdentityGraph = {
    ...graph,
    primaryEmail,
    primaryName,
    identifiers: merged,
    resolvedSystems: [...graph.resolvedSystems],
    confidence: 0,
  };

  updatedGraph.confidence = computeOverallConfidence(updatedGraph);

  return updatedGraph;
}

/**
 * Add a resolved system account to the graph.
 *
 * If the same provider + accountId combination already exists, the entry
 * is updated (display name and lastSeen refreshed). Otherwise the new
 * system is appended.
 */
export function addResolvedSystem(
  graph: IdentityGraph,
  system: ResolvedSystem
): IdentityGraph {
  const systems = [...graph.resolvedSystems];

  const existingIndex = systems.findIndex((existing) =>
    isSameSystem(existing, system)
  );

  if (existingIndex !== -1) {
    // Update the existing entry with fresh information
    systems[existingIndex] = {
      ...systems[existingIndex],
      displayName: system.displayName || systems[existingIndex].displayName,
      lastSeen: system.lastSeen ?? systems[existingIndex].lastSeen,
    };
  } else {
    systems.push({ ...system });
  }

  const updatedGraph: IdentityGraph = {
    ...graph,
    identifiers: [...graph.identifiers],
    resolvedSystems: systems,
    confidence: 0,
  };

  updatedGraph.confidence = computeOverallConfidence(updatedGraph);

  return updatedGraph;
}

/**
 * Build QuerySpec subject identifiers from the identity graph.
 *
 * Returns a primary identifier (preferring email, then upn, then the
 * highest-confidence identifier available) and a list of alternative
 * identifiers for use in connector queries.
 *
 * The alternatives are sorted by confidence descending, with the primary
 * identifier excluded to avoid redundancy.
 */
export function buildSubjectIdentifiers(graph: IdentityGraph): {
  primary: { type: string; value: string };
  alternatives: { type: string; value: string }[];
} {
  const { identifiers } = graph;

  if (identifiers.length === 0) {
    // Fallback: return an empty primary. The caller should handle this
    // edge case (e.g., prompt the user to provide more information).
    return {
      primary: { type: "email", value: "" },
      alternatives: [],
    };
  }

  // Priority order for selecting the primary identifier
  const typePriority: string[] = ["email", "upn", "objectId", "employeeId", "phone", "name", "custom"];

  // Sort identifiers: first by type priority, then by confidence descending
  const sorted = [...identifiers].sort((a, b) => {
    const aPriority = typePriority.indexOf(a.type);
    const bPriority = typePriority.indexOf(b.type);
    const aRank = aPriority === -1 ? typePriority.length : aPriority;
    const bRank = bPriority === -1 ? typePriority.length : bPriority;

    if (aRank !== bRank) {
      return aRank - bRank;
    }

    // Same type priority — prefer higher confidence
    return b.confidence - a.confidence;
  });

  const primary = {
    type: sorted[0].type,
    value: sorted[0].value,
  };

  // All remaining identifiers become alternatives, sorted by confidence
  const alternatives = sorted
    .slice(1)
    .filter((entry) => entry.confidence >= MIN_CONFIDENCE_THRESHOLD)
    .sort((a, b) => b.confidence - a.confidence)
    .map((entry) => ({
      type: entry.type,
      value: entry.value,
    }));

  return { primary, alternatives };
}
