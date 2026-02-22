import { NextRequest, NextResponse } from "next/server";
import { verifyToken, isTestAuth, COOKIE_NAME } from "@/lib/test-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user.
 * - Test mode: reads the HMAC cookie.
 * - Supabase mode: reads NextAuth session.
 */
export async function GET(request: NextRequest) {
  if (isTestAuth()) {
    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await verifyToken(token, secret);
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user });
  }

  // Supabase mode: use NextAuth
  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("@/lib/auth-options");
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user: session.user });
}
