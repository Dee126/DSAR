import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { populateDemoEvidence } from "@/lib/demo-data/populate";
import type { PopulateOptions } from "@/lib/demo-data/populate";

/**
 * POST /api/demo-data/populate
 *
 * Populates existing DSAR cases with synthetic evidence data.
 * Requires TENANT_ADMIN or SUPER_ADMIN role.
 *
 * Body:
 *   intensity: "small" | "medium" | "large"
 *   includeSpecialCategory: boolean
 *   generateCopilotRuns: boolean
 *   generateExports: boolean
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "settings", "manage");

    const body = await request.json();

    const options: PopulateOptions = {
      intensity: body.intensity ?? "medium",
      includeSpecialCategory: body.includeSpecialCategory ?? false,
      generateCopilotRuns: body.generateCopilotRuns ?? true,
      generateExports: body.generateExports ?? false,
    };

    // Validate intensity
    if (!["small", "medium", "large"].includes(options.intensity)) {
      return NextResponse.json(
        { error: "Invalid intensity. Must be small, medium, or large." },
        { status: 400 },
      );
    }

    const result = await populateDemoEvidence(
      prisma,
      user.tenantId,
      user.id,
      options,
    );

    return NextResponse.json({
      success: true,
      message: `Demo evidence populated for ${result.casesProcessed} cases.`,
      result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
