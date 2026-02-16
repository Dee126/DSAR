import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { updateWebhookEndpointSchema } from "@/lib/validation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "WEBHOOKS_MANAGE");

    const { id } = await params;
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            eventType: true,
            status: true,
            responseCode: true,
            attempts: true,
            createdAt: true,
            deliveredAt: true,
          },
        },
      },
    });

    if (!endpoint) throw new ApiError(404, "Webhook endpoint not found");
    return NextResponse.json({ data: endpoint });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "WEBHOOKS_MANAGE");

    const { id } = await params;
    const body = await request.json();
    const data = updateWebhookEndpointSchema.parse(body);

    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new ApiError(404, "Webhook endpoint not found");

    const updated = await prisma.webhookEndpoint.update({
      where: { id },
      data: {
        ...(data.url !== undefined && { url: data.url }),
        ...(data.subscribedEvents !== undefined && { subscribedEvents: data.subscribedEvents }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "WEBHOOK_ENDPOINT_UPDATED",
      entityType: "WebhookEndpoint",
      entityId: id,
      ip,
      userAgent,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "WEBHOOKS_MANAGE");

    const { id } = await params;
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new ApiError(404, "Webhook endpoint not found");

    await prisma.webhookDelivery.deleteMany({ where: { endpointId: id } });
    await prisma.webhookEndpoint.delete({ where: { id } });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "WEBHOOK_ENDPOINT_DELETED",
      entityType: "WebhookEndpoint",
      entityId: id,
      ip,
      userAgent,
    });

    return NextResponse.json({ message: "Webhook endpoint deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
