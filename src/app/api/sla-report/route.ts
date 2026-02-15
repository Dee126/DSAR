import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/sla-report
 * Returns SLA compliance data for the tenant (JSON or CSV).
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    enforce(user.role, "GOVERNANCE_VIEW");

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";

    const cases = await prisma.dSARCase.findMany({
      where: { tenantId: user.tenantId },
      include: {
        deadline: true,
        assignedTo: { select: { name: true } },
      },
      orderBy: { receivedAt: "desc" },
    });

    const rows = cases.map((c) => ({
      case_id: c.caseNumber,
      subject_type: c.requesterType ?? "Data Subject",
      request_type: c.type,
      status: c.status,
      received_at: c.receivedAt.toISOString().split("T")[0],
      effective_due_at: c.deadline?.effectiveDueAt?.toISOString().split("T")[0] ?? c.dueDate.toISOString().split("T")[0],
      closed_at: c.status === "CLOSED" || c.status === "REJECTED" ? c.updatedAt.toISOString().split("T")[0] : "",
      extension_used: c.deadline?.extensionDays ? "Yes" : "No",
      extension_days: c.deadline?.extensionDays ?? 0,
      paused_duration_days: c.deadline?.totalPausedDays ?? 0,
      current_risk: c.deadline?.currentRisk ?? "N/A",
      days_remaining: c.deadline?.daysRemaining ?? "N/A",
      assigned_to: c.assignedTo?.name ?? "Unassigned",
    }));

    if (format === "csv") {
      if (rows.length === 0) {
        return new NextResponse("No data", { status: 200, headers: { "Content-Type": "text/csv" } });
      }
      const headers = Object.keys(rows[0]);
      const csvLines = [
        headers.join(","),
        ...rows.map((r) => headers.map((h) => `"${String(r[h as keyof typeof r] ?? "").replace(/"/g, '""')}"`).join(",")),
      ];
      return new NextResponse(csvLines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="sla-report-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Dashboard summary stats
    const now = new Date();
    const openCases = cases.filter((c) => c.status !== "CLOSED" && c.status !== "REJECTED");
    const totalOpen = openCases.length;
    const overdue = openCases.filter((c) => {
      const due = c.deadline?.effectiveDueAt ?? c.dueDate;
      return due < now;
    }).length;
    const dueIn7 = openCases.filter((c) => {
      const due = c.deadline?.effectiveDueAt ?? c.dueDate;
      const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    }).length;
    const dueIn14 = openCases.filter((c) => {
      const due = c.deadline?.effectiveDueAt ?? c.dueDate;
      const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 14;
    }).length;
    const dueIn30 = openCases.filter((c) => {
      const due = c.deadline?.effectiveDueAt ?? c.dueDate;
      const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 30;
    }).length;

    const closedCases = cases.filter((c) => c.status === "CLOSED");
    const avgDaysToClose = closedCases.length > 0
      ? Math.round(closedCases.reduce((sum, c) => {
          const diff = (c.updatedAt.getTime() - c.receivedAt.getTime()) / (1000 * 60 * 60 * 24);
          return sum + diff;
        }, 0) / closedCases.length)
      : 0;

    const withExtension = cases.filter((c) => c.deadline?.extensionDays && c.deadline.extensionDays > 0).length;
    const extensionRate = cases.length > 0 ? Math.round((withExtension / cases.length) * 100) : 0;

    const riskDistribution = {
      green: openCases.filter((c) => c.deadline?.currentRisk === "GREEN" || !c.deadline).length,
      yellow: openCases.filter((c) => c.deadline?.currentRisk === "YELLOW").length,
      red: openCases.filter((c) => c.deadline?.currentRisk === "RED").length,
    };

    return NextResponse.json({
      summary: {
        totalOpen,
        overdue,
        dueIn7,
        dueIn14,
        dueIn30,
        avgDaysToClose,
        extensionRate,
        riskDistribution,
      },
      cases: rows,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
