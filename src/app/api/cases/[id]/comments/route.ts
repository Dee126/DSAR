export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { createCommentSchema } from "@/lib/validation";

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "comments", "read");

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

    const comments = await prisma.comment.findMany({
      where: {
        caseId: params.id,
        tenantId: user.tenantId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(comments);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "comments", "create");

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

    const body = await request.json();
    const data = createCommentSchema.parse(body);

    const comment = await prisma.comment.create({
      data: {
        tenantId: user.tenantId,
        caseId: params.id,
        authorUserId: user.id,
        body: data.body,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "comment.created",
      entityType: "Comment",
      entityId: comment.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: params.id,
        caseNumber: dsarCase.caseNumber,
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
