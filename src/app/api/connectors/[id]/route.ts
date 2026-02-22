export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { updateConnectorSchema } from "@/lib/validation";
import { Prisma } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/connectors/:id — get a single connector with recent runs
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "read");
    const { id } = await params;

    const connector = await prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        _count: { select: { runs: true, credentials: true } },
        runs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!connector) {
      throw new ApiError(404, "Connector not found");
    }

    return NextResponse.json(connector);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/connectors/:id — update a connector
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "update");
    const { id } = await params;

    const existing = await prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      throw new ApiError(404, "Connector not found");
    }

    const body = await request.json();
    const data = updateConnectorSchema.parse(body);

    const updated = await prisma.connector.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.config !== undefined && { config: data.config as Prisma.InputJsonValue }),
      },
      include: {
        _count: { select: { runs: true, credentials: true } },
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "connector.updated",
      entityType: "Connector",
      entityId: id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/connectors/:id — delete a connector
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "delete");
    const { id } = await params;

    const existing = await prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      throw new ApiError(404, "Connector not found");
    }

    await prisma.connector.delete({ where: { id } });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "connector.deleted",
      entityType: "Connector",
      entityId: id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { name: existing.name, category: existing.category },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
