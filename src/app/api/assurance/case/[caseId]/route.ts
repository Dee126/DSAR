import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { getRecentCaseAccessLogs } from "@/lib/access-log-service";
import { getCaseRetentionTimers } from "@/lib/retention-service";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "ASSURANCE_VIEW");

    const { caseId } = await params;

    // Verify case belongs to tenant
    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: caseId, tenantId: user.tenantId },
      select: { id: true },
    });

    if (!dsarCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    // Fetch assurance data for case detail mini panel
    const [recentAccessLogs, retentionTimers, legalHold] = await Promise.all([
      getRecentCaseAccessLogs(user.tenantId, caseId, 5),
      getCaseRetentionTimers(user.tenantId, caseId),
      prisma.legalHold.findFirst({
        where: { tenantId: user.tenantId, caseId, disabledAt: null },
        select: { id: true, reason: true, enabledAt: true },
      }),
    ]);

    return NextResponse.json({
      legalHoldActive: !!legalHold,
      legalHold,
      recentAccessLogs,
      retentionTimers,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
