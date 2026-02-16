import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "API_KEYS_MANAGE");

    const { id } = await params;

    const apiKey = await prisma.apiKey.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!apiKey) throw new ApiError(404, "API key not found");
    if (apiKey.revokedAt) throw new ApiError(400, "API key already revoked");

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "API_KEY_REVOKED",
      entityType: "ApiKey",
      entityId: id,
      ip,
      userAgent,
      details: { name: apiKey.name },
    });

    return NextResponse.json({ message: "API key revoked" });
  } catch (error) {
    return handleApiError(error);
  }
}
