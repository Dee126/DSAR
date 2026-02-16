import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { storeSecret } from "@/lib/secret-store";
import { encryptIntegrationSecret } from "@/lib/integration-crypto";
import { Prisma } from "@prisma/client";

/**
 * GET /api/integrations/aws/mock
 * Returns { available: boolean } — true when AWS_INTEGRATION_MOCK=true.
 */
export async function GET() {
  return NextResponse.json({
    available: process.env.AWS_INTEGRATION_MOCK === "true",
  });
}

/**
 * POST /api/integrations/aws/mock
 * Creates an AWS integration pre-filled with mock credentials.
 * Only works when AWS_INTEGRATION_MOCK=true.
 */
export async function POST(request: NextRequest) {
  try {
    if (process.env.AWS_INTEGRATION_MOCK !== "true") {
      throw new ApiError(
        403,
        "Mock mode is not enabled. Set AWS_INTEGRATION_MOCK=true to use this endpoint."
      );
    }

    const user = await requireAuth();
    checkPermission(user.role, "integrations", "create");

    const secretsPayload: Record<string, string> = {
      authType: "access_keys",
      accessKeyId: "AKIAMOCKDEVKEY000001",
      secretAccessKey: "mock+secret+key/not+real+do+not+use",
      region: "eu-central-1",
    };

    const config: Record<string, unknown> = {
      region: "eu-central-1",
      authType: "access_keys",
      mock: true,
    };

    const secretRef = await storeSecret(JSON.stringify(secretsPayload));

    const integration = await prisma.integration.create({
      data: {
        tenantId: user.tenantId,
        provider: "AWS",
        name: "AWS Mock (Dev)",
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

    const encryptedBlob = encryptIntegrationSecret(
      JSON.stringify(secretsPayload)
    );
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
        name: "AWS Mock (Dev)",
        region: "eu-central-1",
        authType: "access_keys",
        mock: true,
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
