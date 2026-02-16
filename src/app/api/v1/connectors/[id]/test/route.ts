import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { getConnectorImplementation, ConnectorConfig } from "@/lib/connector-framework";
import { decryptSecret } from "@/lib/secrets";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "CONNECTORS_MANAGE");

    const { id } = await params;

    const connector = await prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { secrets: true },
    });
    if (!connector) throw new ApiError(404, "Connector not found");

    const impl = getConnectorImplementation(connector.type);
    if (!impl) throw new ApiError(400, `No implementation for connector type: ${connector.type}`);

    const config = (connector.configJson as ConnectorConfig) || {};

    // Decrypt secrets
    const secrets: Record<string, string> = {};
    for (const s of connector.secrets) {
      try {
        secrets[s.secretType] = decryptSecret(s.secretCiphertext);
      } catch {
        // skip failed decryption
      }
    }

    const result = await impl.testConnection(config, secrets);

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
