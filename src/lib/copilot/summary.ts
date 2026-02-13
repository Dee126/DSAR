/**
 * Summary Generation Service — Privacy Copilot
 *
 * Generates CopilotSummary records backed entirely by structured evidence.
 * Every claim in the generated text references actual Findings and EvidenceItems
 * from the database. NO LLM hallucination — all output is deterministic and
 * evidence-based.
 *
 * Summary types:
 *   - LOCATION_OVERVIEW:  Where data was found (grouped by provider + location)
 *   - CATEGORY_OVERVIEW:  What categories of data were found (grouped by DataCategory)
 *   - DSAR_DRAFT:         A formal DSAR response draft referencing evidence
 *   - RISK_SUMMARY:       Risk flags (legal review, special categories, third-party)
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The set of Art. 9 special-category DataCategory values. */
const SPECIAL_CATEGORY_VALUES = new Set([
  "HEALTH",
  "RELIGION",
  "UNION",
  "POLITICAL_OPINION",
  "OTHER_SPECIAL_CATEGORY",
]);

// ---------------------------------------------------------------------------
// Helper: Evidence snapshot hash
// ---------------------------------------------------------------------------

/**
 * Compute a SHA-256 hash of sorted evidence item IDs.
 *
 * This hash acts as a snapshot fingerprint so that consumers can verify
 * whether the summary still matches the current evidence state. If new
 * evidence is added after the summary was generated, the hash will differ.
 */
export function computeEvidenceSnapshotHash(evidenceItemIds: string[]): string {
  const sorted = [...evidenceItemIds].sort();
  const digest = createHash("sha256")
    .update(sorted.join(","))
    .digest("hex");
  return digest;
}

// ---------------------------------------------------------------------------
// Internal: validate run belongs to tenant
// ---------------------------------------------------------------------------

async function loadAndValidateRun(tenantId: string, runId: string) {
  const run = await prisma.copilotRun.findFirst({
    where: { id: runId, tenantId },
  });

  if (!run) {
    throw new Error(
      `CopilotRun ${runId} not found or does not belong to tenant ${tenantId}`
    );
  }

  return run;
}

// ---------------------------------------------------------------------------
// 1. LOCATION_OVERVIEW
// ---------------------------------------------------------------------------

/**
 * Generate a LOCATION_OVERVIEW summary for a copilot run.
 *
 * Groups all EvidenceItems by provider and location, producing a structured
 * text overview of where data was found. Every line references actual
 * evidence records.
 */
export async function generateLocationOverview(
  tenantId: string,
  caseId: string,
  runId: string,
  userId: string
) {
  await loadAndValidateRun(tenantId, runId);

  // Load all evidence items for this run
  const evidenceItems = await prisma.evidenceItem.findMany({
    where: { tenantId, runId },
    orderBy: { createdAt: "asc" },
  });

  // Group by provider + location
  const providerGroups = new Map<
    string,
    {
      locations: Map<string, { count: number; itemTypes: Set<string> }>;
    }
  >();

  for (const item of evidenceItems) {
    let group = providerGroups.get(item.provider);
    if (!group) {
      group = { locations: new Map() };
      providerGroups.set(item.provider, group);
    }

    let locationEntry = group.locations.get(item.location);
    if (!locationEntry) {
      locationEntry = { count: 0, itemTypes: new Set() };
      group.locations.set(item.location, locationEntry);
    }

    locationEntry.count += 1;
    locationEntry.itemTypes.add(item.itemType);
  }

  // Build the summary text
  const lines: string[] = [];
  lines.push("=== Data Location Overview ===");

  const providerNames = Array.from(providerGroups.keys());
  if (providerNames.length > 0) {
    lines.push(`Based on evidence from: ${providerNames.join(", ")}`);
  } else {
    lines.push("No evidence items found for this run.");
  }

  lines.push("");

  const providerEntries = Array.from(providerGroups.entries());
  for (const [provider, group] of providerEntries) {
    lines.push(`${provider}:`);
    const locationEntries = Array.from(group.locations.entries());
    for (const [location, info] of locationEntries) {
      const itemTypesStr = Array.from(info.itemTypes).join(", ");
      lines.push(`  - ${info.count} record(s) found at ${location}`);
      lines.push(`  - Item types: ${itemTypesStr}`);
    }
    lines.push("");
  }

  lines.push(
    "Disclaimer: This overview is based on automated discovery. Absence of results does not guarantee absence of data."
  );

  const content = lines.join("\n");

  // Compute evidence snapshot hash
  const evidenceItemIds = evidenceItems.map((e) => e.id);
  const evidenceSnapshotHash = computeEvidenceSnapshotHash(evidenceItemIds);

  // Create the CopilotSummary record
  const summary = await prisma.copilotSummary.create({
    data: {
      tenantId,
      caseId,
      runId,
      createdByUserId: userId,
      summaryType: "LOCATION_OVERVIEW",
      content,
      evidenceSnapshotHash,
      disclaimerIncluded: true,
    },
  });

  await logAudit({
    tenantId,
    actorUserId: userId,
    action: "copilot_summary.generated",
    entityType: "CopilotSummary",
    entityId: summary.id,
    details: {
      caseId,
      runId,
      summaryType: "LOCATION_OVERVIEW",
      evidenceItemCount: evidenceItems.length,
      evidenceSnapshotHash,
    },
  });

  return summary;
}

