import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";

interface RouteParams {
  params: { id: string; runId: string };
}

const updateCopilotRunSchema = z.object({
  art9ReviewStatus: z.enum(["APPROVED", "BLOCKED"]).optional(),
  responseDraft: z.string().optional(),
});

/* -- GET — Get a single copilot run with all details ----------------------- */

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "read");

    // Verify case exists in tenant
    const dsarCase = await prisma.dSARCase.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
        deletedAt: null,
      },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    const run = await prisma.copilotRun.findFirst({
      where: {
        id: params.runId,
        caseId: params.id,
        tenantId: user.tenantId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        queries: {
          include: {
            integration: {
              select: { id: true, name: true, provider: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        findings: {
          include: {
            detectorResults: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!run) {
      throw new ApiError(404, "Copilot run not found");
    }

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "COPILOT_RUN_VIEWED",
      entityType: "CopilotRun",
      entityId: run.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: params.id,
        caseNumber: dsarCase.caseNumber,
        runStatus: run.status,
      },
    });

    return NextResponse.json(run);
  } catch (error) {
    return handleApiError(error);
  }
}

/* -- PATCH — Update a copilot run (Art. 9 review / response draft) --------- */

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "manage");

    const body = await request.json();
    const data = updateCopilotRunSchema.parse(body);

    // Verify case exists in tenant
    const dsarCase = await prisma.dSARCase.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
        deletedAt: null,
      },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    // Verify run exists in tenant/case
    const existingRun = await prisma.copilotRun.findFirst({
      where: {
        id: params.runId,
        caseId: params.id,
        tenantId: user.tenantId,
      },
    });

    if (!existingRun) {
      throw new ApiError(404, "Copilot run not found");
    }

    const clientInfo = getClientInfo(request);

    // Handle Art. 9 review status update
    if (data.art9ReviewStatus !== undefined) {
      await prisma.copilotRun.update({
        where: { id: params.runId },
        data: {
          art9ReviewStatus: data.art9ReviewStatus,
          art9ReviewedBy: user.id,
          art9ReviewedAt: new Date(),
        },
      });

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "COPILOT_ART9_REVIEWED",
        entityType: "CopilotRun",
        entityId: params.runId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: {
          caseId: params.id,
          caseNumber: dsarCase.caseNumber,
          art9ReviewStatus: data.art9ReviewStatus,
        },
      });
    }

    // Handle response draft update
    if (data.responseDraft !== undefined) {
      await prisma.copilotRun.update({
        where: { id: params.runId },
        data: {
          responseDraft: data.responseDraft,
        },
      });

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "COPILOT_SUMMARY_GENERATED",
        entityType: "CopilotRun",
        entityId: params.runId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: {
          caseId: params.id,
          caseNumber: dsarCase.caseNumber,
        },
      });
    }

    // Fetch and return the updated run
    const updatedRun = await prisma.copilotRun.findFirst({
      where: {
        id: params.runId,
        caseId: params.id,
        tenantId: user.tenantId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        queries: {
          include: {
            integration: {
              select: { id: true, name: true, provider: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        findings: {
          include: {
            detectorResults: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json(updatedRun);
  } catch (error) {
    return handleApiError(error);
  }
}
