import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";
import { z } from "zod";

export async function GET() {
  try {
    const user = await requireAuth();

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        id: true,
        name: true,
        slaDefaultDays: true,
        dueSoonDays: true,
        retentionDays: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}

const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slaDefaultDays: z.number().int().min(1).max(365).optional(),
  dueSoonDays: z.number().int().min(1).max(90).optional(),
  retentionDays: z.number().int().min(30).max(3650).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "settings", "manage");

    const body = await request.json();
    const data = updateTenantSchema.parse(body);

    const tenant = await prisma.tenant.update({
      where: { id: user.tenantId },
      data,
      select: {
        id: true,
        name: true,
        slaDefaultDays: true,
        dueSoonDays: true,
        retentionDays: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "tenant.updated",
      entityType: "Tenant",
      entityId: tenant.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: data,
    });

    return NextResponse.json(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}