// ---------------------------------------------------------------------------
// 2. CATEGORY_OVERVIEW
// ---------------------------------------------------------------------------

/**
 * Generate a CATEGORY_OVERVIEW summary for a copilot run.
 *
 * Groups all Findings by dataCategory, listing counts, severity levels,
 * and whether each requires legal review. If any finding contains
 * Art. 9 special-category data, an appropriate warning is included.
 */
export async function generateCategoryOverview(
  tenantId: string,
  caseId: string,
  runId: string,
  userId: string
) {
  await loadAndValidateRun(tenantId, runId);

  // Load all findings for this run
  const findings = await prisma.finding.findMany({
    where: { tenantId, runId },
    orderBy: { dataCategory: "asc" },
  });

  // Group by dataCategory
  const categoryGroups = new Map<
    string,
    {
      count: number;
      severities: Set<string>;
      requiresLegalReview: boolean;
      containsSpecialCategory: boolean;
    }
  >();

  let anySpecialCategory = false;

  for (const finding of findings) {
    let group = categoryGroups.get(finding.dataCategory);
    if (!group) {
      group = {
        count: 0,
        severities: new Set(),
        requiresLegalReview: false,
        containsSpecialCategory: false,
      };
      categoryGroups.set(finding.dataCategory, group);
    }

    group.count += 1;
    group.severities.add(finding.severity);

    if (finding.requiresLegalReview) {
      group.requiresLegalReview = true;
    }
    if (finding.containsSpecialCategory) {
      group.containsSpecialCategory = true;
      anySpecialCategory = true;
    }
  }

  // Build the summary text
  const lines: string[] = [];
  lines.push("=== Data Category Overview ===");
  lines.push("");

  if (categoryGroups.size === 0) {
    lines.push("No findings were produced for this run.");
  } else {
    lines.push(`Total categories found: ${categoryGroups.size}`);
    lines.push(`Total findings: ${findings.length}`);
    lines.push("");

    const categoryEntries = Array.from(categoryGroups.entries());
    for (const [category, group] of categoryEntries) {
      const severitiesStr = Array.from(group.severities).join(", ");
      const legalReviewStr = group.requiresLegalReview ? "Yes" : "No";
      const specialStr = group.containsSpecialCategory
        ? " [SPECIAL CATEGORY]"
        : "";

      lines.push(`${category}${specialStr}:`);
      lines.push(`  - Finding count: ${group.count}`);
      lines.push(`  - Severity level(s): ${severitiesStr}`);
      lines.push(`  - Requires legal review: ${legalReviewStr}`);
      lines.push("");
    }
  }

  if (anySpecialCategory) {
    lines.push(
      "*** WARNING: Art. 9 GDPR Special Category Data Detected ***"
    );
    lines.push(
      "One or more findings contain special category data as defined by Art. 9 GDPR"
    );
    lines.push(
      "(e.g., health data, religious beliefs, trade union membership, political opinions)."
    );
    lines.push(
      "Legal review and explicit approval are required before this data may be disclosed."
    );
    lines.push("");
  }

  lines.push(
    "Disclaimer: This overview is based on automated discovery and classification. Manual review is recommended."
  );

  const content = lines.join("\n");

  // Compute evidence snapshot hash from finding-referenced evidence item IDs
  const allEvidenceItemIds = findings.flatMap((f) => f.evidenceItemIds);
  const uniqueEvidenceItemIds = Array.from(new Set(allEvidenceItemIds));
  const evidenceSnapshotHash = computeEvidenceSnapshotHash(uniqueEvidenceItemIds);

  const summary = await prisma.copilotSummary.create({
    data: {
      tenantId,
      caseId,
      runId,
      createdByUserId: userId,
      summaryType: "CATEGORY_OVERVIEW",
      content,
      evidenceSnapshotHash,
      disclaimerIncluded: true,
    },
  });

  await logAudit({
    tenantId,
    actorUserId: userId,
    action: "copilot_summary.generated",
    entityType: "CopilotSummary",
    entityId: summary.id,
    details: {
      caseId,
      runId,
      summaryType: "CATEGORY_OVERVIEW",
      findingCount: findings.length,
      categoryCount: categoryGroups.size,
      containsSpecialCategory: anySpecialCategory,
      evidenceSnapshotHash,
    },
  });

  return summary;
}

