import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { processPendingDeliveries } from "@/lib/webhook-service";
import { logAudit, getClientInfo } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "WEBHOOKS_MANAGE");

    const result = await processPendingDeliveries(user.tenantId);

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "WEBHOOK_DELIVERY_JOB",
      entityType: "WebhookDelivery",
      ip,
      userAgent,
      details: result,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
