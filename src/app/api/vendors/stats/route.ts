export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { getVendorDashboardStats } from "@/lib/vendor-service";

/**
 * GET /api/vendors/stats — Dashboard stats for vendor tracking
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "VENDOR_VIEW");

    const stats = await getVendorDashboardStats(user.tenantId);

    return NextResponse.json(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
