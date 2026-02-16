import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { createConnectorRunSchema } from "@/lib/validation";
import { executeConnectorRun } from "@/lib/connector-framework";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "CONNECTORS_VIEW");

    const { id } = await params;

    const runs = await prisma.connectorRun.findMany({
      where: { connectorId: id, tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        runType: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        caseId: true,
        systemId: true,
        outputDocumentId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: runs });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "CONNECTORS_RUN");

    const { id } = await params;
    const body = await request.json();
    const data = createConnectorRunSchema.parse(body);

    const connector = await prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!connector) throw new ApiError(404, "Connector not found");
    if (connector.status === "DISABLED") {
      throw new ApiError(400, "Connector is disabled");
    }

    // Validate case exists if provided
    if (data.caseId) {
      const caseExists = await prisma.dSARCase.findFirst({
        where: { id: data.caseId, tenantId: user.tenantId },
      });
      if (!caseExists) throw new ApiError(404, "Case not found");
    }

    const run = await prisma.connectorRun.create({
      data: {
        tenantId: user.tenantId,
        connectorId: id,
        caseId: data.caseId || null,
        systemId: data.systemId || null,
        runType: data.runType,
        status: "PENDING",
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "CONNECTOR_RUN_STARTED",
      entityType: "ConnectorRun",
      entityId: run.id,
      ip,
      userAgent,
      details: { connectorType: connector.type, runType: data.runType },
    });

    // Execute synchronously (with timeout awareness)
    try {
      await executeConnectorRun(run.id, user.tenantId);
    } catch (execErr) {
      // Run already marked as failed in executeConnectorRun
      console.error("Connector run execution error:", execErr);
    }

    // Fetch updated run
    const updatedRun = await prisma.connectorRun.findUnique({
      where: { id: run.id },
      include: {
        document: { select: { id: true, filename: true } },
      },
    });

    return NextResponse.json({ data: updatedRun }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
