import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { findingMitigateSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/findings/[id]/mitigate
 *
 * Create a mitigation task for a finding.
 * Transitions status: OPEN → MITIGATING
 * Creates a linked Task with optional assignee and due date.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "findings", "update");

    const body = await request.json();
    const data = findingMitigateSchema.parse(body);

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

    if (finding.status !== "OPEN") {
      throw new ApiError(400, `Cannot create mitigation: finding status is ${finding.status}, expected OPEN`);
    }

    const clientInfo = getClientInfo(request);
    const dueDate = new Date(data.dueDate);
    const title =
      data.taskTitle ||
      `Mitigate finding: ${finding.summary.slice(0, 80)}`;

    const beforeSnapshot = {
      status: finding.status,
      statusComment: finding.statusComment,
      statusChangedByUserId: finding.statusChangedByUserId,
      statusChangedAt: finding.statusChangedAt,
      mitigationDueDate: finding.mitigationDueDate,
    };

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

    // Write finding audit event
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

    // Also write to global audit log
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
  } catch (error) {
    return handleApiError(error);
  }
}
