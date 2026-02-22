export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";
import { createConnectorSchema } from "@/lib/validation";
import { Prisma } from "@prisma/client";

/**
 * GET /api/connectors — list all connectors for the tenant
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "read");

    const { searchParams } = request.nextUrl;
    const category = searchParams.get("category");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
    const skip = (page - 1) * limit;

    const where = {
      tenantId: user.tenantId,
      ...(category ? { category: category as never } : {}),
    };

    const [connectors, total] = await Promise.all([
      prisma.connector.findMany({
        where,
        include: {
          _count: { select: { runs: true, credentials: true } },
          runs: {
            orderBy: { createdAt: "desc" as const },
            take: 1,
            select: {
              id: true,
              status: true,
              startedAt: true,
              finishedAt: true,
              assetsFound: true,
              findingsCount: true,
              errorMessage: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.connector.count({ where }),
    ]);

    return NextResponse.json({
      data: connectors,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/connectors — create a new connector
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "create");

    const body = await request.json();
    const data = createConnectorSchema.parse(body);

    const connector = await prisma.connector.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        description: data.description,
        category: data.category,
        config: (data.config as Prisma.InputJsonValue) ?? undefined,
      },
      include: {
        _count: { select: { runs: true, credentials: true } },
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "connector.created",
      entityType: "Connector",
      entityId: connector.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { name: data.name, category: data.category },
    });

    return NextResponse.json(connector, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
