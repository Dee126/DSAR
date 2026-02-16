import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { createConnectorSchema } from "@/lib/validation";
import { encryptSecret } from "@/lib/secrets";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "CONNECTORS_VIEW");

    const connectors = await prisma.connector.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { runs: true, secrets: true } },
      },
    });

    return NextResponse.json({ data: connectors });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "CONNECTORS_MANAGE");

    const body = await request.json();
    const data = createConnectorSchema.parse(body);

    const connector = await prisma.connector.create({
      data: {
        tenantId: user.tenantId,
        type: data.type,
        name: data.name,
        configJson: (data.config || {}) as any,
      },
    });

    // Store secrets if provided
    if (data.secrets) {
      const secretEntries = Object.entries(data.secrets);
      for (const [key, value] of secretEntries) {
        await prisma.connectorSecret.create({
          data: {
            tenantId: user.tenantId,
            connectorId: connector.id,
            secretType: mapSecretType(key),
            secretCiphertext: encryptSecret(value),
          },
        });
      }
    }

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "CONNECTOR_CREATED",
      entityType: "Connector",
      entityId: connector.id,
      ip,
      userAgent,
      details: { type: data.type, name: data.name },
    });

    return NextResponse.json({ data: connector }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

function mapSecretType(key: string): "OAUTH_CLIENT" | "ACCESS_TOKEN" | "REFRESH_TOKEN" | "API_KEY" {
  const map: Record<string, "OAUTH_CLIENT" | "ACCESS_TOKEN" | "REFRESH_TOKEN" | "API_KEY"> = {
    clientSecret: "OAUTH_CLIENT",
    serviceAccountKey: "OAUTH_CLIENT",
    accessToken: "ACCESS_TOKEN",
    refreshToken: "REFRESH_TOKEN",
    apiKey: "API_KEY",
  };
  return map[key] || "API_KEY";
}
