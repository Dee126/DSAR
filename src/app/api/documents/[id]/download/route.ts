import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { getStorage } from "@/lib/storage";
import { logAllowedAccess } from "@/lib/access-log-middleware";

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "documents", "read");

    const document = await prisma.document.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: {
        case: {
          select: { caseNumber: true },
        },
      },
    });

    if (!document) {
      throw new ApiError(404, "Document not found");
    }

    const storage = getStorage();
    const fileBuffer = await storage.download(document.storageKey);

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "document.downloaded",
      entityType: "Document",
      entityId: params.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: document.caseId,
        caseNumber: document.case.caseNumber,
        filename: document.filename,
      },
    });

    // Module 8.4: Access logging for sensitive artifact download
    await logAllowedAccess({
      tenantId: user.tenantId,
      userId: user.id,
      accessType: "DOWNLOAD",
      resourceType: "DOCUMENT",
      resourceId: document.id,
      caseId: document.caseId,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    });

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": document.contentType,
        "Content-Disposition": `attachment; filename="${document.filename}"`,
        "Content-Length": String(fileBuffer.length),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
