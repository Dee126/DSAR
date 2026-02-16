import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { encrypt } from "@/lib/security/encryption";
import { getConnector, PROVIDER_INFO } from "@/lib/connectors/registry";
import { createIntegrationSchema } from "@/lib/validation";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "read");

    const integrations = await prisma.integration.findMany({
      where: { tenantId: user.tenantId },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { dataCollectionItems: true, secrets: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Strip secretRef from response; flag hasSecret from either legacy secretRef or new secrets table
    const safe = integrations.map(({ secretRef, ...rest }) => ({
      ...rest,
      hasSecret: !!secretRef || (rest._count.secrets ?? 0) > 0,
    }));

    return NextResponse.json({ data: safe, providers: PROVIDER_INFO });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "create");

    const body = await request.json();
    const data = createIntegrationSchema.parse(body);

    // Extract secrets from config and encrypt them
    let secretRef: string | null = null;
    let secretsPayload: Record<string, string> | null = null;
    const connector = getConnector(data.provider);
    const secretFields = connector?.getConfigFields().filter((f) => f.isSecret) ?? [];
    const cleanConfig: Record<string, unknown> = { ...data.config };

    if (data.secrets && Object.keys(data.secrets).length > 0) {
      secretsPayload = data.secrets;
    } else {
      // Check if secrets were passed in config (legacy path)
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
    }

    // Encrypt secrets with AES-256-GCM (single encryption path)
    if (secretsPayload) {
      secretRef = encrypt(JSON.stringify(secretsPayload));
    }

    const integration = await prisma.integration.create({
      data: {
        tenantId: user.tenantId,
        provider: data.provider,
        name: data.name,
        config: cleanConfig as Prisma.InputJsonValue,
        secretRef,
        ownerUserId: user.id,
        status: "DISABLED",
        healthStatus: "NOT_CONFIGURED",
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Store in IntegrationSecret table (encrypted secrets model)
    if (secretsPayload) {
      const encryptedBlob = encrypt(JSON.stringify(secretsPayload));
      await prisma.integrationSecret.create({
        data: {
          integrationId: integration.id,
          encryptedBlob,
          keyVersion: 1,
        },
      });
    }

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "INTEGRATION_CREATED",
      entityType: "Integration",
      entityId: integration.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { provider: data.provider, name: data.name },
    });

    const { secretRef: _sr, ...safeIntegration } = integration;
    return NextResponse.json(
      { ...safeIntegration, hasSecret: !!secretRef },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
