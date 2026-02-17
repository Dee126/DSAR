import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { generateResponse } from "@/lib/response-generator";
import { exportToPdf, exportToDocx, exportToHtml } from "@/lib/response-export";
import { getStorage } from "@/lib/storage";
import {
  generateResponseSchema,
  updateResponseDocSchema,
  responseApprovalSchema,
  createDeliveryRecordSchema,
  createRedactionEntrySchema,
} from "@/lib/validation";

/**
 * GET /api/cases/[id]/response — List response documents for a case
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "RESPONSE_VIEW");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!dsarCase) throw new ApiError(404, "Case not found");

    const documents = await prisma.responseDocument.findMany({
      where: { tenantId: user.tenantId, caseId: params.id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        editedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        template: { select: { id: true, name: true, language: true } },
        approvals: {
          include: { reviewer: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
        deliveries: {
          include: { createdBy: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
        redactions: {
          include: { createdBy: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { version: "desc" },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/cases/[id]/response — Generate, approve, deliver, export, or add redaction
 * Body: { action: "generate" | "submit_review" | "approve" | "deliver" | "export" | "redact", ...params }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    const clientInfo = getClientInfo(request);
    const body = await request.json();
    const action = body.action as string;

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      select: { id: true, caseNumber: true, status: true },
    });
    if (!dsarCase) throw new ApiError(404, "Case not found");

    // ── GENERATE ────────────────────────────────────────────────────
    if (action === "generate") {
      enforce(user.role, "RESPONSE_GENERATE");

      const data = generateResponseSchema.parse(body);
      const result = await generateResponse(
        user.tenantId,
        params.id,
        user.id,
        {
          templateId: data.templateId,
          language: data.language,
          aiAssisted: data.aiAssisted,
        },
      );

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "response.generated",
        entityType: "ResponseDocument",
        entityId: result.responseDocId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: {
          caseId: params.id,
          version: result.version,
          templateUsed: result.templateUsed,
          aiAssisted: result.aiAssisted,
          warnings: result.warnings,
        },
      });

      return NextResponse.json(result, { status: 201 });
    }

    // ── SUBMIT FOR REVIEW ──────────────────────────────────────────
    if (action === "submit_review") {
      enforce(user.role, "RESPONSE_SUBMIT_REVIEW");

      const docId = body.responseDocId as string;
      if (!docId) throw new ApiError(400, "responseDocId required");

      const doc = await prisma.responseDocument.findFirst({
        where: { id: docId, tenantId: user.tenantId, caseId: params.id },
      });
      if (!doc) throw new ApiError(404, "Response document not found");
      if (doc.status !== "DRAFT" && doc.status !== "CHANGES_REQUESTED") {
        throw new ApiError(400, `Cannot submit for review from status: ${doc.status}`);
      }

      const updated = await prisma.responseDocument.update({
        where: { id: docId },
        data: { status: "IN_REVIEW" },
      });

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "response.submitted_for_review",
        entityType: "ResponseDocument",
        entityId: docId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { caseId: params.id, version: doc.version },
      });

      return NextResponse.json({ success: true, status: updated.status });
    }

    // ── APPROVE / REQUEST CHANGES ──────────────────────────────────
    if (action === "approve" || action === "request_changes") {
      enforce(user.role, "RESPONSE_APPROVE");

      const data = responseApprovalSchema.parse(body);
      const docId = body.responseDocId as string;
      if (!docId) throw new ApiError(400, "responseDocId required");

      const doc = await prisma.responseDocument.findFirst({
        where: { id: docId, tenantId: user.tenantId, caseId: params.id },
      });
      if (!doc) throw new ApiError(404, "Response document not found");
      if (doc.status !== "IN_REVIEW") {
        throw new ApiError(400, `Cannot review from status: ${doc.status}`);
      }

      // Prevent self-approval
      if (doc.createdByUserId === user.id) {
        throw new ApiError(400, "Cannot approve your own response document");
      }

      const newStatus = data.action === "approve" ? "APPROVED" : "CHANGES_REQUESTED";

      await prisma.responseApproval.create({
        data: {
          tenantId: user.tenantId,
          responseDocId: docId,
          reviewerUserId: user.id,
          action: data.action,
          comments: data.comments,
        },
      });

      const updated = await prisma.responseDocument.update({
        where: { id: docId },
        data: {
          status: newStatus as any,
          ...(data.action === "approve" ? { approvedByUserId: user.id, approvedAt: new Date() } : {}),
        },
      });

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: `response.${data.action === "approve" ? "approved" : "changes_requested"}`,
        entityType: "ResponseDocument",
        entityId: docId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { caseId: params.id, comments: data.comments },
      });

      return NextResponse.json({ success: true, status: updated.status });
    }

    // ── DELIVER ────────────────────────────────────────────────────
    if (action === "deliver") {
      enforce(user.role, "RESPONSE_SEND");

      const data = createDeliveryRecordSchema.parse(body);
      const docId = body.responseDocId as string;
      if (!docId) throw new ApiError(400, "responseDocId required");

      const doc = await prisma.responseDocument.findFirst({
        where: { id: docId, tenantId: user.tenantId, caseId: params.id },
      });
      if (!doc) throw new ApiError(404, "Response document not found");
      if (doc.status !== "APPROVED") {
        throw new ApiError(400, "Response must be approved before delivery");
      }

      const delivery = await prisma.deliveryRecord.create({
        data: {
          tenantId: user.tenantId,
          responseDocId: docId,
          method: data.method as any,
          recipientRef: data.recipientRef,
          notes: data.notes,
          createdByUserId: user.id,
        },
      });

      await prisma.responseDocument.update({
        where: { id: docId },
        data: { status: "SENT", sentAt: new Date() },
      });

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "response.delivered",
        entityType: "ResponseDocument",
        entityId: docId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { caseId: params.id, method: data.method, recipientRef: data.recipientRef },
      });

      return NextResponse.json({ success: true, delivery }, { status: 201 });
    }

    // ── EXPORT ─────────────────────────────────────────────────────
    if (action === "export") {
      enforce(user.role, "RESPONSE_VIEW");

      const docId = body.responseDocId as string;
      const format = (body.format as string) || "html";
      if (!docId) throw new ApiError(400, "responseDocId required");

      const doc = await prisma.responseDocument.findFirst({
        where: { id: docId, tenantId: user.tenantId, caseId: params.id },
      });
      if (!doc) throw new ApiError(404, "Response document not found");

      const baseFilename = `response-${dsarCase.caseNumber}-v${doc.version}`;

      if (format === "pdf") {
        const result = await exportToPdf(doc.fullHtml, `${baseFilename}.pdf`);
        await prisma.responseDocument.update({
          where: { id: docId },
          data: { storageKeyPdf: result.storageKey },
        });

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "response.exported",
          entityType: "ResponseDocument",
          entityId: docId,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { format: "pdf", caseId: params.id },
        });

        return NextResponse.json({ storageKey: result.storageKey, format: "pdf", size: result.size });
      }

      if (format === "docx") {
        const result = await exportToDocx(doc.fullHtml, `${baseFilename}.docx`);
        await prisma.responseDocument.update({
          where: { id: docId },
          data: { storageKeyDocx: result.storageKey },
        });

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "response.exported",
          entityType: "ResponseDocument",
          entityId: docId,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { format: "docx", caseId: params.id },
        });

        return NextResponse.json({ storageKey: result.storageKey, format: "docx", size: result.size });
      }

      // Default: HTML
      const result = await exportToHtml(doc.fullHtml, `${baseFilename}.html`);

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "response.exported",
        entityType: "ResponseDocument",
        entityId: docId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { format: "html", caseId: params.id },
      });

      return NextResponse.json({ storageKey: result.storageKey, format: "html", size: result.size });
    }

    // ── REDACT ─────────────────────────────────────────────────────
    if (action === "redact") {
      enforce(user.role, "RESPONSE_EDIT");

      const data = createRedactionEntrySchema.parse(body);
      const docId = body.responseDocId as string;
      if (!docId) throw new ApiError(400, "responseDocId required");

      const doc = await prisma.responseDocument.findFirst({
        where: { id: docId, tenantId: user.tenantId, caseId: params.id },
      });
      if (!doc) throw new ApiError(404, "Response document not found");

      const entry = await prisma.redactionEntry.create({
        data: {
          tenantId: user.tenantId,
          responseDocId: docId,
          caseId: params.id,
          sectionKey: data.sectionKey,
          documentRef: data.documentRef,
          redactedContent: data.redactedContent,
          reason: data.reason,
          createdByUserId: user.id,
        },
      });

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "response.redaction_added",
        entityType: "RedactionEntry",
        entityId: entry.id,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { caseId: params.id, responseDocId: docId, reason: data.reason },
      });

      return NextResponse.json({ success: true, redaction: entry }, { status: 201 });
    }

    throw new ApiError(400, `Unknown action: ${action}`);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/cases/[id]/response — Update response document content (editing)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "RESPONSE_EDIT");
    const clientInfo = getClientInfo(request);

    const body = await request.json();
    const docId = body.responseDocId as string;
    if (!docId) throw new ApiError(400, "responseDocId required");

    const doc = await prisma.responseDocument.findFirst({
      where: { id: docId, tenantId: user.tenantId, caseId: params.id },
    });
    if (!doc) throw new ApiError(404, "Response document not found");

    if (doc.status === "APPROVED" || doc.status === "SENT") {
      throw new ApiError(400, "Cannot edit an approved or sent response document");
    }

    const data = updateResponseDocSchema.parse(body);

    const updateData: Record<string, unknown> = {
      editedByUserId: user.id,
      editedAt: new Date(),
    };
    if (data.sections) updateData.sections = data.sections;
    if (data.fullHtml) updateData.fullHtml = data.fullHtml;

    const updated = await prisma.responseDocument.update({
      where: { id: docId },
      data: updateData as any,
    });

    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "response.edited",
      entityType: "ResponseDocument",
      entityId: docId,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { caseId: params.id, version: doc.version },
    });

    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
