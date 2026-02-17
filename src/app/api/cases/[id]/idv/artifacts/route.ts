export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError, ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";

/**
 * POST /api/cases/[id]/idv/artifacts — Upload IDV artifact (internal staff upload)
 * Accepts multipart/form-data with fields:
 *   - file: File
 *   - artifactType: string (ID_FRONT, ID_BACK, PASSPORT, etc.)
 *   - consentGiven: "true" | "false"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "IDV_MANAGE");
    const clientInfo = getClientInfo(request);

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });
    if (!dsarCase) throw new ApiError(404, "Case not found");

    const idvRequest = await prisma.idvRequest.findUnique({ where: { caseId: params.id } });
    if (!idvRequest) throw new ApiError(404, "IDV request not found — initialize first");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const artifactType = formData.get("artifactType") as string;
    const consentGiven = formData.get("consentGiven") === "true";

    if (!file) throw new ApiError(400, "No file provided");
    if (!artifactType) throw new ApiError(400, "artifactType is required");

    const validTypes = ["ID_FRONT", "ID_BACK", "PASSPORT", "DRIVERS_LICENSE", "UTILITY_BILL", "SELFIE", "OTHER_DOCUMENT"];
    if (!validTypes.includes(artifactType)) {
      throw new ApiError(400, `Invalid artifactType: ${artifactType}`);
    }

    // Selfie requires consent
    if (artifactType === "SELFIE" && !consentGiven) {
      throw new ApiError(400, "Biometric data (selfie) requires explicit consent");
    }

    // Size limit: 10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new ApiError(400, "File exceeds maximum size of 10MB");
    }

    // Upload to storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorage();
    const { storageKey, hash, size } = await storage.upload(buffer, file.name, file.type);

    // Calculate retention date
    const settings = await prisma.idvSettings.findUnique({ where: { tenantId: user.tenantId } });
    const retentionDays = settings?.retentionDays ?? 90;
    const retainUntil = new Date();
    retainUntil.setDate(retainUntil.getDate() + retentionDays);

    const artifact = await prisma.idvArtifact.create({
      data: {
        tenantId: user.tenantId,
        requestId: idvRequest.id,
        artifactType: artifactType as any,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: size,
        sha256Hash: hash,
        storageKey,
        uploadedBy: user.id,
        consentGiven,
        retainUntil,
      },
    });

    // Update request status if it was NOT_STARTED or LINK_SENT
    if (["NOT_STARTED", "LINK_SENT"].includes(idvRequest.status)) {
      await prisma.idvRequest.update({
        where: { id: idvRequest.id },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      });
    }

    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "idv.artifact_uploaded",
      entityType: "IdvArtifact",
      entityId: artifact.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: params.id,
        artifactType,
        filename: file.name,
        sizeBytes: size,
        sha256Hash: hash,
      },
    });

    return NextResponse.json({
      id: artifact.id,
      artifactType: artifact.artifactType,
      filename: artifact.filename,
      mimeType: artifact.mimeType,
      sizeBytes: artifact.sizeBytes,
      sha256Hash: artifact.sha256Hash,
      createdAt: artifact.createdAt,
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/cases/[id]/idv/artifacts?artifactId=xxx — Download a specific artifact
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "IDV_VIEW_ARTIFACTS");
    const clientInfo = getClientInfo(request);

    const { searchParams } = new URL(request.url);
    const artifactId = searchParams.get("artifactId");
    if (!artifactId) throw new ApiError(400, "artifactId query parameter required");

    const artifact = await prisma.idvArtifact.findFirst({
      where: {
        id: artifactId,
        deletedAt: null,
        request: {
          case: { tenantId: user.tenantId, id: params.id },
        },
      },
    });
    if (!artifact) throw new ApiError(404, "Artifact not found");

    const storage = getStorage();
    const buffer = await storage.download(artifact.storageKey);

    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "idv.artifact_downloaded",
      entityType: "IdvArtifact",
      entityId: artifact.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { caseId: params.id, filename: artifact.filename },
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": artifact.mimeType,
        "Content-Disposition": `attachment; filename="${artifact.filename}"`,
        "Content-Length": String(artifact.sizeBytes),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
