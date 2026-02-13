import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";

const updateCopilotRunSchema = z.object({
  legalApprovalStatus: z.enum(["APPROVED", "REJECTED"]).optional(),
  cancel: z.boolean().optional(),
});

/* -- GET — Get a single copilot run with all details ----------------------- */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "read");

    const { id: caseId, runId } = await params;

    // Verify case exists in tenant
    const dsarCase = await prisma.dSARCase.findFirst({
      where: {
        id: caseId,
        tenantId: user.tenantId,
        deletedAt: null,
      },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    const run = await prisma.copilotRun.findFirst({
      where: {
        id: runId,
        caseId,
        tenantId: user.tenantId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        legalApprovedBy: {
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
        evidenceItems: {
          orderBy: { createdAt: "asc" },
        },
        findings: {
          orderBy: { createdAt: "asc" },
        },
        summaries: {
          orderBy: { createdAt: "desc" },
        },
        exports: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!run) {
      throw new ApiError(404, "Copilot run not found");
    }

    return NextResponse.json(run);
  } catch (error) {
    return handleApiError(error);
  }
}

/* -- PATCH — Update a copilot run (legal approval / cancel) ---------------- */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "manage");

    const { id: caseId, runId } = await params;

    const body = await request.json();
    const data = updateCopilotRunSchema.parse(body);

    // Verify case exists in tenant
    const dsarCase = await prisma.dSARCase.findFirst({
      where: {
        id: caseId,
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
        id: runId,
        caseId,
        tenantId: user.tenantId,
      },
    });

    if (!existingRun) {
      throw new ApiError(404, "Copilot run not found");
    }

    const clientInfo = getClientInfo(request);

    // Handle legal approval status update
    if (data.legalApprovalStatus !== undefined) {
      if (data.legalApprovalStatus === "APPROVED") {
        await prisma.copilotRun.update({
          where: { id: runId },
          data: {
            legalApprovalStatus: "APPROVED",
            legalApprovedByUserId: user.id,
            legalApprovedAt: new Date(),
          },
        });

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "copilot_run.legal_approved",
          entityType: "CopilotRun",
          entityId: runId,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: {
            caseId,
            caseNumber: dsarCase.caseNumber,
            legalApprovalStatus: "APPROVED",
          },
        });
      } else {
        // REJECTED
        await prisma.copilotRun.update({
          where: { id: runId },
          data: {
            legalApprovalStatus: "REJECTED",
            legalApprovedByUserId: user.id,
            legalApprovedAt: new Date(),
          },
        });

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "copilot_run.legal_rejected",
          entityType: "CopilotRun",
          entityId: runId,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: {
            caseId,
            caseNumber: dsarCase.caseNumber,
            legalApprovalStatus: "REJECTED",
          },
        });
      }
    }

    // Handle cancel
    if (data.cancel) {
      if (
        existingRun.status === "COMPLETED" ||
        existingRun.status === "CANCELED" ||
        existingRun.status === "FAILED"
      ) {
        throw new ApiError(
          400,
          `Cannot cancel a run with status ${existingRun.status}`
        );
      }

      await prisma.copilotRun.update({
        where: { id: runId },
        data: {
          status: "CANCELED",
          completedAt: new Date(),
        },
      });

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "copilot_run.canceled",
        entityType: "CopilotRun",
        entityId: runId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: {
          caseId,
          caseNumber: dsarCase.caseNumber,
          previousStatus: existingRun.status,
        },
      });
    }

    // Fetch and return the updated run with full includes
    const updatedRun = await prisma.copilotRun.findFirst({
      where: {
        id: runId,
        caseId,
        tenantId: user.tenantId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        legalApprovedBy: {
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
        evidenceItems: {
          orderBy: { createdAt: "asc" },
        },
        findings: {
          orderBy: { createdAt: "asc" },
        },
        summaries: {
          orderBy: { createdAt: "desc" },
        },
        exports: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json(updatedRun);
  } catch (error) {
    return handleApiError(error);
  }
}
