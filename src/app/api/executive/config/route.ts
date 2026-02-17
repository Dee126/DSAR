import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { updateKpiConfigSchema } from "@/lib/validation";

/**
 * GET /api/executive/config — Get KPI configuration
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EXEC_KPI_CONFIG");

    const config = await prisma.privacyKpiConfig.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!config) {
      // Return defaults
      return NextResponse.json({
        tenantId: user.tenantId,
        estimatedCostPerDsar: 150,
        estimatedMinutesManual: 480,
        estimatedMinutesAutomated: 120,
        maturityWeights: {
          documentation: 0.2,
          automation: 0.25,
          sla_compliance: 0.25,
          incident_integration: 0.15,
          vendor_coordination: 0.15,
        },
        snapshotCron: "0 2 1 * *",
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/executive/config — Update KPI configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EXEC_KPI_CONFIG");

    const body = await request.json();
    const parsed = updateKpiConfigSchema.parse(body);

    const config = await prisma.privacyKpiConfig.upsert({
      where: { tenantId: user.tenantId },
      update: {
        ...(parsed.estimatedCostPerDsar !== undefined && { estimatedCostPerDsar: parsed.estimatedCostPerDsar }),
        ...(parsed.estimatedMinutesManual !== undefined && { estimatedMinutesManual: parsed.estimatedMinutesManual }),
        ...(parsed.estimatedMinutesAutomated !== undefined && { estimatedMinutesAutomated: parsed.estimatedMinutesAutomated }),
        ...(parsed.maturityWeights !== undefined && { maturityWeights: parsed.maturityWeights }),
        ...(parsed.snapshotCron !== undefined && { snapshotCron: parsed.snapshotCron }),
      },
      create: {
        tenantId: user.tenantId,
        estimatedCostPerDsar: parsed.estimatedCostPerDsar ?? 150,
        estimatedMinutesManual: parsed.estimatedMinutesManual ?? 480,
        estimatedMinutesAutomated: parsed.estimatedMinutesAutomated ?? 120,
        maturityWeights: parsed.maturityWeights ?? {
          documentation: 0.2,
          automation: 0.25,
          sla_compliance: 0.25,
          incident_integration: 0.15,
          vendor_coordination: 0.15,
        },
        snapshotCron: parsed.snapshotCron ?? "0 2 1 * *",
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "KPI_CONFIG_UPDATED",
      entityType: "PrivacyKpiConfig",
      entityId: config.id,
      ip,
      userAgent,
      details: parsed,
    });

    return NextResponse.json(config);
  } catch (error) {
    return handleApiError(error);
  }
}
