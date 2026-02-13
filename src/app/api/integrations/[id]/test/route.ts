import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { getConnector } from "@/lib/connectors/registry";
import { checkRateLimit, TEST_CONNECTION_LIMIT } from "@/lib/rate-limit";

interface RouteParams {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "update");

    // Rate limit
    const rl = checkRateLimit(`test:${params.id}`, TEST_CONNECTION_LIMIT);
    if (!rl.allowed) {
      throw new ApiError(
        429,
        `Rate limit exceeded. Try again in ${Math.ceil((rl.retryAfterMs ?? 60000) / 1000)}s.`
      );
    }

    const integration = await prisma.integration.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });

    if (!integration) {
      throw new ApiError(404, "Integration not found");
    }

    const connector = getConnector(integration.provider);
    if (!connector) {
      throw new ApiError(400, `No connector available for provider: ${integration.provider}`);
    }

    const config = (integration.config as Record<string, unknown>) ?? {};
    const result = await connector.healthCheck(config, integration.secretRef);

    // Update integration health status
    await prisma.integration.update({
      where: { id: params.id },
      data: {
        healthStatus: result.healthy ? "HEALTHY" : "FAILED",
        lastHealthCheckAt: result.checkedAt,
        lastSuccessAt: result.healthy ? result.checkedAt : undefined,
        lastError: result.healthy ? null : result.message,
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
        provider: integration.provider,
        healthy: result.healthy,
        message: result.message,
      },
    });

    return NextResponse.json({
      healthy: result.healthy,
      message: result.message,
      details: result.details,
      checkedAt: result.checkedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
