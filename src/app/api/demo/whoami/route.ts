import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isTestAuth } from "@/lib/test-auth";
import { ApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/demo/whoami
 * Returns the authenticated user's identity (no secrets or tokens).
 */
export async function GET() {
  try {
    const user = await requireAuth();

    if (process.env.NODE_ENV === "development") {
      console.log(`[whoami] ${user.email} (${user.role})`);
    }

    return NextResponse.json({
      ok: true,
      mode: isTestAuth() ? "test-auth" : "nextauth",
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
      },
    });
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 401) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
