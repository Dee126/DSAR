import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { decryptIntegrationSecret } from "@/lib/integration-crypto";
import { awsSecretsPayloadSchema } from "@/lib/validation";
import { scanAwsResources } from "@/lib/aws-clients";
import type { AwsSecrets } from "@/lib/aws-clients";
import { Prisma } from "@prisma/client";

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/integrations/aws/:id/scan
 * Decrypt secrets, run metadata inventory (S3, RDS, DynamoDB).
 * Stores results in integration_runs + integration_run_items.
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
      throw new ApiError(500, "Failed to decrypt stored credentials. Re-save the integration credentials.");
    }

    const secrets = awsSecretsPayloadSchema.parse(JSON.parse(decryptedPayload)) as AwsSecrets;

    // Create the integration run record
    const run = await prisma.integrationRun.create({
      data: {
        tenantId: user.tenantId,
        integrationId: params.id,
        status: "RUNNING",
      },
    });

    try {
      const summary = await scanAwsResources(secrets);

      // Store scan items
      if (summary.items.length > 0) {
        await prisma.integrationRunItem.createMany({
          data: summary.items.map((item) => ({
            runId: run.id,
            resourceType: item.resourceType,
            resourceId: item.resourceId,
            resourceName: item.resourceName,
            region: item.region,
            metaJson: item.metaJson as Prisma.InputJsonValue,
          })),
        });
      }

      // Mark run as completed
      const finishedAt = new Date();
      await prisma.integrationRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          finishedAt,
        },
      });

      const clientInfo = getClientInfo(request);
      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "INTEGRATION_SCANNED",
        entityType: "Integration",
        entityId: params.id,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: {
          provider: "AWS",
          runId: run.id,
          s3Buckets: summary.s3Buckets,
          rdsInstances: summary.rdsInstances,
          dynamoTables: summary.dynamoTables,
          totalItems: summary.items.length,
        },
      });

      return NextResponse.json({
        runId: run.id,
        status: "COMPLETED",
        startedAt: run.startedAt,
        finishedAt,
        summary: {
          s3Buckets: summary.s3Buckets,
          rdsInstances: summary.rdsInstances,
          dynamoTables: summary.dynamoTables,
          totalItems: summary.items.length,
        },
        items: summary.items,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Mark run as failed
      await prisma.integrationRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          error: errorMessage,
        },
      });

      const clientInfo = getClientInfo(request);
      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "INTEGRATION_SCANNED",
        entityType: "Integration",
        entityId: params.id,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: {
          provider: "AWS",
          runId: run.id,
          error: errorMessage,
        },
      });

      return NextResponse.json(
        {
          runId: run.id,
          status: "FAILED",
          error: errorMessage,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return handleApiError(error);
  }
}
