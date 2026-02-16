import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { decryptIntegrationSecret } from "@/lib/integration-crypto";
import { awsSecretsPayloadSchema } from "@/lib/validation";
import { testAwsConnection } from "@/lib/aws-clients";
import type { AwsSecrets } from "@/lib/aws-clients";

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/integrations/aws/:id/test
 * Decrypt secrets, call STS GetCallerIdentity, save status.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "update");

    const integration = await prisma.integration.findFirst({
      where: { id: params.id, tenantId: user.tenantId, provider: "AWS" },
      include: {
        secrets: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!integration) {
      throw new ApiError(404, "AWS integration not found");
    }

    // Decrypt the latest secret
    const latestSecret = integration.secrets[0];
    if (!latestSecret) {
      throw new ApiError(400, "No credentials configured for this integration");
    }

    let decryptedPayload: string;
    try {
      decryptedPayload = decryptIntegrationSecret(latestSecret.encryptedBlob);
    } catch {
      // Update status to reflect decryption failure
      await prisma.integration.update({
        where: { id: params.id },
        data: {
          healthStatus: "FAILED",
          lastHealthCheckAt: new Date(),
          lastError: "Failed to decrypt stored credentials",
        },
      });
      throw new ApiError(500, "Failed to decrypt stored credentials. Re-save the integration credentials.");
    }

    const secrets = awsSecretsPayloadSchema.parse(JSON.parse(decryptedPayload)) as AwsSecrets;
    const now = new Date();

    try {
      const identity = await testAwsConnection(secrets);

      // Update integration status to CONNECTED
      await prisma.integration.update({
        where: { id: params.id },
        data: {
          healthStatus: "HEALTHY",
          lastHealthCheckAt: now,
          lastSuccessAt: now,
          lastError: null,
          status: "ENABLED",
        },
      });

      const clientInfo = getClientInfo(request);
      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "INTEGRATION_TESTED",
        entityType: "Integration",
        entityId: params.id,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: {
          provider: "AWS",
          healthy: true,
          account: identity.account,
        },
      });

      return NextResponse.json({
        ok: true,
        account: identity.account,
        arn: identity.arn,
        userId: identity.userId,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Update integration status to ERROR
      await prisma.integration.update({
        where: { id: params.id },
        data: {
          healthStatus: "FAILED",
          lastHealthCheckAt: now,
          lastError: errorMessage,
        },
      });

      const clientInfo = getClientInfo(request);
      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "INTEGRATION_TESTED",
        entityType: "Integration",
        entityId: params.id,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: {
          provider: "AWS",
          healthy: false,
          error: errorMessage,
        },
      });

      return NextResponse.json(
        {
          ok: false,
          error: errorMessage,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    return handleApiError(error);
  }
}
