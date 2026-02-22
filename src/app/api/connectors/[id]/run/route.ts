export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { executeConnectorRun } from "@/lib/connector-runner";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/connectors/:id/run — trigger a connector scan run
 *
 * For MVP: runs inline (synchronous stub).
 * Production: would enqueue to a job queue and return 202.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "update");
    const { id } = await params;

    const connector = await prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!connector) {
      throw new ApiError(404, "Connector not found");
    }

    if (!connector.enabled) {
      throw new ApiError(400, "Connector is disabled. Enable it before running a scan.");
    }

    // Check for already running scan
    const activeRun = await prisma.connectorRun.findFirst({
      where: {
        connectorId: id,
        status: { in: ["PENDING", "RUNNING"] },
      },
    });
    if (activeRun) {
      throw new ApiError(409, "A scan is already in progress for this connector");
    }

    // Create the run record
    const run = await prisma.connectorRun.create({
      data: {
        tenantId: user.tenantId,
        connectorId: id,
        status: "PENDING",
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "connector.run_started",
      entityType: "ConnectorRun",
      entityId: run.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { connectorId: id, connectorName: connector.name, category: connector.category },
    });

    // MVP: run inline (stub). Production: enqueue job.
    await executeConnectorRun(run.id, id, user.tenantId, connector.category);

    // Fetch the completed run
    const completedRun = await prisma.connectorRun.findUnique({
      where: { id: run.id },
    });

    return NextResponse.json(completedRun, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
