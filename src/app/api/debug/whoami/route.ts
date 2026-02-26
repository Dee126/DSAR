import { NextResponse } from "next/server";
import { getAuthMode, getRequestUser } from "@/lib/auth-mode";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/whoami
 * Diagnostic: shows current auth mode, resolved tenant, and env flags.
 * Never 401s in AUTH_MODE=none.
 */
export async function GET() {
  try {
    const authMode = getAuthMode();
    const user = await getRequestUser();

    return NextResponse.json({
      authMode,
      tenantId: user.tenantId,
      userId: user.id,
      role: user.role,
      hasDemoTenantId: !!process.env.DEMO_TENANT_ID,
      env: {
        DEMO_TENANT_ID_present: !!process.env.DEMO_TENANT_ID,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
