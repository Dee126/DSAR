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
  systemId: z.string().uuid().optional(),
  integrationId: z.string().uuid().optional(),
  systemLabel: z.string().optional(),
  querySpec: z.any().optional(),
  assignedToUserId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
});

const updateDataCollectionSchema = z.object({
  itemId: z.string().uuid(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "NOT_APPLICABLE"]).optional(),
  findingsSummary: z.string().optional(),
  recordsFound: z.number().int().min(0).optional(),
  resultMetadata: z.any().optional(),
  assignedToUserId: z.string().uuid().optional().nullable(),
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
        integration: {
          select: { id: true, name: true, provider: true, status: true, healthStatus: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
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

    if (!data.systemId && !data.integrationId) {
      throw new ApiError(400, "Either systemId or integrationId is required");
    }

    // Verify system exists in tenant if provided
    if (data.systemId) {
      const system = await prisma.system.findFirst({
        where: { id: data.systemId, tenantId: user.tenantId },
      });
      if (!system) {
        throw new ApiError(404, "System not found");
      }
    }

    // Verify integration exists in tenant if provided
    let integrationLabel = data.systemLabel;
    if (data.integrationId) {
      const integration = await prisma.integration.findFirst({
        where: { id: data.integrationId, tenantId: user.tenantId },
      });
      if (!integration) {
        throw new ApiError(404, "Integration not found");
      }
      if (!integrationLabel) {
        integrationLabel = integration.name;
      }
    }

    const item = await prisma.dataCollectionItem.create({
      data: {
        tenantId: user.tenantId,
        caseId: params.id,
        systemId: data.systemId ?? null,
        integrationId: data.integrationId ?? null,
        systemLabel: integrationLabel ?? null,
        querySpec: data.querySpec ?? undefined,
        assignedToUserId: data.assignedToUserId ?? null,
      },
      include: {
        system: {
          select: { id: true, name: true, description: true, owner: true },
        },
        integration: {
          select: { id: true, name: true, provider: true, status: true, healthStatus: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
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
      details: {
        caseId: params.id,
        systemId: data.systemId,
        integrationId: data.integrationId,
      },
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
        ...(data.status !== undefined && { status: data.status as any }),
        ...(data.findingsSummary !== undefined && { findingsSummary: data.findingsSummary }),
        ...(data.recordsFound !== undefined && { recordsFound: data.recordsFound }),
        ...(data.resultMetadata !== undefined && { resultMetadata: data.resultMetadata }),
        ...(data.assignedToUserId !== undefined && { assignedToUserId: data.assignedToUserId }),
        ...(data.status === "IN_PROGRESS" && !existingItem.startedAt && { startedAt: new Date() }),
        ...(data.status === "COMPLETED" && { completedAt: new Date() }),
      },
      include: {
        system: {
          select: { id: true, name: true, description: true, owner: true },
        },
        integration: {
          select: { id: true, name: true, provider: true, status: true, healthStatus: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
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
