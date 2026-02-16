import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { dedupeLinkSchema } from "@/lib/validation";
import { linkAsDuplicate, mergeCases, dismissCandidate } from "@/lib/services/dedupe-service";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";
import { ApiError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "update");

    const body = await request.json();
    const data = dedupeLinkSchema.parse(body);
    const clientInfo = getClientInfo(request);

    // Verify candidate exists and belongs to tenant
    const candidate = await prisma.dedupeCandidate.findFirst({
      where: {
        id: data.candidateId,
        tenantId: user.tenantId,
        caseId: params.caseId,
      },
    });

    if (!candidate) {
      throw new ApiError(404, "Dedupe candidate not found");
    }

    switch (data.action) {
      case "link":
        await linkAsDuplicate(
          user.tenantId,
          params.caseId,
          candidate.candidateCaseId,
          candidate.id
        );
        break;

      case "merge":
        await mergeCases(
          user.tenantId,
          params.caseId,
          candidate.candidateCaseId,
          candidate.id
        );
        break;

      case "dismiss":
        await dismissCandidate(candidate.id);
        break;
    }

    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: `intake.dedupe_${data.action}`,
      entityType: "DedupeCandidate",
      entityId: candidate.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: params.caseId,
        candidateCaseId: candidate.candidateCaseId,
        score: candidate.score,
      },
    });

    return NextResponse.json({ success: true, action: data.action });
  } catch (error) {
    return handleApiError(error);
  }
}
