import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { has } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { getIncidentDashboardStats } from "@/lib/incident-service";
import {
  withRequestContext,
  structuredLog,
  safeJson,
  timeboxedQuery,
} from "@/lib/request-context";

/** Default query timeout for dashboard stats (ms) */
const STATS_QUERY_TIMEOUT = 10_000;

/** Empty stats returned when user lacks permission or no data exists. */
const EMPTY_STATS = {
  openIncidents: 0,
  contained: 0,
  resolved: 0,
  linkedDSARs: 0,
  overdueDSARs: 0,
  severityDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
};

/**
 * GET /api/incidents/stats — Dashboard stats for incidents
 *
 * Returns incident KPIs for the current tenant. If the user lacks
 * INCIDENT_VIEW permission, returns empty stats with a 200 + a
 * `permissionDenied` flag so the widget can show a "no access" state
 * instead of a hard error.
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    const user = await requireAuth();
    ctx = withRequestContext(request, user);

    // Soft permission check: return empty data instead of 403
    if (!has(user.role, "INCIDENT_VIEW")) {
      structuredLog("info", ctx, "incident_stats_no_permission", {
        role: user.role,
      });
      return NextResponse.json({
        ...EMPTY_STATS,
        permissionDenied: true,
        message: "You do not have permission to view incident data",
      });
    }

    const stats = await timeboxedQuery(
      () => getIncidentDashboardStats(user.tenantId),
      STATS_QUERY_TIMEOUT,
      ctx,
    );

    structuredLog("info", ctx, "incident_stats_ok", {
      status: 200,
      open: stats.openIncidents,
      linked: stats.linkedDSARs,
    });

    return NextResponse.json(safeJson(stats), {
      headers: { "x-correlation-id": ctx.correlationId },
    });
  } catch (error) {
    return handleApiError(error, ctx);
  }
}
