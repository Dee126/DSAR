/**
 * Data Assembly Service
 *
 * Compiles a "Case Fact Pack" JSON from the case and related modules.
 * This fact pack is used by the Generator to fill in template placeholders.
 *
 * MINIMIZATION RULES:
 * - No raw personal data in generated narrative by default
 * - Summarize categories and counts; raw exports are attachments
 * - Include only necessary identifiers (e.g., masked email)
 */

import { prisma } from "./prisma";

export interface FactPack {
  // Case basics
  caseNumber: string;
  caseType: string;
  caseTypes: string[];
  caseStatus: string;
  casePriority: string;
  caseDescription: string;
  receivedAt: string;
  // Subject (minimized)
  subjectName: string;
  subjectEmail: string; // masked
  subjectPreferredLanguage: string;
  // Deadlines
  dueDate: string;
  effectiveDueDate: string;
  extendedDueDate: string | null;
  extensionReason: string | null;
  extensionUsed: boolean;
  daysRemaining: number;
  isOverdue: boolean;
  // IDV
  identityVerified: boolean;
  idvMethod: string | null;
  idvApprovedAt: string | null;
  // Systems & collection
  systemCount: number;
  systemsInvolved: Array<{
    name: string;
    collectionStatus: string;
    dataCategories: string[];
    lawfulBasis: string | null;
    retentionPeriod: string | null;
    processingPurpose: string | null;
    thirdCountryTransfers: boolean;
  }>;
  collectionComplete: boolean;
  totalRecordsFound: number;
  // Categories summary
  dataCategoriesFound: string[];
  specialCategoryData: boolean;
  // Recipients / processors
  recipientCategories: string[];
  thirdCountryTransfersExist: boolean;
  // Lawful basis & purposes
  lawfulBasisSummary: string[];
  processingPurposes: string[];
  // Retention
  retentionSummary: Array<{ category: string; period: string }>;
  // Legal review
  legalReviewStatus: string | null;
  exemptionsApplied: string[];
  // Organization
  tenantName: string;
  // Placeholder values for template rendering
  placeholderValues: Record<string, string>;
}

/**
 * Assemble a fact pack for a specific case.
 * All data is tenant-scoped.
 */
