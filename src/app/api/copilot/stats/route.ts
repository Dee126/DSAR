export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "read");

    const [totalRuns, completedRuns, specialCategoryRuns, recentRuns, totalFindings] =
      await Promise.all([
        prisma.copilotRun.count({
          where: { tenantId: user.tenantId },
        }),
        prisma.copilotRun.count({
          where: { tenantId: user.tenantId, status: "COMPLETED" },
        }),
        prisma.copilotRun.count({
          where: { tenantId: user.tenantId, containsSpecialCategory: true },
        }),
        prisma.copilotRun.findMany({
          where: { tenantId: user.tenantId },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            status: true,
            totalFindings: true,
            containsSpecialCategory: true,
            legalApprovalStatus: true,
            createdAt: true,
            completedAt: true,
            case: {
              select: {
                id: true,
                caseNumber: true,
                dataSubject: { select: { fullName: true } },
              },
            },
            createdBy: { select: { name: true } },
          },
        }),
        prisma.finding.count({
          where: { tenantId: user.tenantId },
        }),
      ]);

    return NextResponse.json({
      totalRuns,
      completedRuns,
      failedRuns: totalRuns - completedRuns,
      specialCategoryRuns,
      totalFindings,
      recentRuns,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
