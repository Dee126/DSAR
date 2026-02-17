export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";
import { updateSlaConfigSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SLA_CONFIG } from "@/lib/deadline";

/**
 * GET /api/sla-config
 * Returns the tenant SLA configuration.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    enforce(user.role, "SLA_CONFIG_VIEW");

    let config = await prisma.tenantSlaConfig.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!config) {
      // Return defaults
      return NextResponse.json({
        ...DEFAULT_SLA_CONFIG,
        escalationYellowRoles: ["DPO", "CASE_MANAGER"],
        escalationRedRoles: ["TENANT_ADMIN", "DPO"],
        escalationOverdueRoles: ["TENANT_ADMIN", "DPO"],
        tenantId: user.tenantId,
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/sla-config
 * Update the tenant SLA configuration (upsert).
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "SLA_CONFIG_EDIT");

    const body = await request.json();
    const data = updateSlaConfigSchema.parse(body);

    const config = await prisma.tenantSlaConfig.upsert({
      where: { tenantId: user.tenantId },
      update: data,
      create: {
        tenantId: user.tenantId,
        ...data,
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "SLA_CONFIG_UPDATED",
      entityType: "TenantSlaConfig",
      entityId: config.id,
      ip,
      userAgent,
      details: { changes: Object.keys(data) },
    });

    return NextResponse.json(config);
  } catch (error) {
    return handleApiError(error);
  }
}
