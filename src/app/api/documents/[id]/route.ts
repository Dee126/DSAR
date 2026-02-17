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

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "documents", "delete");

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

    // Delete file from storage
    const storage = getStorage();
    await storage.delete(document.storageKey);

    // Delete database record
    await prisma.document.delete({
      where: { id: document.id },
    });

    // Audit log
    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "document.deleted",
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

    return NextResponse.json({ message: "Document deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
