export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { updateUserSchema } from "@/lib/validation";

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "users", "update");

    const targetUser = await prisma.user.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    });

    if (!targetUser) {
      throw new ApiError(404, "User not found");
    }

    const body = await request.json();
    const data = updateUserSchema.parse(body);

    // Prevent users from changing their own role
    if (data.role && params.id === user.id) {
      throw new ApiError(400, "You cannot change your own role");
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.role !== undefined && { role: data.role }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "user.updated",
      entityType: "User",
      entityId: params.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        targetEmail: targetUser.email,
        changes: data,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    return handleApiError(error);
  }
}
