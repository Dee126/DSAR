import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { findingAcceptSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/findings/[id]/accept
 *
 * Accept risk on a finding. Requires a comment explaining why.
 * Transitions status: OPEN → ACCEPTED
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "findings", "update");

    const body = await request.json();
    const data = findingAcceptSchema.parse(body);

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
      throw new ApiError(400, `Cannot accept risk: finding status is ${finding.status}, expected OPEN`);
    }

    const clientInfo = getClientInfo(request);
    const beforeSnapshot = {
      status: finding.status,
      statusComment: finding.statusComment,
      statusChangedByUserId: finding.statusChangedByUserId,
      statusChangedAt: finding.statusChangedAt,
    };

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

    // Write finding audit event
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

    // Also write to global audit log
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
  } catch (error) {
    return handleApiError(error);
  }
}
