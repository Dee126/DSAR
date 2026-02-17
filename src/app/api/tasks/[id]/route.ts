export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { updateTaskSchema } from "@/lib/validation";

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "tasks", "update");

    const existingTask = await prisma.task.findFirst({
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

    if (!existingTask) {
      throw new ApiError(404, "Task not found");
    }

    const body = await request.json();
    const data = updateTaskSchema.parse(body);

    // Validate assignee belongs to same tenant
    if (data.assigneeUserId) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: data.assigneeUserId,
          tenantId: user.tenantId,
        },
      });
      if (!assignee) {
        throw new ApiError(400, "Assignee not found in your organization");
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.assigneeUserId !== undefined && {
          assigneeUserId: data.assigneeUserId,
        }),
        ...(data.dueDate !== undefined && {
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
        }),
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        system: {
          select: { id: true, name: true },
        },
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "task.updated",
      entityType: "Task",
      entityId: params.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: existingTask.caseId,
        caseNumber: existingTask.case.caseNumber,
        changes: data,
      },
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    return handleApiError(error);
  }
}
