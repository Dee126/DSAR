export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError, ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { initIdvRequestSchema, idvDecisionSchema } from "@/lib/validation";
import { generatePortalToken, tokenExpiryFromDays } from "@/lib/idv-token";
import { getIdvReviewProvider } from "@/lib/idv-ai-review";

/**
 * GET /api/cases/[id]/idv — Get IDV request, artifacts, checks, decisions, assessments
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "IDV_VIEW");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      select: { id: true, dataSubjectId: true, identityVerified: true, status: true },
    });
    if (!dsarCase) throw new ApiError(404, "Case not found");

    const idvRequest = await prisma.idvRequest.findUnique({
      where: { caseId: params.id },
      include: {
        artifacts: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            artifactType: true,
            filename: true,
            mimeType: true,
            sizeBytes: true,
            sha256Hash: true,
            consentGiven: true,
            retainUntil: true,
            createdAt: true,
            uploadedBy: true,
            // storageKey excluded by default — only for download route
          },
        },
        checks: { orderBy: { performedAt: "desc" } },
        decisions: {
          orderBy: { decidedAt: "desc" },
          include: { reviewer: { select: { id: true, name: true, email: true } } },
        },
        assessments: { orderBy: { createdAt: "desc" } },
      },
    });

    // Load tenant IDV settings for context
    const settings = await prisma.idvSettings.findUnique({
      where: { tenantId: user.tenantId },
    });

    return NextResponse.json({
      case: { id: dsarCase.id, identityVerified: dsarCase.identityVerified, status: dsarCase.status },
      idvRequest,
      settings: settings ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/cases/[id]/idv — Initialize IDV request or send portal link
 * Body: { action: "init" | "send_link" | "run_ai_review" | "upload", ...params }
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
      include: { dataSubject: true },
    });
    if (!dsarCase) throw new ApiError(404, "Case not found");

    const body = await request.json();
    const action = body.action as string;

    if (action === "init") {
      // Initialize IDV request
      const parsed = initIdvRequestSchema.parse(body);

      const settings = await prisma.idvSettings.findUnique({
        where: { tenantId: user.tenantId },
      });
      const defaultMethods = settings?.allowedMethods ?? ["DOC_UPLOAD"];

      const existing = await prisma.idvRequest.findUnique({ where: { caseId: params.id } });
      if (existing) throw new ApiError(409, "IDV request already exists for this case");

      const idvRequest = await prisma.idvRequest.create({
        data: {
          tenantId: user.tenantId,
          caseId: params.id,
          dataSubjectId: dsarCase.dataSubjectId,
          status: "NOT_STARTED",
          allowedMethods: (parsed.allowedMethods ?? defaultMethods) as any,
          maxSubmissions: settings?.maxSubmissionsPerToken ?? 3,
        },
      });

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "idv.request_created",
        entityType: "IdvRequest",
        entityId: idvRequest.id,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { caseId: params.id, allowedMethods: idvRequest.allowedMethods },
      });

      return NextResponse.json(idvRequest, { status: 201 });
    }

    if (action === "send_link") {
      // Generate portal token and update request
      const idvRequest = await prisma.idvRequest.findUnique({ where: { caseId: params.id } });
      if (!idvRequest) throw new ApiError(404, "IDV request not found — initialize first");

      const settings = await prisma.idvSettings.findUnique({ where: { tenantId: user.tenantId } });
      const expiryDays = settings?.portalTokenExpiryDays ?? 7;
      const expiresAt = tokenExpiryFromDays(expiryDays);
      const portalToken = generatePortalToken(idvRequest.id, user.tenantId, expiresAt);

      const updated = await prisma.idvRequest.update({
        where: { id: idvRequest.id },
        data: {
          portalToken,
          portalTokenExp: expiresAt,
          status: "LINK_SENT",
          expiresAt,
        },
      });

      const portalUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/verify/${portalToken}`;

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "idv.portal_link_sent",
        entityType: "IdvRequest",
        entityId: idvRequest.id,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { caseId: params.id, expiresAt: expiresAt.toISOString() },
      });

      return NextResponse.json({ idvRequest: updated, portalUrl });
    }

    if (action === "run_ai_review") {
      // Run AI review on uploaded artifacts
      const idvRequest = await prisma.idvRequest.findUnique({
        where: { caseId: params.id },
        include: {
          artifacts: { where: { deletedAt: null } },
        },
      });
      if (!idvRequest) throw new ApiError(404, "IDV request not found");
      if (idvRequest.artifacts.length === 0) throw new ApiError(400, "No artifacts uploaded for review");

      const provider = getIdvReviewProvider();
      const result = await provider.analyze({
        artifacts: idvRequest.artifacts.map((a) => ({
          artifactType: a.artifactType,
          filename: a.filename,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
        })),
        subjectInfo: {
          fullName: dsarCase.dataSubject.fullName,
          email: dsarCase.dataSubject.email,
          address: dsarCase.dataSubject.address,
          phone: dsarCase.dataSubject.phone,
        },
      });

      // Check tenant storeDob setting
      const settings = await prisma.idvSettings.findUnique({ where: { tenantId: user.tenantId } });
      const extractedFields = result.extractedFields;
      if (settings && !settings.storeDob && extractedFields.dob) {
        extractedFields.dob = "[redacted]";
      }

      const assessment = await prisma.idvRiskAssessment.create({
        data: {
          tenantId: user.tenantId,
          requestId: idvRequest.id,
          riskScore: result.riskScore,
          flags: result.flags as any,
          extractedFields: extractedFields as any,
          mismatches: result.mismatches as any,
          rawOutput: result.rawOutput as any ?? null,
          provider: result.provider,
        },
      });

      // Update request to IN_REVIEW if still in SUBMITTED state
      if (idvRequest.status === "SUBMITTED") {
        await prisma.idvRequest.update({
          where: { id: idvRequest.id },
          data: { status: "IN_REVIEW" },
        });
      }

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "idv.ai_review_completed",
        entityType: "IdvRiskAssessment",
        entityId: assessment.id,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { caseId: params.id, riskScore: result.riskScore, provider: result.provider, flagCount: result.flags.length },
      });

      return NextResponse.json(assessment, { status: 201 });
    }

    if (action === "upload") {
      // Internal upload (staff uploading on behalf of subject)
      enforce(user.role, "DOCUMENT_UPLOAD");
      const idvRequest = await prisma.idvRequest.findUnique({ where: { caseId: params.id } });
      if (!idvRequest) throw new ApiError(404, "IDV request not found — initialize first");

      const formData = await request.formData?.() ?? null;
      // Since we already parsed JSON above, this is for direct file upload route
      // For file uploads, use the dedicated artifact upload endpoint
      throw new ApiError(400, "Use multipart form upload via /api/cases/[id]/idv/artifacts for file uploads");
    }

    throw new ApiError(400, `Unknown action: ${action}`);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/cases/[id]/idv — Make a decision (approve/reject/need_more_info)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "IDV_DECIDE");
    const clientInfo = getClientInfo(request);

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });
    if (!dsarCase) throw new ApiError(404, "Case not found");

    const body = await request.json();
    const parsed = idvDecisionSchema.parse(body);

    const idvRequest = await prisma.idvRequest.findUnique({ where: { caseId: params.id } });
    if (!idvRequest) throw new ApiError(404, "IDV request not found");

    // Create decision record
    const decision = await prisma.idvDecision.create({
      data: {
        tenantId: user.tenantId,
        requestId: idvRequest.id,
        outcome: parsed.outcome,
        rationale: parsed.rationale,
        reviewerUserId: user.id,
      },
    });

    // Update request status based on decision
    const statusMap = {
      APPROVED: "APPROVED" as const,
      REJECTED: "REJECTED" as const,
      NEED_MORE_INFO: "NEED_MORE_INFO" as const,
    };

    await prisma.idvRequest.update({
      where: { id: idvRequest.id },
      data: { status: statusMap[parsed.outcome] },
    });

    // If approved: update case.identityVerified and complete IDV milestone
    if (parsed.outcome === "APPROVED") {
      await prisma.dSARCase.update({
        where: { id: params.id },
        data: { identityVerified: true },
      });

      // Complete IDV milestone if it exists
      await prisma.caseMilestone.updateMany({
        where: {
          tenantId: user.tenantId,
          caseId: params.id,
          milestoneType: "IDV_COMPLETE",
          completedAt: null,
        },
        data: { completedAt: new Date() },
      });

      // Check if auto-transition is enabled
      const settings = await prisma.idvSettings.findUnique({ where: { tenantId: user.tenantId } });
      if (settings?.autoTransitionOnApproval && dsarCase.status === "IDENTITY_VERIFICATION") {
        await prisma.dSARCase.update({
          where: { id: params.id },
          data: { status: "INTAKE_TRIAGE" },
        });
        await prisma.dSARStateTransition.create({
          data: {
            tenantId: user.tenantId,
            caseId: params.id,
            fromStatus: "IDENTITY_VERIFICATION",
            toStatus: "INTAKE_TRIAGE",
            changedByUserId: user.id,
            reason: "Auto-transition: identity verification approved",
          },
        });
      }
    }

    // If need_more_info: create a task for the case manager
    if (parsed.outcome === "NEED_MORE_INFO") {
      await prisma.task.create({
        data: {
          tenantId: user.tenantId,
          caseId: params.id,
          title: "IDV: Additional information required",
          description: `Reviewer requested more info: ${parsed.rationale}`,
          status: "OPEN",
          assigneeUserId: dsarCase.assignedToUserId,
        },
      });
    }

    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: `idv.decision_${parsed.outcome.toLowerCase()}`,
      entityType: "IdvDecision",
      entityId: decision.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: params.id,
        outcome: parsed.outcome,
        rationale: parsed.rationale,
      },
    });

    return NextResponse.json(decision);
  } catch (error) {
    return handleApiError(error);
  }
}