export async function assembleFactPack(
  tenantId: string,
  caseId: string,
): Promise<FactPack> {
  const dsarCase = await prisma.dSARCase.findFirst({
    where: { id: caseId, tenantId },
    include: {
      dataSubject: true,
      tenant: { select: { name: true } },
      caseSystemLinks: {
        include: {
          system: {
            include: {
              dataCategories: true,
              processors: true,
            },
          },
        },
      },
      dataCollectionItems: true,
      legalReviews: { orderBy: { createdAt: "desc" }, take: 1 },
      idvRequest: {
        include: { decisions: { orderBy: { decidedAt: "desc" }, take: 1 } },
      },
      deadline: true,
    },
  });

  if (!dsarCase) {
    throw new Error(`Case ${caseId} not found for tenant ${tenantId}`);
  }

  // Mask email for minimization
  const maskedEmail = maskEmail(dsarCase.dataSubject.email || "");

  // Systems
  const systemsInvolved = dsarCase.caseSystemLinks.map((link) => ({
    name: link.system.name,
    collectionStatus: link.collectionStatus,
    dataCategories: link.system.dataCategories.map((dc) => dc.category),
    lawfulBasis: link.system.dataCategories[0]?.lawfulBasis || null,
    retentionPeriod: link.system.dataCategories[0]?.retentionPeriod || null,
    processingPurpose: link.system.dataCategories[0]?.processingPurpose || null,
    thirdCountryTransfers: link.system.thirdCountryTransfers,
  }));

  const collectionComplete = dsarCase.dataCollectionItems.every(
    (d) => d.status === "COMPLETED" || d.status === "NOT_APPLICABLE",
  );

  const totalRecordsFound = dsarCase.dataCollectionItems.reduce(
    (sum, d) => sum + (d.recordsFound || 0), 0,
  );

  // Categories
  const allCategories = new Set<string>();
  let hasSpecial = false;
  const lawfulBases = new Set<string>();
  const purposes = new Set<string>();
  const retentionMap = new Map<string, string>();

  dsarCase.caseSystemLinks.forEach((link) => {
    link.system.dataCategories.forEach((dc) => {
      allCategories.add(dc.category);
      if (["HEALTH", "RELIGION", "UNION", "POLITICAL_OPINION", "OTHER_SPECIAL_CATEGORY"].includes(dc.category)) {
        hasSpecial = true;
      }
      lawfulBases.add(dc.lawfulBasis);
      if (dc.processingPurpose) purposes.add(dc.processingPurpose);
      if (dc.retentionPeriod) retentionMap.set(dc.category, dc.retentionPeriod);
    });
  });

  // Recipient categories (processor names)
  const recipientCategories = new Set<string>();
  dsarCase.caseSystemLinks.forEach((link) => {
    link.system.processors.forEach((p) => {
      recipientCategories.add(p.vendorName);
    });
  });

  const thirdCountryTransfersExist = systemsInvolved.some((s) => s.thirdCountryTransfers);

  // Deadlines
  const deadline = dsarCase.deadline;
  const effectiveDueDate = deadline?.effectiveDueAt || dsarCase.dueDate;
  const daysRemaining = Math.ceil(
    (new Date(effectiveDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  // IDV
  const idvDecision = dsarCase.idvRequest?.decisions?.[0];

  // Legal review
  const latestReview = dsarCase.legalReviews[0];
  const exemptions = (latestReview?.exemptionsApplied as string[]) || [];

  // Build placeholder values
  const dateFormatter = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const placeholderValues: Record<string, string> = {
    "case.number": dsarCase.caseNumber,
    "case.type": dsarCase.type,
    "case.received_date": dateFormatter(dsarCase.receivedAt),
    "case.due_date": dateFormatter(effectiveDueDate),
    "case.description": dsarCase.description || "",
    "subject.name": dsarCase.dataSubject.fullName,
    "subject.email": maskedEmail,
    "tenant.name": dsarCase.tenant.name,
    "deadlines.effective_due_date": dateFormatter(effectiveDueDate),
    "deadlines.extension_reason": dsarCase.extensionReason || "",
    "deadlines.days_remaining": String(daysRemaining),
    "idv.status": dsarCase.identityVerified ? "verified" : "not verified",
    "idv.method": idvDecision ? "document verification" : "N/A",
    "systems.count": String(systemsInvolved.length),
    "systems.names": systemsInvolved.map((s) => s.name).join(", "),
    "data.categories": Array.from(allCategories).join(", "),
    "data.total_records": String(totalRecordsFound),
    "legal.exemptions": exemptions.join(", ") || "None",
    "legal.lawful_basis": Array.from(lawfulBases).join(", "),
    "recipients.categories": Array.from(recipientCategories).join(", ") || "None",
    "retention.summary": Array.from(retentionMap.entries()).map(([c, p]) => `${c}: ${p}`).join("; ") || "As per policy",
    "current_date": dateFormatter(new Date()),
  };

  return {
    caseNumber: dsarCase.caseNumber,
    caseType: dsarCase.type,
    caseTypes: [dsarCase.type],
    caseStatus: dsarCase.status,
    casePriority: dsarCase.priority,
    caseDescription: dsarCase.description || "",
    receivedAt: dsarCase.receivedAt.toISOString(),
    subjectName: dsarCase.dataSubject.fullName,
    subjectEmail: maskedEmail,
    subjectPreferredLanguage: dsarCase.dataSubject.preferredLanguage || "en",
    dueDate: dsarCase.dueDate.toISOString(),
    effectiveDueDate: new Date(effectiveDueDate).toISOString(),
    extendedDueDate: dsarCase.extendedDueDate?.toISOString() || null,
    extensionReason: dsarCase.extensionReason || null,
    extensionUsed: !!dsarCase.extendedDueDate,
    daysRemaining,
    isOverdue: daysRemaining < 0,
    identityVerified: dsarCase.identityVerified,
    idvMethod: idvDecision ? "DOC_UPLOAD" : null,
    idvApprovedAt: idvDecision?.decidedAt?.toISOString() || null,
    systemCount: systemsInvolved.length,
    systemsInvolved,
    collectionComplete,
    totalRecordsFound,
    dataCategoriesFound: Array.from(allCategories),
    specialCategoryData: hasSpecial,
    recipientCategories: Array.from(recipientCategories),
    thirdCountryTransfersExist,
    lawfulBasisSummary: Array.from(lawfulBases),
    processingPurposes: Array.from(purposes),
    retentionSummary: Array.from(retentionMap.entries()).map(([category, period]) => ({ category, period })),
    legalReviewStatus: latestReview?.status || null,
    exemptionsApplied: exemptions,
    tenantName: dsarCase.tenant.name,
    placeholderValues,
  };
}

/**
 * Mask an email address for data minimization.
 * e.g., "john.doe@example.com" → "j***.d**@example.com"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email || "";
  const [local, domain] = email.split("@");
  if (local.length <= 1) return `${local}***@${domain}`;
  return `${local[0]}***@${domain}`;
}
