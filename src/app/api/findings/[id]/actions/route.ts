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
  assigneeUserId: z.string().uuid().optional(),
});

const MarkMitigatedSchema = z.object({
  action: z.literal("mark_mitigated"),
  comment: z.string().min(1, "Comment is required when marking as mitigated"),
});

const ActionSchema = z.discriminatedUnion("action", [
  AcceptRiskSchema,
  CreateMitigationSchema,
  MarkMitigatedSchema,
]);

/**
 * POST /api/findings/[id]/actions
 *
 * Perform an action on a finding:
 *   - accept_risk: OPEN → ACCEPTED (requires comment)
 *   - create_mitigation: OPEN → MITIGATING (creates linked Task)
 *   - mark_mitigated: MITIGATING → MITIGATED (requires comment)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "findings", "update");

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
    const beforeSnapshot = {
      status: finding.status,
      statusComment: finding.statusComment,
      statusChangedByUserId: finding.statusChangedByUserId,
      statusChangedAt: finding.statusChangedAt,
      mitigationDueDate: finding.mitigationDueDate,
    };

    if (data.action === "accept_risk") {
      if (finding.status !== "OPEN") {
        throw new ApiError(400, `Cannot accept risk: finding status is ${finding.status}, expected OPEN`);
      }

      const updated = await prisma.finding.update({
        where: { id: finding.id },
        data: {
          status: "ACCEPTED",
          statusComment: data.comment,
          statusChangedByUserId: user.id,
          statusChangedAt: new Date(),
        },
      });

      const afterSnapshot = {
        status: updated.status,
        statusComment: updated.statusComment,
        statusChangedByUserId: updated.statusChangedByUserId,
        statusChangedAt: updated.statusChangedAt,
      };

      await prisma.findingAuditEvent.create({
        data: {
          tenantId: user.tenantId,
          findingId: finding.id,
          actorUserId: user.id,
          action: "FINDING_ACCEPT_RISK",
          beforeJson: beforeSnapshot,
          afterJson: afterSnapshot,
          comment: data.comment,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
        },
      });

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "FINDING_ACCEPT_RISK",
        entityType: "FINDING",
        entityId: finding.id,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: {
          comment: data.comment,
          systemName: finding.system?.name,
          caseNumber: finding.run.case.caseNumber,
          before: beforeSnapshot,
          after: afterSnapshot,
        },
      });

      return NextResponse.json(updated);
    }

    if (data.action === "create_mitigation") {
      if (finding.status !== "OPEN") {
        throw new ApiError(400, `Cannot create mitigation: finding status is ${finding.status}, expected OPEN`);
      }

      const dueDate = new Date(data.dueDate);
      const title =
        data.taskTitle ||
        `Mitigate finding: ${finding.summary.slice(0, 80)}`;

      const [updated, task] = await prisma.$transaction([
        prisma.finding.update({
          where: { id: finding.id },
          data: {
            status: "MITIGATING",
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
            assigneeUserId: data.assigneeUserId ?? null,
          },
        }),
      ]);

      const afterSnapshot = {
        status: updated.status,
        statusComment: updated.statusComment,
        statusChangedByUserId: updated.statusChangedByUserId,
        statusChangedAt: updated.statusChangedAt,
        mitigationDueDate: updated.mitigationDueDate,
        taskId: task.id,
      };

      await prisma.findingAuditEvent.create({
        data: {
          tenantId: user.tenantId,
          findingId: finding.id,
          actorUserId: user.id,
          action: "FINDING_CREATE_MITIGATION",
          beforeJson: beforeSnapshot,
          afterJson: afterSnapshot,
          comment: data.comment,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
        },
      });

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "FINDING_CREATE_MITIGATION",
        entityType: "FINDING",
        entityId: finding.id,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: {
          taskId: task.id,
          comment: data.comment,
          dueDate: data.dueDate,
          assigneeUserId: data.assigneeUserId,
          systemName: finding.system?.name,
          caseNumber: finding.run.case.caseNumber,
          before: beforeSnapshot,
          after: afterSnapshot,
        },
      });

      return NextResponse.json({ finding: updated, task });
    }

    // mark_mitigated
    if (finding.status !== "MITIGATING") {
      throw new ApiError(400, `Cannot resolve: finding status is ${finding.status}, expected MITIGATING`);
    }

    const updated = await prisma.finding.update({
      where: { id: finding.id },
      data: {
        status: "MITIGATED",
        statusComment: data.comment,
        statusChangedByUserId: user.id,
        statusChangedAt: new Date(),
      },
    });

    const afterSnapshot = {
      status: updated.status,
      statusComment: updated.statusComment,
      statusChangedByUserId: updated.statusChangedByUserId,
      statusChangedAt: updated.statusChangedAt,
    };

    await prisma.findingAuditEvent.create({
      data: {
        tenantId: user.tenantId,
        findingId: finding.id,
        actorUserId: user.id,
        action: "FINDING_MARK_MITIGATED",
        beforeJson: beforeSnapshot,
        afterJson: afterSnapshot,
        comment: data.comment,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      },
    });

    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "FINDING_MARK_MITIGATED",
      entityType: "FINDING",
      entityId: finding.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        comment: data.comment,
        systemName: finding.system?.name,
        caseNumber: finding.run.case.caseNumber,
        before: beforeSnapshot,
        after: afterSnapshot,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
