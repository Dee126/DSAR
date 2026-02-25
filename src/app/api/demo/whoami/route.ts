import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isTestAuth } from "@/lib/test-auth";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/demo/whoami
 * Debug endpoint that returns the authenticated user's session info.
 * Requires authentication.
 */
export async function GET() {
  try {
    const user = await requireAuth();

    return NextResponse.json({
      ok: true,
      mode: isTestAuth() ? "test-auth" : "nextauth",
      demoTenantId: process.env.DEMO_TENANT_ID ?? null,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
