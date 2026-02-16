import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { encrypt } from "@/lib/security/encryption";
import { getConnector } from "@/lib/connectors/registry";
import { updateIntegrationSchema } from "@/lib/validation";
import { Prisma } from "@prisma/client";

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "read");

    const integration = await prisma.integration.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { dataCollectionItems: true, secrets: true },
        },
      },
    });

    if (!integration) {
      throw new ApiError(404, "Integration not found");
    }

    // Get connector info
    const connector = getConnector(integration.provider);
    const configFields = connector?.getConfigFields() ?? [];
    const queryTemplates = connector?.getQueryTemplates() ?? [];

    // Get audit events for this integration
    const auditEvents = await prisma.auditLog.findMany({
      where: {
        tenantId: user.tenantId,
        entityType: "Integration",
        entityId: integration.id,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        actor: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Fetch last run summary (if any integration_runs exist)
    const lastRun = await prisma.integrationRun.findFirst({
      where: { integrationId: integration.id, tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { items: true } },
      },
    });

    let lastRunSummary = null;
    if (lastRun) {
      // Get resource type counts for the last run
      const itemCounts = await prisma.integrationRunItem.groupBy({
        by: ["resourceType"],
        where: { runId: lastRun.id },
        _count: { id: true },
      });

      lastRunSummary = {
        id: lastRun.id,
        status: lastRun.status,
        startedAt: lastRun.startedAt,
        finishedAt: lastRun.finishedAt,
        error: lastRun.error,
        totalItems: lastRun._count.items,
        resourceCounts: Object.fromEntries(
          itemCounts.map((c) => [c.resourceType, c._count.id])
        ),
      };
    }

    const { secretRef, ...safeIntegration } = integration;

    return NextResponse.json({
      ...safeIntegration,
      hasSecret: !!secretRef || (safeIntegration._count.secrets ?? 0) > 0,
      configFields,
      queryTemplates,
      auditEvents,
      lastRunSummary,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "update");

    const existing = await prisma.integration.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });

    if (!existing) {
      throw new ApiError(404, "Integration not found");
    }

    const body = await request.json();
    const data = updateIntegrationSchema.parse(body);

    let secretRef = existing.secretRef;
    let secretsPayload: Record<string, string> | null = null;

    // Handle secret update
    if (data.secrets && Object.keys(data.secrets).length > 0) {
      secretsPayload = data.secrets;
    } else if (data.config) {
      // Extract secrets from config
      const connector = getConnector(existing.provider);
      const secretFields = connector?.getConfigFields().filter((f) => f.isSecret) ?? [];
      const cleanConfig: Record<string, unknown> = { ...data.config };
      const extractedSecrets: Record<string, string> = {};

      for (const field of secretFields) {
        if (cleanConfig[field.key] && typeof cleanConfig[field.key] === "string") {
          extractedSecrets[field.key] = cleanConfig[field.key] as string;
          delete cleanConfig[field.key];
        }
      }

      if (Object.keys(extractedSecrets).length > 0) {
        secretsPayload = extractedSecrets;
      }
      data.config = cleanConfig;
    }

    // Encrypt and store secrets (single AES-256-GCM path)
    if (secretsPayload) {
      secretRef = encrypt(JSON.stringify(secretsPayload));
      const encryptedBlob = encrypt(JSON.stringify(secretsPayload));
      // Replace old secrets with new encrypted entry
      await prisma.integrationSecret.deleteMany({
        where: { integrationId: params.id },
      });
      await prisma.integrationSecret.create({
        data: {
          integrationId: params.id,
          encryptedBlob,
          keyVersion: 1,
        },
      });
    }

    const integration = await prisma.integration.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.config !== undefined && { config: data.config as Prisma.InputJsonValue }),
        ...(secretRef !== existing.secretRef && { secretRef }),
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const actions: string[] = [];
    if (data.status === "ENABLED" && existing.status !== "ENABLED") actions.push("INTEGRATION_ENABLED");
    if (data.status === "DISABLED" && existing.status !== "DISABLED") actions.push("INTEGRATION_DISABLED");
    if (!actions.length) actions.push("INTEGRATION_UPDATED");

    const clientInfo = getClientInfo(request);
    for (const action of actions) {
      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action,
        entityType: "Integration",
        entityId: integration.id,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { provider: integration.provider, changes: Object.keys(data) },
      });
    }

    const { secretRef: _sr, ...safeIntegration } = integration;
    return NextResponse.json({ ...safeIntegration, hasSecret: !!secretRef });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "delete");

    const existing = await prisma.integration.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });

    if (!existing) {
      throw new ApiError(404, "Integration not found");
    }

    // Check if there are active data collection items
    const activeItems = await prisma.dataCollectionItem.count({
      where: {
        integrationId: params.id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    });

    if (activeItems > 0) {
      throw new ApiError(
        400,
        `Cannot delete integration with ${activeItems} active data collection item(s). Complete or cancel them first.`
      );
    }

    await prisma.integration.delete({ where: { id: params.id } });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "INTEGRATION_DELETED",
      entityType: "Integration",
      entityId: params.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { provider: existing.provider, name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
