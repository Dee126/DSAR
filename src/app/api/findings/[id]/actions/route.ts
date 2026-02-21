import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AcceptRiskSchema = z.object({
  action: z.literal("accept_risk"),
  comment: z.string().min(1, "Comment is required when accepting risk"),
});

const CreateMitigationSchema = z.object({
  action: z.literal("create_mitigation"),
  comment: z.string().min(1, "Comment is required"),
  dueDate: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
  taskTitle: z.string().optional(),
});

const ActionSchema = z.discriminatedUnion("action", [
  AcceptRiskSchema,
  CreateMitigationSchema,
]);

/**
 * POST /api/findings/[id]/actions
 *
 * Perform an action on a finding:
 *   - accept_risk: sets status=ACCEPTED, stores comment
 *   - create_mitigation: sets status=MITIGATED, creates a linked Task
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "update");

    const body = await request.json();
    const data = ActionSchema.parse(body);

    const finding = await prisma.finding.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      include: {
        run: {
          select: {
            caseId: true,
            case: { select: { caseNumber: true } },
          },
        },
        system: { select: { id: true, name: true } },
      },
    });

    if (!finding) {
      throw new ApiError(404, "Finding not found");
    }

    const clientInfo = getClientInfo(request);

    if (data.action === "accept_risk") {
      const updated = await prisma.finding.update({
        where: { id: finding.id },
        data: {
          status: "ACCEPTED",
          statusComment: data.comment,
          statusChangedByUserId: user.id,
          statusChangedAt: new Date(),
        },
      });

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "FINDING_ACCEPT_RISK",
        entityType: "Finding",
        entityId: finding.id,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: {
          comment: data.comment,
          systemName: finding.system?.name,
          caseNumber: finding.run.case.caseNumber,
        },
      });

      return NextResponse.json(updated);
    }

    // create_mitigation
    const dueDate = new Date(data.dueDate);
    const title =
      data.taskTitle ||
      `Mitigate finding: ${finding.summary.slice(0, 80)}`;

    const [updated, task] = await prisma.$transaction([
      prisma.finding.update({
        where: { id: finding.id },
        data: {
          status: "MITIGATED",
          statusComment: data.comment,
          statusChangedByUserId: user.id,
          statusChangedAt: new Date(),
          mitigationDueDate: dueDate,
        },
      }),
      prisma.task.create({
        data: {
          tenantId: user.tenantId,
          caseId: finding.run.caseId,
          findingId: finding.id,
          systemId: finding.systemId,
          title,
          description: data.comment,
          status: "OPEN",
          dueDate,
        },
      }),
    ]);

    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "FINDING_CREATE_MITIGATION",
      entityType: "Finding",
      entityId: finding.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        taskId: task.id,
        comment: data.comment,
        dueDate: data.dueDate,
        systemName: finding.system?.name,
        caseNumber: finding.run.case.caseNumber,
      },
    });

    return NextResponse.json({ finding: updated, task });
  } catch (error) {
    return handleApiError(error);
  }
}
