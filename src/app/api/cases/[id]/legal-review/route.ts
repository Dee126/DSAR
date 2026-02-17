import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { z } from "zod";

interface RouteParams {
  params: { id: string };
}

const createLegalReviewSchema = z.object({
  issues: z.string().optional(),
  exemptionsApplied: z.array(z.string()).optional(),
  redactions: z.string().optional(),
  notes: z.string().optional(),
  reviewerUserId: z.string().uuid().optional(),
});

const updateLegalReviewSchema = z.object({
  status: z.enum(["PENDING", "IN_REVIEW", "APPROVED", "REJECTED", "CHANGES_REQUESTED"]).optional(),
  issues: z.string().optional(),
  exemptionsApplied: z.array(z.string()).optional(),
  redactions: z.string().optional(),
  notes: z.string().optional(),
  reviewerUserId: z.string().uuid().optional().nullable(),
});

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "read");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    const reviews = await prisma.legalReview.findMany({
      where: { caseId: params.id, tenantId: user.tenantId },
      include: {
        reviewer: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: reviews });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "update");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    const body = await request.json();
    const data = createLegalReviewSchema.parse(body);

    const review = await prisma.legalReview.create({
      data: {
        tenantId: user.tenantId,
        caseId: params.id,
        issues: data.issues,
        exemptionsApplied: data.exemptionsApplied ?? undefined,
        redactions: data.redactions,
        notes: data.notes,
        reviewerUserId: data.reviewerUserId ?? user.id,
      },
      include: {
        reviewer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "legal_review.created",
      entityType: "LegalReview",
      entityId: review.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { caseId: params.id },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "update");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    const body = await request.json();
    const { reviewId, ...updateData } = body;
    const data = updateLegalReviewSchema.parse(updateData);

    if (!reviewId) {
      throw new ApiError(400, "reviewId is required");
    }

    const existingReview = await prisma.legalReview.findFirst({
      where: { id: reviewId, caseId: params.id, tenantId: user.tenantId },
    });

    if (!existingReview) {
      throw new ApiError(404, "Legal review not found");
    }

    const review = await prisma.legalReview.update({
      where: { id: reviewId },
      data: {
        ...data,
        exemptionsApplied: data.exemptionsApplied ?? undefined,
        approvedAt: data.status === "APPROVED" ? new Date() : undefined,
      },
      include: {
        reviewer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "legal_review.updated",
      entityType: "LegalReview",
      entityId: review.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { caseId: params.id, status: data.status },
    });

    return NextResponse.json(review);
  } catch (error) {
    return handleApiError(error);
  }
}