// ---------------------------------------------------------------------------
// 3. DSAR_DRAFT
// ---------------------------------------------------------------------------

/**
 * Generate a DSAR_DRAFT summary for a copilot run.
 *
 * Produces a formal DSAR response draft with structured sections referencing
 * the case details, systems searched, data categories found, and findings
 * per system. The draft includes an annex reference and a mandatory note
 * that manual review is required.
 */
export async function generateDsarDraft(
  tenantId: string,
  caseId: string,
  runId: string,
  userId: string
) {
  await loadAndValidateRun(tenantId, runId);

  // Load the case with data subject
  const dsarCase = await prisma.dSARCase.findFirst({
    where: { id: caseId, tenantId },
    include: { dataSubject: true },
  });

  if (!dsarCase) {
    throw new Error(
      `DSARCase ${caseId} not found or does not belong to tenant ${tenantId}`
    );
  }

  // Load findings and evidence items
  const findings = await prisma.finding.findMany({
    where: { tenantId, runId },
    orderBy: { dataCategory: "asc" },
  });

  const evidenceItems = await prisma.evidenceItem.findMany({
    where: { tenantId, runId },
    orderBy: { provider: "asc" },
  });

  // Build list of unique providers from evidence
  const providers = Array.from(new Set(evidenceItems.map((e) => e.provider)));

  // Build list of unique data categories from findings
  const dataCategories = Array.from(new Set(findings.map((f) => f.dataCategory)));

  // Group findings by provider (via evidence item IDs)
  const evidenceById = new Map(evidenceItems.map((e) => [e.id, e]));
  const findingsByProvider = new Map<string, typeof findings>();

  for (const finding of findings) {
    for (const evidenceItemId of finding.evidenceItemIds) {
      const evidence = evidenceById.get(evidenceItemId);
      if (evidence) {
        const provider = evidence.provider;
        const existing = findingsByProvider.get(provider) ?? [];
        // Avoid duplicating the same finding under the same provider
        if (!existing.some((f) => f.id === finding.id)) {
          existing.push(finding);
          findingsByProvider.set(provider, existing);
        }
      }
    }
  }

  // Build the draft
  const lines: string[] = [];
  lines.push("=== DSAR Response Draft ===");
  lines.push("");

  // Section 1: Subject of the request
  lines.push("1. Subject of the Request");
  lines.push(`   Case Number: ${dsarCase.caseNumber}`);
  lines.push(`   Request Type: ${dsarCase.type}`);
  lines.push(`   Data Subject: ${dsarCase.dataSubject.fullName}`);
  if (dsarCase.dataSubject.email) {
    lines.push(`   Contact Email: ${dsarCase.dataSubject.email}`);
  }
  lines.push("");

  // Section 2: Systems searched
  lines.push("2. Systems Searched");
  if (providers.length > 0) {
    for (const provider of providers) {
      lines.push(`   - ${provider}`);
    }
  } else {
    lines.push("   No systems were queried in this run.");
  }
  lines.push("");

  // Section 3: Categories of personal data found
  lines.push("3. Categories of Personal Data Found");
  if (dataCategories.length > 0) {
    for (const category of dataCategories) {
      const isSpecial = SPECIAL_CATEGORY_VALUES.has(category);
      const marker = isSpecial ? " [Art. 9 Special Category]" : "";
      lines.push(`   - ${category}${marker}`);
    }
  } else {
    lines.push("   No personal data categories were identified.");
  }
  lines.push("");

  // Section 4: Summary of findings per system
  lines.push("4. Summary of Findings per System");
  if (findingsByProvider.size > 0) {
    const findingsByProviderEntries = Array.from(findingsByProvider.entries());
    for (const [provider, providerFindings] of findingsByProviderEntries) {
      lines.push(`   ${provider}:`);
      for (const finding of providerFindings) {
        const specialMarker = finding.containsSpecialCategory
          ? " [SPECIAL CATEGORY]"
          : "";
        lines.push(
          `     - ${finding.dataCategory} (${finding.severity})${specialMarker}: ${finding.summary}`
        );
      }
      lines.push("");
    }
  } else {
    lines.push("   No findings to report.");
    lines.push("");
  }

  // Section 5: Annex reference
  lines.push("5. Annex");
  lines.push("   See attached Evidence Index for a complete listing of all");
  lines.push("   evidence items and their metadata.");
  lines.push("");

  // Note
  lines.push("---");
  lines.push(
    "Note: This draft was generated from structured evidence. Manual review"
  );
  lines.push("is required before sending to the data subject.");
  lines.push("");

  // Disclaimer
  lines.push(
    "Disclaimer: This response draft is based on automated discovery and does not"
  );
  lines.push(
    "constitute legal advice. All information should be verified by the DPO or legal"
  );
  lines.push("counsel before disclosure.");

  const content = lines.join("\n");

  // Compute evidence snapshot hash
  const evidenceItemIds = evidenceItems.map((e) => e.id);
  const evidenceSnapshotHash = computeEvidenceSnapshotHash(evidenceItemIds);

  const summary = await prisma.copilotSummary.create({
    data: {
      tenantId,
      caseId,
      runId,
      createdByUserId: userId,
      summaryType: "DSAR_DRAFT",
      content,
      evidenceSnapshotHash,
      disclaimerIncluded: true,
    },
  });

  await logAudit({
    tenantId,
    actorUserId: userId,
    action: "copilot_summary.generated",
    entityType: "CopilotSummary",
    entityId: summary.id,
    details: {
      caseId,
      runId,
      summaryType: "DSAR_DRAFT",
      caseNumber: dsarCase.caseNumber,
      caseType: dsarCase.type,
      providerCount: providers.length,
      findingCount: findings.length,
      evidenceItemCount: evidenceItems.length,
      evidenceSnapshotHash,
    },
  });

  return summary;
}

