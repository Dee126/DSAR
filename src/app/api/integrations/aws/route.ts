import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";
import { encrypt } from "@/lib/security/encryption";
import { createAwsIntegrationSchema } from "@/lib/validation";
import { Prisma } from "@prisma/client";

/**
 * POST /api/integrations/aws
 * Create an AWS integration with provider=AWS, encrypting secrets.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "create");

    const body = await request.json();
    const data = createAwsIntegrationSchema.parse(body);

    // Separate secrets from non-secret config
    const secretsPayload: Record<string, string> = {
      authType: data.authType,
      accessKeyId: data.accessKeyId,
      secretAccessKey: data.secretAccessKey,
      region: data.region,
    };
    if (data.sessionToken) secretsPayload.sessionToken = data.sessionToken;
    if (data.roleArn) secretsPayload.roleArn = data.roleArn;
    if (data.externalId) secretsPayload.externalId = data.externalId;

    // Non-secret config (safe to store as plaintext JSON)
    const config: Record<string, unknown> = {
      region: data.region,
      authType: data.authType,
    };
    if (data.roleArn) config.roleArn = data.roleArn;

    // Encrypt secrets with AES-256-GCM
    const secretRef = encrypt(JSON.stringify(secretsPayload));

    const integration = await prisma.integration.create({
      data: {
        tenantId: user.tenantId,
        provider: "AWS",
        name: data.name,
        config: config as Prisma.InputJsonValue,
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

    // Store in IntegrationSecret table
    const encryptedBlob = encrypt(JSON.stringify(secretsPayload));
    await prisma.integrationSecret.create({
      data: {
        integrationId: integration.id,
        encryptedBlob,
        keyVersion: 1,
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
      details: {
        provider: "AWS",
        name: data.name,
        region: data.region,
        authType: data.authType,
      },
    });

    const { secretRef: _sr, ...safeIntegration } = integration;
    return NextResponse.json(
      { ...safeIntegration, hasSecret: true },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
