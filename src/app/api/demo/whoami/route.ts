import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
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
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      env: {
        NODE_ENV: process.env.NODE_ENV ?? null,
        DEMO_TENANT_ID: process.env.DEMO_TENANT_ID ?? null,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
