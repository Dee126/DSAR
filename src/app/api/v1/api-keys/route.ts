import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { createApiKeySchema } from "@/lib/validation";
import { generateApiKey, hashApiKey } from "@/lib/api-key-auth";

// Session-authenticated management endpoints (not API key auth)

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "API_KEYS_MANAGE");

    const keys = await prisma.apiKey.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopesJson: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        creator: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({ data: keys });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "API_KEYS_MANAGE");

    const body = await request.json();
    const data = createApiKeySchema.parse(body);

    const { key, prefix, hash } = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        keyHash: hash,
        prefix,
        scopesJson: data.scopes,
        createdBy: user.id,
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "API_KEY_CREATED",
      entityType: "ApiKey",
      entityId: apiKey.id,
      ip,
      userAgent,
      details: { name: data.name, scopes: data.scopes },
    });

    // Return the full key only once
    return NextResponse.json({
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key, // Only shown once!
        prefix,
        scopes: data.scopes,
        createdAt: apiKey.createdAt,
      },
      warning: "Store this API key securely. It will not be shown again.",
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
