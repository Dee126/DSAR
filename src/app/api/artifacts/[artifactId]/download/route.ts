/**
 * Unified Artifact Download Endpoint
 *
 * GET /api/artifacts/:artifactId/download?type=DOCUMENT|IDV_ARTIFACT|RESPONSE_DOC
 *
 * Security:
 * 1. Authentication required
 * 2. RBAC permission check (DOCUMENT_DOWNLOAD)
 * 3. Policy engine: resolves artifact → case → tenant chain
 * 4. Tenant isolation enforced
 * 5. IDOR protection: artifact must belong to actor's tenant + case access
 * 6. Deletion check: cannot download deleted artifacts
 * 7. Access logging (Module 8.4): both audit_log and access_logs
 * 8. File streamed via backend — no direct storage URLs exposed
 *
 * Sprint 9.2: Security Hardening
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { logAllowedAccess, logDeniedAccess } from "@/lib/access-log-middleware";
import { canDownloadArtifact, enforcePolicy, type PolicyActor } from "@/lib/security/policy-engine";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import type { AccessResourceType } from "@prisma/client";

interface RouteParams {
  params: { artifactId: string };
}

const VALID_TYPES = ["DOCUMENT", "IDV_ARTIFACT", "RESPONSE_DOC", "VENDOR_ARTIFACT", "EXPORT_ARTIFACT", "EVIDENCE"] as const;
type ArtifactType = typeof VALID_TYPES[number];

export async function GET(request: NextRequest, { params }: RouteParams) {
  const clientInfo = getClientInfo(request);
  let user: { id: string; tenantId: string; role: string } | undefined;

  try {
    user = await requireAuth();
    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type") as ArtifactType | null;

    if (!type || !VALID_TYPES.includes(type)) {
      throw new ApiError(400, "Query parameter 'type' is required. Valid values: " + VALID_TYPES.join(", "));
    }

    const actor: PolicyActor = {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
    };

    // Policy engine check: RBAC + tenant isolation + IDOR protection
    const decision = await canDownloadArtifact(actor, params.artifactId, type);

    if (!decision.allowed) {
      // Log denied access
      await logDeniedAccess({
        tenantId: user.tenantId,
        userId: user.id,
        accessType: "DOWNLOAD",
        resourceType: type as AccessResourceType,
        resourceId: params.artifactId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        reason: decision.code,
      });

      enforcePolicy(decision);
    }

    // Resolve the actual file to stream
    const fileInfo = await resolveArtifactFile(params.artifactId, type, user.tenantId);
    if (!fileInfo) {
      throw new ApiError(404, "Artifact file not found");
    }

    // Download from storage
    const storage = getStorage();
    const fileBuffer = await storage.download(fileInfo.storageKey);

    // Log allowed access
    await Promise.all([
      logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: `artifact.downloaded`,
        entityType: type,
        entityId: params.artifactId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: {
          artifactType: type,
          filename: fileInfo.filename,
          caseId: fileInfo.caseId,
        },
      }),
      logAllowedAccess({
        tenantId: user.tenantId,
        userId: user.id,
        accessType: "DOWNLOAD",
        resourceType: type as AccessResourceType,
        resourceId: params.artifactId,
        caseId: fileInfo.caseId ?? undefined,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      }),
    ]);

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": fileInfo.contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileInfo.filename)}"`,
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ─── Artifact File Resolution ───────────────────────────────────────────────

interface ArtifactFileInfo {
  storageKey: string;
  filename: string;
  contentType: string;
  caseId: string | null;
}

async function resolveArtifactFile(
  artifactId: string,
  type: ArtifactType,
  tenantId: string,
): Promise<ArtifactFileInfo | null> {
  switch (type) {
    case "DOCUMENT": {
      const doc = await prisma.document.findFirst({
        where: { id: artifactId, tenantId, deletedAt: null },
        select: { storageKey: true, filename: true, contentType: true, caseId: true },
      });
      if (!doc) return null;
      return {
        storageKey: doc.storageKey,
        filename: doc.filename,
        contentType: doc.contentType,
        caseId: doc.caseId,
      };
    }
    case "IDV_ARTIFACT": {
      const artifact = await prisma.idvArtifact.findFirst({
        where: { id: artifactId, tenantId, deletedAt: null },
        select: {
          storageKey: true,
          filename: true,
          mimeType: true,
          request: { select: { caseId: true } },
        },
      });
      if (!artifact) return null;
      return {
        storageKey: artifact.storageKey,
        filename: artifact.filename,
        contentType: artifact.mimeType,
        caseId: artifact.request.caseId,
      };
    }
    case "RESPONSE_DOC": {
      const doc = await prisma.responseDocument.findFirst({
        where: { id: artifactId, tenantId },
        select: { storageKeyPdf: true, caseId: true, language: true, version: true },
      });
      if (!doc || !doc.storageKeyPdf) return null;
      return {
        storageKey: doc.storageKeyPdf,
        filename: `response_v${doc.version}_${doc.language}.pdf`,
        contentType: "application/pdf",
        caseId: doc.caseId,
      };
    }
    default:
      return null;
  }
}
