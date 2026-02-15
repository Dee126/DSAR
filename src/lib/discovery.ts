/**
 * Discovery Engine — maps DSAR cases to likely affected systems.
 *
 * Scoring formula per system:
 *   baseWeight       = discovery rule weight (1–100)
 *   identifierBoost  = +15 per matching identifier type (capped at +30)
 *   confidenceBoost  = +0..10 proportional to system confidence score
 *   outOfScopePenalty = -100 if system.inScopeForDsar === false
 *
 *   finalScore = baseWeight + identifierBoost + confidenceBoost + outOfScopePenalty
 *   Clamped to 0–100.
 *
 * Systems are ranked by finalScore descending. Systems scoring <= 0 are excluded.
 */

export type DSARType = "ACCESS" | "ERASURE" | "RECTIFICATION" | "RESTRICTION" | "PORTABILITY" | "OBJECTION";

export interface DiscoveryInput {
  dsarType: DSARType;
  dataSubjectType?: string;           // "customer" | "employee" | "applicant" | "visitor"
  identifierTypes: string[];          // e.g. ["email", "phone", "customerId"]
}

export interface DiscoveryRule {
  id: string;
  systemId: string;
  dsarTypes: string[];
  dataSubjectTypes: string[];
  identifierTypes: string[];
  weight: number;
  active: boolean;
  conditions?: Record<string, unknown> | null;
}

export interface SystemInfo {
  id: string;
  name: string;
  inScopeForDsar: boolean;
  confidenceScore: number;            // 0–100 (pre-computed)
  identifierTypes: string[];          // What identifier types this system supports
}

export interface DiscoverySuggestion {
  systemId: string;
  systemName: string;
  score: number;
  reasons: string[];
}

/**
 * Run the discovery engine.
 *
 * @param input   The DSAR case parameters
 * @param rules   All active discovery rules for the tenant
 * @param systems Map of systemId → SystemInfo for all relevant systems
 * @returns Suggested systems ranked by score descending
 */
export function runDiscovery(
  input: DiscoveryInput,
  rules: DiscoveryRule[],
  systems: Map<string, SystemInfo>,
): DiscoverySuggestion[] {
  // Group rules by system and aggregate the best matching score
  const systemScores = new Map<string, { score: number; reasons: string[] }>();

  for (const rule of rules) {
    if (!rule.active) continue;

    // Rule must match the DSAR type
    if (!rule.dsarTypes.includes(input.dsarType)) continue;

    // If rule specifies dataSubjectTypes, must match
    if (
      rule.dataSubjectTypes.length > 0 &&
      input.dataSubjectType &&
      !rule.dataSubjectTypes.includes(input.dataSubjectType)
    ) {
      continue;
    }

    const system = systems.get(rule.systemId);
    if (!system) continue;

    const reasons: string[] = [];
    let score = rule.weight;
    reasons.push(`Rule "${rule.id}" matched (weight: ${rule.weight})`);

    // Identifier boost: +15 per matching identifier type, capped at 30
    let identifierBoost = 0;
    const matchedIdentifiers: string[] = [];
    for (const idType of input.identifierTypes) {
      if (system.identifierTypes.includes(idType) || rule.identifierTypes.includes(idType)) {
        identifierBoost += 15;
        matchedIdentifiers.push(idType);
      }
    }
    identifierBoost = Math.min(identifierBoost, 30);
    if (identifierBoost > 0) {
      score += identifierBoost;
      reasons.push(`Identifier match: ${matchedIdentifiers.join(", ")} (+${identifierBoost})`);
    }

    // Confidence boost: proportional to system's confidence score
    const confidenceBoost = Math.round(system.confidenceScore / 10);
    if (confidenceBoost > 0) {
      score += confidenceBoost;
      reasons.push(`System confidence: ${system.confidenceScore}% (+${confidenceBoost})`);
    }

    // Out-of-scope penalty
    if (!system.inScopeForDsar) {
      score -= 100;
      reasons.push("System marked out of scope for DSAR (-100)");
    }

    // Clamp
    score = Math.max(0, Math.min(100, score));

    // Keep best score per system
    const existing = systemScores.get(rule.systemId);
    if (!existing || score > existing.score) {
      systemScores.set(rule.systemId, { score, reasons });
    }
  }

  // Build sorted suggestions
  const suggestions: DiscoverySuggestion[] = [];
  systemScores.forEach(({ score, reasons }, systemId) => {
    if (score <= 0) return;
    const system = systems.get(systemId);
    suggestions.push({
      systemId,
      systemName: system?.name ?? "Unknown",
      score,
      reasons,
    });
  });

  suggestions.sort((a, b) => b.score - a.score);
  return suggestions;
}
