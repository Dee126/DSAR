import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { featureFlags, FEATURE_DEFINITIONS } from "@/lib/feature-flags";
import { logAudit, getClientInfo } from "@/lib/audit";

/**
 * GET /api/admin/feature-flags — List all feature flags for tenant
 * PUT /api/admin/feature-flags — Toggle a feature flag
 *
 * Requires TENANT_ADMIN permission.
 */

export async function GET() {
  try {
    const user = await requireAuth();
    enforce(user.role, "TENANT_MANAGE");

    const flags = await featureFlags.getAllForTenant(user.tenantId);

    return NextResponse.json({ data: flags });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "TENANT_MANAGE");

    const body = await request.json();
    const { key, enabled, config } = body;

    if (!key || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "key (string) and enabled (boolean) are required" } },
        { status: 400 },
      );
    }

    // Validate key exists in registry
    const validKey = FEATURE_DEFINITIONS.find((d) => d.key === key);
    if (!validKey) {
      return NextResponse.json(
        { error: { code: "INVALID_KEY", message: `Unknown feature key: ${key}` } },
        { status: 400 },
      );
    }

    await featureFlags.setFlag(user.tenantId, key, enabled, user.id, config);

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "FEATURE_FLAG_TOGGLE",
      entityType: "FeatureFlag",
      entityId: key,
      ip,
      userAgent,
      details: { key, enabled },
    });

    return NextResponse.json({ success: true, key, enabled });
  } catch (error) {
    return handleApiError(error);
  }
}
