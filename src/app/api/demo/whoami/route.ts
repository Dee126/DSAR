import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await requireAuth();

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
      env: {
        DEV_AUTH_BYPASS: process.env.DEV_AUTH_BYPASS === "true",
        DEMO_TENANT_ID: process.env.DEMO_TENANT_ID ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
