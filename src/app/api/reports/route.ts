export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "read");

    const tenantId = user.tenantId;

    // All cases (not soft-deleted)
    const allCases = await prisma.dSARCase.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        status: true,
        type: true,
        priority: true,
        receivedAt: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const now = new Date();
    const CLOSED_STATUSES = ["CLOSED", "REJECTED"];

    // Cases by status
    const casesByStatus: Record<string, number> = {};
    for (const c of allCases) {
      casesByStatus[c.status] = (casesByStatus[c.status] ?? 0) + 1;
    }

    // Cases by type
    const casesByType: Record<string, number> = {};
    for (const c of allCases) {
      casesByType[c.type] = (casesByType[c.type] ?? 0) + 1;
    }

    // Cases by priority
    const casesByPriority: Record<string, number> = {};
    for (const c of allCases) {
      casesByPriority[c.priority] = (casesByPriority[c.priority] ?? 0) + 1;
    }

    // Overdue cases
    const overdueCases = allCases.filter(
      (c) => !CLOSED_STATUSES.includes(c.status) && new Date(c.dueDate) < now
    );

    // Average closure time (for CLOSED cases)
    const closedCases = allCases.filter((c) => c.status === "CLOSED");
    let avgClosureDays = 0;
    if (closedCases.length > 0) {
      const totalDays = closedCases.reduce((sum, c) => {
        const diff =
          (new Date(c.updatedAt).getTime() - new Date(c.receivedAt).getTime()) /
          (1000 * 60 * 60 * 24);
        return sum + diff;
      }, 0);
      avgClosureDays = Math.round((totalDays / closedCases.length) * 10) / 10;
    }

    // Monthly case creation (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyCases: Record<string, number> = {};
    for (const c of allCases) {
      if (new Date(c.createdAt) >= sixMonthsAgo) {
        const monthKey = new Date(c.createdAt).toISOString().slice(0, 7); // YYYY-MM
        monthlyCases[monthKey] = (monthlyCases[monthKey] ?? 0) + 1;
      }
    }

    return NextResponse.json({
      totalCases: allCases.length,
      openCases: allCases.filter((c) => !CLOSED_STATUSES.includes(c.status)).length,
      closedCases: closedCases.length,
      rejectedCases: allCases.filter((c) => c.status === "REJECTED").length,
      overdueCases: overdueCases.length,
      avgClosureDays,
      casesByStatus,
      casesByType,
      casesByPriority,
      monthlyCases,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
