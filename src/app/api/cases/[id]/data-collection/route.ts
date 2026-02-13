import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { z } from "zod";

interface RouteParams {
  params: { id: string };
}

const createDataCollectionSchema = z.object({
  systemId: z.string().uuid(),
  querySpec: z.string().optional(),
});

const updateDataCollectionSchema = z.object({
  itemId: z.string().uuid(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "NOT_APPLICABLE"]).optional(),
  findingsSummary: z.string().optional(),
  recordsFound: z.number().int().min(0).optional(),
});

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "read");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    const items = await prisma.dataCollectionItem.findMany({
      where: { caseId: params.id, tenantId: user.tenantId },
      include: {
        system: {
          select: { id: true, name: true, description: true, owner: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ data: items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "update");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    const body = await request.json();
    const data = createDataCollectionSchema.parse(body);

    // Verify system exists in tenant
    const system = await prisma.system.findFirst({
      where: { id: data.systemId, tenantId: user.tenantId },
    });

    if (!system) {
      throw new ApiError(404, "System not found");
    }

    const item = await prisma.dataCollectionItem.create({
      data: {
        tenantId: user.tenantId,
        caseId: params.id,
        systemId: data.systemId,
        querySpec: data.querySpec,
      },
      include: {
        system: {
          select: { id: true, name: true, description: true, owner: true },
        },
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "data_collection.created",
      entityType: "DataCollectionItem",
      entityId: item.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { caseId: params.id, systemId: data.systemId },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "update");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId, deletedAt: null },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    const body = await request.json();
    const data = updateDataCollectionSchema.parse(body);

    const existingItem = await prisma.dataCollectionItem.findFirst({
      where: { id: data.itemId, caseId: params.id, tenantId: user.tenantId },
    });

    if (!existingItem) {
      throw new ApiError(404, "Data collection item not found");
    }

    const item = await prisma.dataCollectionItem.update({
      where: { id: data.itemId },
      data: {
        status: data.status as any,
        findingsSummary: data.findingsSummary,
        recordsFound: data.recordsFound,
        completedAt: data.status === "COMPLETED" ? new Date() : undefined,
      },
      include: {
        system: {
          select: { id: true, name: true, description: true, owner: true },
        },
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "data_collection.updated",
      entityType: "DataCollectionItem",
      entityId: item.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { caseId: params.id, status: data.status },
    });

    return NextResponse.json(item);
  } catch (error) {
    return handleApiError(error);
  }
}
