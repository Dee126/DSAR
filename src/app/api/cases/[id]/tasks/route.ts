import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { createTaskSchema } from "@/lib/validation";

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "tasks", "read");

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

    const tasks = await prisma.task.findMany({
      where: {
        caseId: params.id,
        tenantId: user.tenantId,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        system: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "tasks", "create");

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
    const data = createTaskSchema.parse(body);

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

    // Validate system belongs to same tenant
    if (data.systemId) {
      const system = await prisma.system.findFirst({
        where: {
          id: data.systemId,
          tenantId: user.tenantId,
        },
      });
      if (!system) {
        throw new ApiError(400, "System not found in your organization");
      }
    }

    const task = await prisma.task.create({
      data: {
        tenantId: user.tenantId,
        caseId: params.id,
        title: data.title,
        description: data.description ?? null,
        assigneeUserId: data.assigneeUserId ?? null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        systemId: data.systemId ?? null,
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
      action: "task.created",
      entityType: "Task",
      entityId: task.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: params.id,
        caseNumber: dsarCase.caseNumber,
        title: task.title,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
