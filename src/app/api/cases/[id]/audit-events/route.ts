export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/cases/[id]/audit-events
 *
 * Returns DSAR-specific audit events for a case (who, what, when).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "read");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!dsarCase) throw new ApiError(404, "Case not found");

    const events = await prisma.dsarAuditEvent.findMany({
      where: { caseId: params.id, tenantId: user.tenantId },
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ events });
  } catch (error) {
    return handleApiError(error);
  }
}
