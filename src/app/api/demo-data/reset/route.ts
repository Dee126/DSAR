export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { resetDemoEvidence } from "@/lib/demo-data/reset";

/**
 * POST /api/demo-data/reset
 *
 * Removes all synthetic demo evidence from existing cases.
 * Cases themselves are preserved.
 * Requires TENANT_ADMIN or SUPER_ADMIN role.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "settings", "manage");

    const result = await resetDemoEvidence(
      prisma,
      user.tenantId,
      user.id,
    );

    return NextResponse.json({
      success: true,
      message: "Demo evidence has been reset. Cases are preserved.",
      result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
