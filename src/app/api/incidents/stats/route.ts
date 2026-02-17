export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { getIncidentDashboardStats } from "@/lib/incident-service";

/**
 * GET /api/incidents/stats — Dashboard stats for incidents
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "INCIDENT_VIEW");

    const stats = await getIncidentDashboardStats(user.tenantId);

    return NextResponse.json(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
