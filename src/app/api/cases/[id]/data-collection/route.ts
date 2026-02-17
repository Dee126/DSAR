import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { validateQuerySpec, querySpecSchema } from "@/lib/query-spec";
import { checkRateLimit, RUN_COLLECTION_LIMIT } from "@/lib/rate-limit";
import { getConnector } from "@/lib/connectors/registry";
import { createPendingResult, completeResult } from "@/lib/result-metadata";
import { z } from "zod";

interface RouteParams {
  params: { id: string };
}

const createDataCollectionSchema = z.object({
  systemId: z.string().uuid().optional(),
  integrationId: z.string().uuid().optional(),
  systemLabel: z.string().optional(),
  querySpec: querySpecSchema,
  assignedToUserId: z.string().uuid().optional(),
});

const updateDataCollectionSchema = z.object({
  itemId: z.string().uuid(),
  status: z
    .enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "NOT_APPLICABLE"])
    .optional(),
  findingsSummary: z.string().optional(),
  recordsFound: z.number().int().min(0).optional(),
  resultMetadata: z.any().optional(),
  assignedToUserId: z.string().uuid().optional().nullable(),
});

/* ── GET — List collection items for a case ───────────────────────────── */

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
          select: {
            id: true,
            name: true,
            provider: true,
            status: true,
            healthStatus: true,
          },
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

