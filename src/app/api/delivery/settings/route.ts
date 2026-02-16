import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { updateDeliverySettingsSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/delivery/settings
 * Returns delivery settings for the current tenant.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    enforce(user.role, "DELIVERY_SETTINGS_VIEW");

    let settings = await prisma.deliverySettings.findUnique({
      where: { tenantId: user.tenantId },
    });

    // Return defaults if no settings exist yet
    if (!settings) {
      settings = {
        id: "",
        tenantId: user.tenantId,
        defaultExpiresDays: 7,
        otpRequiredDefault: true,
        maxDownloadsDefault: 3,
        logRetentionDays: 365,
        allowOneTimeLinks: false,
        otpMaxAttempts: 5,
        otpLockoutMinutes: 15,
        otpExpiryMinutes: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/delivery/settings
 * Update delivery settings for the current tenant.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "DELIVERY_SETTINGS_EDIT");

    const body = await request.json();
    const data = updateDeliverySettingsSchema.parse(body);
    const { ip, userAgent } = getClientInfo(request);

    const settings = await prisma.deliverySettings.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        ...data,
      },
      update: data,
    });

    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "delivery_settings.updated",
      entityType: "DeliverySettings",
      entityId: settings.id,
      ip,
      userAgent,
      details: data,
    });

    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
