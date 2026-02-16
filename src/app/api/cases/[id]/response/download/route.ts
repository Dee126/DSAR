import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/errors";
import { getStorage } from "@/lib/storage";
import { logAudit, getClientInfo } from "@/lib/audit";

/**
 * GET /api/cases/[id]/response/download?docId=...&format=html|pdf|docx
 * Download a response document in the specified format.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "RESPONSE_VIEW");
    const clientInfo = getClientInfo(request);

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");
    const format = searchParams.get("format") || "html";

    if (!docId) throw new ApiError(400, "docId query parameter required");

    const doc = await prisma.responseDocument.findFirst({
      where: { id: docId, tenantId: user.tenantId, caseId: params.id },
      include: { case: { select: { caseNumber: true } } },
    });
    if (!doc) throw new ApiError(404, "Response document not found");

    const storage = getStorage();
    const baseFilename = `response-${doc.case.caseNumber}-v${doc.version}`;

    // Module 8.4: Access logging for response doc download
    const { logAllowedAccess } = await import("@/lib/access-log-middleware");
    await logAllowedAccess({
      tenantId: user.tenantId,
      userId: user.id,
      accessType: "DOWNLOAD",
      resourceType: "RESPONSE_DOC",
      resourceId: doc.id,
      caseId: params.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    });

    if (format === "html") {
      const buffer = Buffer.from(doc.fullHtml, "utf-8");
      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "response.downloaded",
        entityType: "ResponseDocument",
        entityId: docId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { format: "html" },
      });

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseFilename}.html"`,
          "Content-Length": String(buffer.length),
        },
      });
    }

    if (format === "pdf" && doc.storageKeyPdf) {
      const buffer = await storage.download(doc.storageKeyPdf);
      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "response.downloaded",
        entityType: "ResponseDocument",
        entityId: docId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { format: "pdf" },
      });

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${baseFilename}.pdf"`,
          "Content-Length": String(buffer.length),
        },
      });
    }

    if (format === "docx" && doc.storageKeyDocx) {
      const buffer = await storage.download(doc.storageKeyDocx);
      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "response.downloaded",
        entityType: "ResponseDocument",
        entityId: docId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { format: "docx" },
      });

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${baseFilename}.docx"`,
          "Content-Length": String(buffer.length),
        },
      });
    }

    throw new ApiError(400, `Export not available in format: ${format}. Generate the export first.`);
  } catch (error) {
    return handleApiError(error);
  }
}
