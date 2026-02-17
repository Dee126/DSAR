export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";
import { createSystemSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "systems", "read");

    const systems = await prisma.system.findMany({
      where: {
        tenantId: user.tenantId,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(systems);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "systems", "create");

    const body = await request.json();
    const data = createSystemSchema.parse(body);

    const system = await prisma.system.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        description: data.description ?? null,
        owner: data.owner ?? null,
        contactEmail: data.contactEmail || null,
        tags: data.tags ?? [],
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "system.created",
      entityType: "System",
      entityId: system.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        name: system.name,
      },
    });

    return NextResponse.json(system, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
