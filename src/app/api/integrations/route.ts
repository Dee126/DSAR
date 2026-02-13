import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { storeSecret } from "@/lib/secret-store";
import { getConnector, PROVIDER_INFO } from "@/lib/connectors/registry";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const createIntegrationSchema = z.object({
  provider: z.enum([
    "M365", "EXCHANGE_ONLINE", "SHAREPOINT", "ONEDRIVE",
    "GOOGLE_WORKSPACE", "SALESFORCE", "SERVICENOW",
    "ATLASSIAN_JIRA", "ATLASSIAN_CONFLUENCE", "WORKDAY", "SAP_SUCCESSFACTORS", "OKTA",
    "AWS", "AZURE", "GCP",
  ]),
  name: z.string().min(1).max(200),
  config: z.record(z.unknown()).optional(),
  secrets: z.record(z.string()).optional(),
});

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
          select: { dataCollectionItems: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Strip secretRef from response
    const safe = integrations.map(({ secretRef, ...rest }) => ({
      ...rest,
      hasSecret: !!secretRef,
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
    const connector = getConnector(data.provider);
    const secretFields = connector?.getConfigFields().filter((f) => f.isSecret) ?? [];
    const cleanConfig: Record<string, unknown> = { ...data.config };

    if (data.secrets && Object.keys(data.secrets).length > 0) {
      secretRef = await storeSecret(JSON.stringify(data.secrets));
    } else {
      // Check if secrets were passed in config (legacy)
      const extractedSecrets: Record<string, string> = {};
      for (const field of secretFields) {
        if (cleanConfig[field.key] && typeof cleanConfig[field.key] === "string") {
          extractedSecrets[field.key] = cleanConfig[field.key] as string;
          delete cleanConfig[field.key];
        }
      }
      if (Object.keys(extractedSecrets).length > 0) {
        secretRef = await storeSecret(JSON.stringify(extractedSecrets));
      }
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
