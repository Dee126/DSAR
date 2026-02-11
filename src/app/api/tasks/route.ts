import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "tasks", "read");

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const assignee = searchParams.get("assignee");

    const where: Prisma.TaskWhereInput = {
      tenantId: user.tenantId,
    };

    if (status) {
      where.status = status as any;
    }

    if (assignee) {
      where.assigneeUserId = assignee;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        case: {
          select: { id: true, caseNumber: true },
        },
        system: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: tasks });
  } catch (error) {
    return handleApiError(error);
  }
}
