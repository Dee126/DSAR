/**
 * Sensitive Data Service — Module 8.3
 *
 * Manages sensitive data flags (Art. 9 GDPR special categories,
 * third-party data) and their review workflow.
 */

import { prisma } from "./prisma";
import { logAudit, getClientInfo } from "./audit";
import type { NextRequest } from "next/server";

const ART9_CATEGORIES = new Set([
  "HEALTH",
  "RELIGION",
  "UNION",
  "POLITICAL_OPINION",
  "OTHER_SPECIAL_CATEGORY",
]);

export function isArt9Category(category: string): boolean {
  return ART9_CATEGORIES.has(category);
}

export async function createSensitiveDataFlag(
  tenantId: string,
  caseId: string,
  userId: string,
  data: {
    documentId?: string;
    responseDocId?: string;
    dataCategory: string;
    description: string;
    pageNumber?: number;
    sectionKey?: string;
  },
  request?: NextRequest,
) {
  const flag = await prisma.sensitiveDataFlag.create({
    data: {
      tenantId,
      caseId,
      documentId: data.documentId,
      responseDocId: data.responseDocId,
      dataCategory: data.dataCategory as any,
      description: data.description,
      pageNumber: data.pageNumber,
      sectionKey: data.sectionKey,
      flaggedByUserId: userId,
    },
  });

  const clientInfo = request ? getClientInfo(request) : {};
  await logAudit({
    tenantId,
    actorUserId: userId,
    action: "SENSITIVE_DATA_FLAGGED",
    entityType: "SensitiveDataFlag",
    entityId: flag.id,
    ...clientInfo,
    details: {
      caseId,
      dataCategory: data.dataCategory,
      isArt9: isArt9Category(data.dataCategory),
    },
  });

  return flag;
}

export async function reviewSensitiveDataFlag(
  tenantId: string,
  flagId: string,
  userId: string,
  data: {
    status: string;
    reviewNote?: string;
  },
  request?: NextRequest,
) {
  const flag = await prisma.sensitiveDataFlag.update({
    where: { id: flagId },
    data: {
      status: data.status as any,
      reviewNote: data.reviewNote,
      reviewedByUserId: userId,
      reviewedAt: new Date(),
    },
  });

  const clientInfo = request ? getClientInfo(request) : {};
  await logAudit({
    tenantId,
    actorUserId: userId,
    action: "SENSITIVE_DATA_REVIEWED",
    entityType: "SensitiveDataFlag",
    entityId: flag.id,
    ...clientInfo,
    details: {
      caseId: flag.caseId,
      status: data.status,
      reviewNote: data.reviewNote,
    },
  });

  return flag;
}

export async function getSensitiveDataFlags(tenantId: string, caseId: string) {
  return prisma.sensitiveDataFlag.findMany({
    where: { tenantId, caseId },
    include: {
      flaggedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Auto-detect sensitive data categories from case system links.
 * Returns a summary of Art. 9 categories found.
 */
export async function detectSensitiveCategories(
  tenantId: string,
  caseId: string,
): Promise<{ category: string; systemName: string; isArt9: boolean }[]> {
  const systemLinks = await prisma.caseSystemLink.findMany({
    where: { tenantId, caseId },
    include: {
      system: {
        include: { dataCategories: true },
      },
    },
  });

  const results: { category: string; systemName: string; isArt9: boolean }[] = [];
  for (const link of systemLinks) {
    for (const dc of link.system.dataCategories) {
      if (isArt9Category(dc.category)) {
        results.push({
          category: dc.category,
          systemName: link.system.name,
          isArt9: true,
        });
      }
    }
  }
  return results;
}
