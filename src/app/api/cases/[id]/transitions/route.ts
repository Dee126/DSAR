import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { transitionSchema } from "@/lib/validation";
import { isValidTransition, getAllowedTransitions } from "@/lib/state-machine";

interface RouteParams {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "update");

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
    const data = transitionSchema.parse(body);

    if (!isValidTransition(dsarCase.status, data.toStatus)) {
      const allowed = getAllowedTransitions(dsarCase.status);
      return NextResponse.json(
        {
          error: `Invalid status transition from ${dsarCase.status} to ${data.toStatus}`,
          allowedTransitions: allowed,
        },
        { status: 400 }
      );
    }

    const [transition, updatedCase] = await prisma.$transaction([
      prisma.dSARStateTransition.create({
        data: {
          tenantId: user.tenantId,
          caseId: params.id,
          fromStatus: dsarCase.status,
          toStatus: data.toStatus,
          changedByUserId: user.id,
          reason: data.reason,
        },
        include: {
          changedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.dSARCase.update({
        where: { id: params.id },
        data: { status: data.toStatus },
        include: {
          dataSubject: true,
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "case.transitioned",
      entityType: "DSARCase",
      entityId: params.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseNumber: dsarCase.caseNumber,
        fromStatus: dsarCase.status,
        toStatus: data.toStatus,
        reason: data.reason,
      },
    });

    return NextResponse.json({
      transition,
      case: updatedCase,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
