import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { updateIntakeSettingsSchema } from "@/lib/validation";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "read");

    let settings = await prisma.tenantIntakeSettings.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!settings) {
      // Return defaults
      settings = await prisma.tenantIntakeSettings.create({
        data: { tenantId: user.tenantId },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "settings", "update");

    const body = await request.json();
    const data = updateIntakeSettingsSchema.parse(body);
    const clientInfo = getClientInfo(request);

    const settings = await prisma.tenantIntakeSettings.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        ...data,
        enabledLanguages: data.enabledLanguages || ["en", "de"],
        requiredFields: data.requiredFields || ["subjectEmail"],
        portalWelcomeText: data.portalWelcomeText || undefined,
      },
      update: {
        ...data,
        enabledLanguages: data.enabledLanguages || undefined,
        requiredFields: data.requiredFields || undefined,
        portalWelcomeText: data.portalWelcomeText || undefined,
      },
    });

    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "intake.settings_updated",
      entityType: "TenantIntakeSettings",
      entityId: settings.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: data as Record<string, unknown>,
    });

    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
