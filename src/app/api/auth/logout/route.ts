import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/test-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 *
 * Clears the test-auth cookie.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
