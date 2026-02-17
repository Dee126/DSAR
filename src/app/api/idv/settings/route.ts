export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { updateIdvSettingsSchema } from "@/lib/validation";

const DEFAULTS = {
  allowedMethods: ["DOC_UPLOAD"] as string[],
  selfieEnabled: false,
  knowledgeBasedEnabled: false,
  emailOtpEnabled: true,
  retentionDays: 90,
  portalTokenExpiryDays: 7,
  maxSubmissionsPerToken: 3,
  bypassForSsoEmail: false,
  bypassForRepeatRequester: false,
  repeatRequesterMonths: 6,
  autoTransitionOnApproval: false,
  storeDob: true,
};

/**
 * GET /api/idv/settings — Get tenant IDV settings
 */
export async function GET() {
  try {
    const user = await requireAuth();
    enforce(user.role, "IDV_SETTINGS_VIEW");

    const settings = await prisma.idvSettings.findUnique({
      where: { tenantId: user.tenantId },
    });

    return NextResponse.json(settings ?? { ...DEFAULTS, tenantId: user.tenantId });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/idv/settings — Upsert tenant IDV settings
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "IDV_SETTINGS_EDIT");
    const clientInfo = getClientInfo(request);

    const body = await request.json();
    const parsed = updateIdvSettingsSchema.parse(body);

    const settings = await prisma.idvSettings.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        ...DEFAULTS,
        ...(parsed as any),
      },
      update: parsed as any,
    });

    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "idv.settings_updated",
      entityType: "IdvSettings",
      entityId: settings.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: parsed,
    });

    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
