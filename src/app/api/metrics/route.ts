import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { metrics } from "@/lib/metrics";

/**
 * GET /api/metrics — Application metrics (JSON)
 *
 * Returns in-memory metrics: request counts, error counts,
 * latency, and job run summaries.
 *
 * Requires SUPER_ADMIN or TENANT_ADMIN role.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    enforce(user.role, "ASSURANCE_VIEW");

    const snapshot = metrics.getSnapshot();

    return NextResponse.json(snapshot);
  } catch (error) {
    return handleApiError(error);
  }
}