/* ── POST — Create a data collection item ─────────────────────────────── */

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
    let provider: string | undefined;
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
      provider = integration.provider;

      // Validate QuerySpec with provider-specific scope
      validateQuerySpec(data.querySpec, provider);
    }

    const item = await prisma.dataCollectionItem.create({
      data: {
        tenantId: user.tenantId,
        caseId: params.id,
        systemId: data.systemId ?? null,
        integrationId: data.integrationId ?? null,
        systemLabel: integrationLabel ?? null,
        querySpec: data.querySpec as Prisma.InputJsonValue,
        assignedToUserId: data.assignedToUserId ?? null,
      },
      include: {
        system: {
          select: { id: true, name: true, description: true, owner: true },
        },
        integration: {
          select: {
            id: true,
            name: true,
            provider: true,
            status: true,
            healthStatus: true,
          },
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
      action: "DATA_COLLECTION_CREATED",
      entityType: "DataCollectionItem",
      entityId: item.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: params.id,
        systemId: data.systemId,
        integrationId: data.integrationId,
        templateId: data.querySpec.templateId,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/* ── PATCH — Update a data collection item status ─────────────────────── */

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
        ...(data.status !== undefined && {
          status: data.status as Prisma.EnumDataCollectionStatusFieldUpdateOperationsInput["set"],
        }),
        ...(data.findingsSummary !== undefined && {
          findingsSummary: data.findingsSummary,
        }),
        ...(data.recordsFound !== undefined && {
          recordsFound: data.recordsFound,
        }),
        ...(data.resultMetadata !== undefined && {
          resultMetadata: data.resultMetadata as Prisma.InputJsonValue,
        }),
        ...(data.assignedToUserId !== undefined && {
          assignedToUserId: data.assignedToUserId,
        }),
        ...(data.status === "IN_PROGRESS" &&
          !existingItem.startedAt && { startedAt: new Date() }),
        ...(data.status === "COMPLETED" && { completedAt: new Date() }),
        ...(data.status === "FAILED" && { completedAt: new Date() }),
      },
      include: {
        system: {
          select: { id: true, name: true, description: true, owner: true },
        },
        integration: {
          select: {
            id: true,
            name: true,
            provider: true,
            status: true,
            healthStatus: true,
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const auditAction =
      data.status === "IN_PROGRESS"
        ? "DATA_COLLECTION_STARTED"
        : data.status === "COMPLETED"
        ? "DATA_COLLECTION_COMPLETED"
        : data.status === "FAILED"
        ? "DATA_COLLECTION_FAILED"
        : "DATA_COLLECTION_UPDATED";

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: auditAction,
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

/* ── POST /run — Execute collection via integration connector ─────────── */
/* This is handled as a separate action parameter in the PATCH body       */

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "update");

    const body = await request.json();
    const { itemId } = z.object({ itemId: z.string().uuid() }).parse(body);

    // Rate limit
    const rl = checkRateLimit(`collect:${params.id}`, RUN_COLLECTION_LIMIT);
    if (!rl.allowed) {
      throw new ApiError(
        429,
        `Rate limit exceeded. Try again in ${Math.ceil((rl.retryAfterMs ?? 60000) / 1000)}s.`
      );
    }

    const existingItem = await prisma.dataCollectionItem.findFirst({
      where: { id: itemId, caseId: params.id, tenantId: user.tenantId },
      include: { integration: true },
    });

    if (!existingItem) {
      throw new ApiError(404, "Data collection item not found");
    }

    if (!existingItem.integration) {
      throw new ApiError(
        400,
        "This item is not linked to an integration. Manual collection only."
      );
    }

    if (existingItem.integration.status !== "ENABLED") {
      throw new ApiError(400, "Integration is disabled. Enable it before running collection.");
    }

    const connector = getConnector(existingItem.integration.provider);
    if (!connector) {
      throw new ApiError(400, "No connector for this integration provider.");
    }

    // Validate QuerySpec
    const querySpec = existingItem.querySpec as Record<string, unknown>;
    if (!querySpec || !querySpec.subjectIdentifiers) {
      throw new ApiError(400, "This item has no valid QuerySpec. Edit it before running.");
    }

    const validatedSpec = validateQuerySpec(
      querySpec,
      existingItem.integration.provider
    );

    // Mark as IN_PROGRESS
    await prisma.dataCollectionItem.update({
      where: { id: itemId },
      data: {
        status: "IN_PROGRESS",
        startedAt: existingItem.startedAt ?? new Date(),
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "DATA_COLLECTION_STARTED",
      entityType: "DataCollectionItem",
      entityId: itemId,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: params.id,
        provider: existingItem.integration.provider,
        templateId: validatedSpec.templateId,
      },
    });

    // Execute collection
    const config =
      (existingItem.integration.config as Record<string, unknown>) ?? {};
    let collectionResult;

    try {
      collectionResult = await connector.collectData(
        config,
        existingItem.integration.secretRef,
        validatedSpec
      );
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown collection error";
      const failResult = createPendingResult(
        existingItem.integration.provider,
        "collection"
      );
      await prisma.dataCollectionItem.update({
        where: { id: itemId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          resultMetadata: completeResult(failResult, {
            status: "failed",
            errorMessage: errorMsg,
          }) as unknown as Prisma.InputJsonValue,
        },
      });

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "DATA_COLLECTION_FAILED",
        entityType: "DataCollectionItem",
        entityId: itemId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { caseId: params.id, error: errorMsg },
      });

      throw new ApiError(500, `Collection failed: ${errorMsg}`);
    }

    // Update item with results
    const finalItem = await prisma.dataCollectionItem.update({
      where: { id: itemId },
      data: {
        status: collectionResult.success ? "COMPLETED" : "FAILED",
        completedAt: new Date(),
        recordsFound: collectionResult.recordsFound,
        findingsSummary: collectionResult.findingsSummary,
        resultMetadata:
          collectionResult.resultMetadata as unknown as Prisma.InputJsonValue,
      },
      include: {
        integration: {
          select: { id: true, name: true, provider: true, status: true, healthStatus: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: collectionResult.success
        ? "DATA_COLLECTION_COMPLETED"
        : "DATA_COLLECTION_FAILED",
      entityType: "DataCollectionItem",
      entityId: itemId,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: params.id,
        recordsFound: collectionResult.recordsFound,
        success: collectionResult.success,
      },
    });

    return NextResponse.json(finalItem);
  } catch (error) {
    return handleApiError(error);
  }
}
