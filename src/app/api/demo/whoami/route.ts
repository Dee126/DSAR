import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/demo/whoami
 * Dev-only verification endpoint that shows the effective tenant scoping.
 * Requires authentication. Returns 404 in production.
 */
export async function GET() {
  try {
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireAuth();

    const userTenantId = user.tenantId;
    const demoTenantEnv = process.env.DEMO_TENANT_ID ?? null;
    const effectiveTenantId =
      process.env.DEMO_TENANT_ID
        ? process.env.DEMO_TENANT_ID
        : user.tenantId;
    const overrideActive = effectiveTenantId !== userTenantId;

    return NextResponse.json({
      ok: true,
      userTenantId,
      demoTenantEnv,
      effectiveTenantId,
      overrideActive,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