// ---------------------------------------------------------------------------
// 4. RISK_SUMMARY
// ---------------------------------------------------------------------------

/**
 * Generate a RISK_SUMMARY for a copilot run.
 *
 * Lists all risk indicators found during discovery:
 *   - Findings that require legal review
 *   - Special-category (Art. 9) detections
 *   - Third-party data suspicions
 */
export async function generateRiskSummary(
  tenantId: string,
  caseId: string,
  runId: string,
  userId: string
) {
  await loadAndValidateRun(tenantId, runId);

  // Load all findings for this run
  const findings = await prisma.finding.findMany({
    where: { tenantId, runId },
    orderBy: { severity: "desc" },
  });

  // Partition findings into risk categories
  const legalReviewFindings = findings.filter((f) => f.requiresLegalReview);
  const specialCategoryFindings = findings.filter(
    (f) => f.containsSpecialCategory
  );
  const thirdPartyFindings = findings.filter(
    (f) => f.containsThirdPartyDataSuspected
  );

  // Build the summary text
  const lines: string[] = [];
  lines.push("=== Risk Summary ===");
  lines.push("");

  // Legal review required
  lines.push("1. Findings Requiring Legal Review");
  if (legalReviewFindings.length > 0) {
    lines.push(
      `   ${legalReviewFindings.length} finding(s) flagged for legal review:`
    );
    for (const finding of legalReviewFindings) {
      lines.push(
        `   - ${finding.dataCategory} (${finding.severity}): ${finding.summary}`
      );
      lines.push(
        `     Evidence items: ${finding.evidenceItemIds.length}, Confidence: ${(finding.confidence * 100).toFixed(0)}%`
      );
    }
  } else {
    lines.push("   No findings require legal review.");
  }
  lines.push("");

  // Special category detections
  lines.push("2. Special Category Data Detections (Art. 9 GDPR)");
  if (specialCategoryFindings.length > 0) {
    lines.push(
      `   ${specialCategoryFindings.length} finding(s) contain special category data:`
    );
    for (const finding of specialCategoryFindings) {
      lines.push(
        `   - ${finding.dataCategory} (${finding.severity}): ${finding.summary}`
      );
    }
    lines.push("");
    lines.push(
      "   *** Art. 9 GDPR requires explicit legal basis and heightened protection ***"
    );
    lines.push(
      "   *** for processing special category data. Review is mandatory. ***"
    );
  } else {
    lines.push("   No special category data detected.");
  }
  lines.push("");

  // Third-party data suspicions
  lines.push("3. Third-Party Data Suspicions");
  if (thirdPartyFindings.length > 0) {
    lines.push(
      `   ${thirdPartyFindings.length} finding(s) may contain third-party personal data:`
    );
    for (const finding of thirdPartyFindings) {
      lines.push(
        `   - ${finding.dataCategory} (${finding.severity}): ${finding.summary}`
      );
    }
    lines.push("");
    lines.push(
      "   Third-party data must be redacted or excluded from the DSAR response"
    );
    lines.push(
      "   unless the third party has consented to disclosure."
    );
  } else {
    lines.push("   No third-party data suspicions identified.");
  }
  lines.push("");

  // Overall risk assessment
  const hasRisks =
    legalReviewFindings.length > 0 ||
    specialCategoryFindings.length > 0 ||
    thirdPartyFindings.length > 0;

  lines.push("4. Overall Risk Assessment");
  if (hasRisks) {
    const riskFactors: string[] = [];
    if (legalReviewFindings.length > 0) {
      riskFactors.push(`${legalReviewFindings.length} legal review item(s)`);
    }
    if (specialCategoryFindings.length > 0) {
      riskFactors.push(
        `${specialCategoryFindings.length} special category detection(s)`
      );
    }
    if (thirdPartyFindings.length > 0) {
      riskFactors.push(
        `${thirdPartyFindings.length} third-party data suspicion(s)`
      );
    }
    lines.push(`   Risk factors identified: ${riskFactors.join(", ")}`);
    lines.push(
      "   Recommendation: Manual review by DPO or legal counsel before proceeding."
    );
  } else {
    lines.push("   No significant risk factors identified.");
    lines.push(
      "   Standard processing may proceed, subject to organizational policy."
    );
  }
  lines.push("");

  lines.push(
    "Disclaimer: This risk summary is based on automated analysis and does not replace professional legal assessment."
  );

  const content = lines.join("\n");

  // Compute evidence snapshot hash from finding-referenced evidence item IDs
  const allEvidenceItemIds = findings.flatMap((f) => f.evidenceItemIds);
  const uniqueEvidenceItemIds = Array.from(new Set(allEvidenceItemIds));
  const evidenceSnapshotHash = computeEvidenceSnapshotHash(uniqueEvidenceItemIds);

  const summary = await prisma.copilotSummary.create({
    data: {
      tenantId,
      caseId,
      runId,
      createdByUserId: userId,
      summaryType: "RISK_SUMMARY",
      content,
      evidenceSnapshotHash,
      disclaimerIncluded: true,
    },
  });

  await logAudit({
    tenantId,
    actorUserId: userId,
    action: "copilot_summary.generated",
    entityType: "CopilotSummary",
    entityId: summary.id,
    details: {
      caseId,
      runId,
      summaryType: "RISK_SUMMARY",
      findingCount: findings.length,
      legalReviewCount: legalReviewFindings.length,
      specialCategoryCount: specialCategoryFindings.length,
      thirdPartyCount: thirdPartyFindings.length,
      evidenceSnapshotHash,
    },
  });

  return summary;
}
