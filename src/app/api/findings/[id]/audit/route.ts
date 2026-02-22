import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/findings/[id]/audit
 *
 * Returns the audit trail for a specific finding, ordered by most recent first.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "findings", "read");

    // Verify finding exists and belongs to tenant
    const finding = await prisma.finding.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      select: { id: true },
    });

    if (!finding) {
      throw new ApiError(404, "Finding not found");
    }

    const events = await prisma.findingAuditEvent.findMany({
      where: { findingId: params.id, tenantId: user.tenantId },
      include: {
        actor: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(events);
  } catch (error) {
    return handleApiError(error);
  }
}
