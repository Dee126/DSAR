export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";

/**
 * GET /api/response-stats — Dashboard stats for response documents
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "RESPONSE_VIEW");

    const [drafts, inReview, approved, sent] = await Promise.all([
      prisma.responseDocument.count({
        where: { tenantId: user.tenantId, status: "DRAFT" },
      }),
      prisma.responseDocument.count({
        where: { tenantId: user.tenantId, status: "IN_REVIEW" },
      }),
      prisma.responseDocument.count({
        where: { tenantId: user.tenantId, status: "APPROVED" },
      }),
      prisma.responseDocument.count({
        where: { tenantId: user.tenantId, status: "SENT" },
      }),
    ]);

    // Recent documents awaiting action
    const awaitingReview = await prisma.responseDocument.findMany({
      where: { tenantId: user.tenantId, status: "IN_REVIEW" },
      include: {
        case: { select: { caseNumber: true, dataSubject: { select: { fullName: true } } } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const awaitingSend = await prisma.responseDocument.findMany({
      where: { tenantId: user.tenantId, status: "APPROVED" },
      include: {
        case: { select: { caseNumber: true, dataSubject: { select: { fullName: true } } } },
        createdBy: { select: { name: true } },
      },
      orderBy: { approvedAt: "desc" },
      take: 5,
    });

    return NextResponse.json({
      counts: { drafts, inReview, approved, sent },
      awaitingReview,
      awaitingSend,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
