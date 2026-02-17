export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { getStorage } from "@/lib/storage";

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "documents", "read");

    // Verify the case belongs to the user's tenant
    const dsarCase = await prisma.dSARCase.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    const documents = await prisma.document.findMany({
      where: {
        caseId: params.id,
        tenantId: user.tenantId,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json(documents);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "documents", "create");

    // Verify the case belongs to the user's tenant
    const dsarCase = await prisma.dSARCase.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new ApiError(400, "No file provided");
    }

    const classification = (formData.get("classification") as string) || "INTERNAL";
    const validClassifications = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"];
    if (!validClassifications.includes(classification)) {
      throw new ApiError(400, `Invalid classification. Must be one of: ${validClassifications.join(", ")}`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorage();
    const { storageKey, hash, size } = await storage.upload(
      buffer,
      file.name,
      file.type
    );

    const document = await prisma.document.create({
      data: {
        tenantId: user.tenantId,
        caseId: params.id,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        storageKey,
        size,
        hash,
        classification: classification as any,
        uploadedByUserId: user.id,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "document.uploaded",
      entityType: "Document",
      entityId: document.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: params.id,
        caseNumber: dsarCase.caseNumber,
        filename: file.name,
        size,
        classification,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
