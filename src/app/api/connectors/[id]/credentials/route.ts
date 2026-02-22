export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { encrypt } from "@/lib/encryption";
import { storeConnectorCredentialSchema } from "@/lib/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/connectors/:id/credentials — store encrypted credentials
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "update");
    const { id } = await params;

    const connector = await prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!connector) {
      throw new ApiError(404, "Connector not found");
    }

    const body = await request.json();
    const data = storeConnectorCredentialSchema.parse(body);

    // Encrypt the credentials blob
    const encryptedBlob = encrypt(JSON.stringify(data.credentials));

    // Upsert: replace existing credential with same label
    const existing = await prisma.connectorCredential.findFirst({
      where: { connectorId: id, label: data.label },
    });

    let credential;
    if (existing) {
      credential = await prisma.connectorCredential.update({
        where: { id: existing.id },
        data: { encryptedBlob, keyVersion: 1 },
      });
    } else {
      credential = await prisma.connectorCredential.create({
        data: {
          connectorId: id,
          label: data.label,
          encryptedBlob,
          keyVersion: 1,
        },
      });
    }

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "connector.credential_stored",
      entityType: "ConnectorCredential",
      entityId: credential.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { connectorId: id, label: data.label },
    });

    return NextResponse.json(
      { id: credential.id, label: credential.label, createdAt: credential.createdAt },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/connectors/:id/credentials — list credential labels (no secrets returned)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "read");
    const { id } = await params;

    const connector = await prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!connector) {
      throw new ApiError(404, "Connector not found");
    }

    const credentials = await prisma.connectorCredential.findMany({
      where: { connectorId: id },
      select: { id: true, label: true, keyVersion: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: credentials });
  } catch (error) {
    return handleApiError(error);
  }
}
