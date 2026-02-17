export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { validatePortalToken } from "@/lib/idv-token";
import { getStorage } from "@/lib/storage";
import { logAudit, getClientInfo } from "@/lib/audit";

/**
 * GET /api/idv/portal/[token] — Validate token and return portal data
 * This is an unauthenticated endpoint — token provides scoped access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const payload = validatePortalToken(params.token);
    if (!payload) throw new ApiError(401, "Invalid or expired verification link");

    const idvRequest = await prisma.idvRequest.findFirst({
      where: {
        id: payload.requestId,
        tenantId: payload.tenantId,
        portalToken: params.token,
      },
      include: {
        case: {
          select: {
            caseNumber: true,
            type: true,
            dataSubject: { select: { fullName: true } },
          },
        },
      },
    });

    if (!idvRequest) throw new ApiError(404, "Verification request not found");

    // Check if already completed
    if (["APPROVED", "REJECTED"].includes(idvRequest.status)) {
      return NextResponse.json({
        status: "completed",
        message: "This verification request has already been processed.",
      });
    }

    // Check submission limit
    if (idvRequest.submissionCount >= idvRequest.maxSubmissions) {
      return NextResponse.json({
        status: "limit_reached",
        message: "Maximum number of submissions reached. Please contact the organization.",
      });
    }

    // Load tenant settings for selfie consent etc.
    const settings = await prisma.idvSettings.findUnique({
      where: { tenantId: payload.tenantId },
    });

    // Return only minimal information — never expose internal details
    return NextResponse.json({
      status: idvRequest.status,
      caseReference: idvRequest.case.caseNumber,
      requestType: idvRequest.case.type,
      subjectName: idvRequest.case.dataSubject.fullName,
      allowedMethods: idvRequest.allowedMethods,
      selfieEnabled: settings?.selfieEnabled ?? false,
      remainingSubmissions: idvRequest.maxSubmissions - idvRequest.submissionCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/idv/portal/[token] — Subject uploads verification documents
 * Accepts multipart/form-data with:
 *   - files: multiple File objects
 *   - artifactTypes: JSON array of types matching each file
 *   - consentGiven: "true"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const clientInfo = getClientInfo(request);
    const payload = validatePortalToken(params.token);
    if (!payload) throw new ApiError(401, "Invalid or expired verification link");

    const idvRequest = await prisma.idvRequest.findFirst({
      where: {
        id: payload.requestId,
        tenantId: payload.tenantId,
        portalToken: params.token,
      },
    });

    if (!idvRequest) throw new ApiError(404, "Verification request not found");

    // Check status
    if (["APPROVED", "REJECTED"].includes(idvRequest.status)) {
      throw new ApiError(400, "This verification request has already been processed");
    }

    // Check submission limit
    if (idvRequest.submissionCount >= idvRequest.maxSubmissions) {
      throw new ApiError(429, "Maximum number of submissions reached");
    }

    const formData = await request.formData();
    const consentGiven = formData.get("consentGiven") === "true";
    if (!consentGiven) {
      throw new ApiError(400, "Consent is required to submit verification documents");
    }

    const artifactTypesRaw = formData.get("artifactTypes") as string;
    let artifactTypes: string[] = [];
    try {
      artifactTypes = JSON.parse(artifactTypesRaw);
    } catch {
      throw new ApiError(400, "artifactTypes must be a valid JSON array");
    }

    const files: File[] = [];
    formData.forEach((value, key) => {
      if (key.startsWith("file") && value instanceof File) {
        files.push(value);
      }
    });

    if (files.length === 0) throw new ApiError(400, "At least one file is required");
    if (files.length !== artifactTypes.length) {
      throw new ApiError(400, "Number of files must match number of artifact types");
    }

    const validTypes = ["ID_FRONT", "ID_BACK", "PASSPORT", "DRIVERS_LICENSE", "UTILITY_BILL", "SELFIE", "OTHER_DOCUMENT"];

    // Load settings for selfie check
    const settings = await prisma.idvSettings.findUnique({
      where: { tenantId: payload.tenantId },
    });

    const storage = getStorage();
    const retentionDays = settings?.retentionDays ?? 90;
    const retainUntil = new Date();
    retainUntil.setDate(retainUntil.getDate() + retentionDays);

    const createdArtifacts = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const artifactType = artifactTypes[i];

      if (!validTypes.includes(artifactType)) {
        throw new ApiError(400, `Invalid artifact type: ${artifactType}`);
      }

      // Selfie requires it to be enabled
      if (artifactType === "SELFIE" && !settings?.selfieEnabled) {
        throw new ApiError(400, "Selfie verification is not enabled for this organization");
      }

      // Size limit: 10MB
      if (file.size > 10 * 1024 * 1024) {
        throw new ApiError(400, `File ${file.name} exceeds maximum size of 10MB`);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const { storageKey, hash, size } = await storage.upload(buffer, file.name, file.type);

      const artifact = await prisma.idvArtifact.create({
        data: {
          tenantId: payload.tenantId,
          requestId: idvRequest.id,
          artifactType: artifactType as any,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: size,
          sha256Hash: hash,
          storageKey,
          uploadedBy: null, // null = uploaded by data subject
          consentGiven: true,
          retainUntil,
        },
      });

      createdArtifacts.push({
        id: artifact.id,
        artifactType: artifact.artifactType,
        filename: artifact.filename,
      });
    }

    // Create doc upload check
    await prisma.idvCheck.create({
      data: {
        tenantId: payload.tenantId,
        requestId: idvRequest.id,
        method: "DOC_UPLOAD",
        passed: true,
        details: { artifactCount: files.length, artifactTypes } as any,
      },
    });

    // Update request
    await prisma.idvRequest.update({
      where: { id: idvRequest.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        submissionCount: { increment: 1 },
      },
    });

    await logAudit({
      tenantId: payload.tenantId,
      actorUserId: null,
      action: "idv.portal_submission",
      entityType: "IdvRequest",
      entityId: idvRequest.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        artifactCount: files.length,
        artifactTypes,
        submissionNumber: idvRequest.submissionCount + 1,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Verification documents received. You will be notified of the outcome.",
      artifacts: createdArtifacts,
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
