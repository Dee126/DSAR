import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { updateSystemSchema } from "@/lib/validation";

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "systems", "update");

    const existingSystem = await prisma.system.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    });

    if (!existingSystem) {
      throw new ApiError(404, "System not found");
    }

    const body = await request.json();
    const data = updateSystemSchema.parse(body);

    const updatedSystem = await prisma.system.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.owner !== undefined && { owner: data.owner }),
        ...(data.contactEmail !== undefined && {
          contactEmail: data.contactEmail || null,
        }),
        ...(data.tags !== undefined && { tags: data.tags }),
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "system.updated",
      entityType: "System",
      entityId: params.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        name: existingSystem.name,
        changes: data,
      },
    });

    return NextResponse.json(updatedSystem);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "systems", "delete");

    const existingSystem = await prisma.system.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    });

    if (!existingSystem) {
      throw new ApiError(404, "System not found");
    }

    // Check for linked tasks before deleting
    const linkedTaskCount = await prisma.task.count({
      where: {
        systemId: params.id,
        tenantId: user.tenantId,
      },
    });

    if (linkedTaskCount > 0) {
      throw new ApiError(
        409,
        `Cannot delete system: ${linkedTaskCount} task(s) are linked to this system. Reassign or remove those tasks first.`
      );
    }

    await prisma.system.delete({
      where: { id: params.id },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "system.deleted",
      entityType: "System",
      entityId: params.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        name: existingSystem.name,
      },
    });

    return NextResponse.json({ message: "System deleted successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
