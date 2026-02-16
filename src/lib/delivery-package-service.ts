import { createHash } from "crypto";
import { prisma } from "./prisma";
import { ApiError } from "./errors";

interface BuildPackageInput {
  tenantId: string;
  caseId: string;
  generatedByUserId: string;
  responseDocIds: string[];
  documentIds?: string[];
}

/**
 * Build a delivery package from selected response documents and evidence documents.
 * Creates a manifest and computes a checksum for integrity verification.
 */
export async function buildDeliveryPackage(input: BuildPackageInput) {
  // Validate that the response docs belong to this case and tenant
  const responseDocs = await prisma.responseDocument.findMany({
    where: {
      id: { in: input.responseDocIds },
      tenantId: input.tenantId,
      caseId: input.caseId,
    },
    select: {
      id: true,
      version: true,
      status: true,
      language: true,
      storageKeyPdf: true,
      storageKeyDocx: true,
      createdAt: true,
    },
  });

  if (responseDocs.length === 0) {
    throw new ApiError(400, "No valid response documents found for this case");
  }

  // Check that at least one doc is approved or sent
  const hasApproved = responseDocs.some(
    (d) => d.status === "APPROVED" || d.status === "SENT"
  );
  if (!hasApproved) {
    throw new ApiError(
      400,
      "At least one response document must be approved before creating a delivery package"
    );
  }

  // Validate evidence documents if provided
  let evidenceDocs: Array<{
    id: string;
    filename: string;
    contentType: string;
    storageKey: string;
    size: number;
  }> = [];
  if (input.documentIds && input.documentIds.length > 0) {
    evidenceDocs = await prisma.document.findMany({
      where: {
        id: { in: input.documentIds },
        tenantId: input.tenantId,
        caseId: input.caseId,
        deletedAt: null,
      },
      select: {
        id: true,
        filename: true,
        contentType: true,
        storageKey: true,
        size: true,
      },
    });
  }

  // Build manifest
  const manifestFiles: Array<{
    name: string;
    type: string;
    size?: number;
    source: string;
    id: string;
  }> = [];

  for (const doc of responseDocs) {
    if (doc.storageKeyPdf) {
      manifestFiles.push({
        name: `response_v${doc.version}_${doc.language}.pdf`,
        type: "application/pdf",
        source: "response",
        id: doc.id,
      });
    }
    if (doc.storageKeyDocx) {
      manifestFiles.push({
        name: `response_v${doc.version}_${doc.language}.docx`,
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        source: "response",
        id: doc.id,
      });
    }
    // Always include HTML-based document entry
    if (!doc.storageKeyPdf && !doc.storageKeyDocx) {
      manifestFiles.push({
        name: `response_v${doc.version}_${doc.language}.html`,
        type: "text/html",
        source: "response",
        id: doc.id,
      });
    }
  }

  for (const doc of evidenceDocs) {
    manifestFiles.push({
      name: doc.filename,
      type: doc.contentType,
      size: doc.size,
      source: "evidence",
      id: doc.id,
    });
  }

  // Compute manifest checksum
  const manifestString = JSON.stringify(manifestFiles);
  const checksum = createHash("sha256").update(manifestString).digest("hex");

  const pkg = await prisma.deliveryPackage.create({
    data: {
      tenantId: input.tenantId,
      caseId: input.caseId,
      generatedByUserId: input.generatedByUserId,
      includedResponseDocIds: input.responseDocIds,
      includedDocumentIds: input.documentIds ?? [],
      manifestJson: { files: manifestFiles } as any,
      checksumSha256: checksum,
    },
  });

  return pkg;
}

/**
 * Get delivery packages for a case.
 */
export async function getDeliveryPackages(tenantId: string, caseId: string) {
  return prisma.deliveryPackage.findMany({
    where: { tenantId, caseId },
    include: {
      generatedBy: { select: { id: true, name: true, email: true } },
      links: {
        select: {
          id: true,
          status: true,
          expiresAt: true,
          usedDownloads: true,
          maxDownloads: true,
          subjectContact: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Compute a SHA-256 checksum for a buffer.
 */
export function computeChecksum(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}
