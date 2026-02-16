import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { createWebhookEndpointSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "WEBHOOKS_MANAGE");

    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { deliveries: true } },
      },
    });

    return NextResponse.json({ data: endpoints });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "WEBHOOKS_MANAGE");

    const body = await request.json();
    const data = createWebhookEndpointSchema.parse(body);

    const secret = randomBytes(32).toString("hex");

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        tenantId: user.tenantId,
        url: data.url,
        secret,
        enabled: data.enabled,
        subscribedEvents: data.subscribedEvents,
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "WEBHOOK_ENDPOINT_CREATED",
      entityType: "WebhookEndpoint",
      entityId: endpoint.id,
      ip,
      userAgent,
      details: { url: data.url, events: data.subscribedEvents },
    });

    return NextResponse.json({
      data: {
        ...endpoint,
        secret, // Show only once
      },
      warning: "Store the webhook secret securely. It will not be shown again.",
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
