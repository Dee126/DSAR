import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import {
  canViewGovernanceReport,
  buildReportSummary,
} from "@/lib/copilot/governance-report";
import { getActivityLogEntries } from "@/lib/copilot/activity-log-store";

/**
 * GET /api/governance/activity-log
 * Returns paginated governance activity log entries.
 *
 * Query params:
 *   - page (default 1)
 *   - pageSize (default 20, max 100)
 *   - status (filter: COMPLETED, FAILED, BLOCKED)
 *   - userId (filter)
 *   - containsSpecialCategory (filter: true/false)
 *   - exportCreated (filter: true/false)
 *   - fromDate, toDate (ISO strings)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // DPO/Admin see all; Case Managers see limited view
    const canViewFull = canViewGovernanceReport(user.role);
    if (!canViewFull) {
      checkPermission(user.role, "copilot", "read");
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
    const statusFilter = searchParams.get("status");
    const userIdFilter = searchParams.get("userId");
    const specialCatFilter = searchParams.get("containsSpecialCategory");
    const exportFilter = searchParams.get("exportCreated");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    let entries = getActivityLogEntries();

    // Apply filters
    if (statusFilter) {
      entries = entries.filter((e) => e.status === statusFilter);
    }
    if (userIdFilter) {
      entries = entries.filter((e) => e.actorUserId === userIdFilter);
    }
    if (specialCatFilter === "true") {
      entries = entries.filter((e) => e.art9Suspected);
    } else if (specialCatFilter === "false") {
      entries = entries.filter((e) => !e.art9Suspected);
    }
    if (exportFilter === "true") {
      entries = entries.filter((e) => e.exportGenerated);
    } else if (exportFilter === "false") {
      entries = entries.filter((e) => !e.exportGenerated);
    }
    if (fromDate) {
      entries = entries.filter((e) => e.startedAt && e.startedAt >= fromDate);
    }
    if (toDate) {
      entries = entries.filter((e) => e.startedAt && e.startedAt <= toDate);
    }

    // If not DPO/Admin, truncate justification and hide some fields
    if (!canViewFull) {
      entries = entries.map((e) => ({
        ...e,
        justification: e.justification.length > 50
          ? e.justification.slice(0, 50) + "..."
          : e.justification,
        exportApprovedBy: null,
      }));
    }

    // Paginate
    const total = entries.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const pageEntries = entries.slice(start, start + pageSize);

    // Build summary
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const summary = buildReportSummary(entries, thirtyDaysAgo, now);

    return NextResponse.json({
      entries: pageEntries,
      summary,
      pagination: { page, pageSize, total, totalPages },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
