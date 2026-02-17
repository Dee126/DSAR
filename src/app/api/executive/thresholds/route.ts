export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { createKpiThresholdSchema } from "@/lib/validation";

/**
 * GET /api/executive/thresholds — List KPI thresholds
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EXEC_DASHBOARD_VIEW");

    const thresholds = await prisma.kpiThreshold.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { kpiKey: "asc" },
    });

    return NextResponse.json(thresholds);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/executive/thresholds — Create or update a KPI threshold
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EXEC_KPI_CONFIG");

    const body = await request.json();
    const parsed = createKpiThresholdSchema.parse(body);

    const threshold = await prisma.kpiThreshold.upsert({
      where: {
        tenantId_kpiKey: {
          tenantId: user.tenantId,
          kpiKey: parsed.kpiKey,
        },
      },
      update: {
        greenMax: parsed.greenMax,
        yellowMax: parsed.yellowMax,
        direction: parsed.direction,
      },
      create: {
        tenantId: user.tenantId,
        kpiKey: parsed.kpiKey,
        greenMax: parsed.greenMax,
        yellowMax: parsed.yellowMax,
        direction: parsed.direction ?? "lower_is_better",
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "KPI_THRESHOLD_UPDATED",
      entityType: "KpiThreshold",
      entityId: threshold.id,
      ip,
      userAgent,
      details: parsed,
    });

    return NextResponse.json(threshold, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
