import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { withRequestContext, structuredLog } from "@/lib/request-context";

interface WidgetCheck {
  widget: string;
  status: "ok" | "fail" | "skip";
  latency_ms: number;
  error?: string;
  row_count?: number;
}

/**
 * Safely run a timed check. Returns the check result even on failure.
 */
async function timedCheck(
  name: string,
  fn: () => Promise<{ row_count?: number }>,
): Promise<WidgetCheck> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      widget: name,
      status: "ok",
      latency_ms: Date.now() - start,
      row_count: result.row_count,
    };
  } catch (err) {
    return {
      widget: name,
      status: "fail",
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown",
    };
  }
}

/**
 * GET /api/diag/dashboard — Dashboard diagnostics (admin only)
 *
 * Returns which dashboard widgets can load successfully and their query timings.
 * Restricted to TENANT_ADMIN / SUPER_ADMIN via EXEC_DASHBOARD_FULL.
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    const user = await requireAuth();
    ctx = withRequestContext(request, user);
    enforce(user.role, "EXEC_DASHBOARD_FULL");

    const tenantId = user.tenantId;

    const checks = await Promise.all([
      timedCheck("cases_overview", async () => {
        const count = await prisma.dSARCase.count({ where: { tenantId } });
        return { row_count: count };
      }),
      timedCheck("incident_stats", async () => {
        const count = await prisma.incident.count({ where: { tenantId } });
        return { row_count: count };
      }),
      timedCheck("incident_linked_dsars", async () => {
        const count = await prisma.dsarIncident.count({ where: { tenantId } });
        return { row_count: count };
      }),
      timedCheck("vendor_requests", async () => {
        const count = await prisma.vendorRequest.count({ where: { tenantId } });
        return { row_count: count };
      }),
      timedCheck("tasks", async () => {
        const count = await prisma.task.count({ where: { tenantId } });
        return { row_count: count };
      }),
      timedCheck("audit_logs", async () => {
        const count = await prisma.auditLog.count({ where: { tenantId } });
        return { row_count: count };
      }),
    ]);

    const ok = checks.filter((c) => c.status === "ok").length;
    const failed = checks.filter((c) => c.status === "fail").length;

    structuredLog("info", ctx, "dashboard_diag", {
      widgets_ok: ok,
      widgets_failed: failed,
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      tenant_id: tenantId,
      summary: { ok, failed, total: checks.length },
      widgets: checks,
    });
  } catch (error) {
    return handleApiError(error, ctx);
  }
}
