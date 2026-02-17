export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/escalations
 * Returns escalations for the tenant, optionally filtered by severity.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "ESCALATIONS_VIEW");

    const { searchParams } = new URL(request.url);
    const severity = searchParams.get("severity");
    const acknowledged = searchParams.get("acknowledged");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { tenantId: user.tenantId };
    if (severity) where.severity = severity;
    if (acknowledged === "true") where.acknowledged = true;
    if (acknowledged === "false") where.acknowledged = false;

    const escalations = await prisma.escalation.findMany({
      where,
      include: {
        case: {
          select: {
            id: true, caseNumber: true, type: true, status: true,
            priority: true, assignedTo: { select: { name: true } },
          },
        },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(escalations);
  } catch (error) {
    return handleApiError(error);
  }
}
