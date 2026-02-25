import { NextRequest, NextResponse } from "next/server";
import { createToken, getTestUser, isTestAuth, COOKIE_NAME, type AuthUser } from "@/lib/test-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 *
 * Test-mode login: validates email/password against env vars,
 * then looks up the real user in the DB to get the correct tenantId.
 * Sets a signed httpOnly cookie.
 */
export async function POST(request: NextRequest) {
  if (!isTestAuth()) {
    return NextResponse.json(
      { error: "Test auth is not enabled. Set NEXT_PUBLIC_AUTH_MODE=test" },
      { status: 400 },
    );
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "AUTH_SECRET env var is not set" },
      { status: 500 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const expectedEmail = process.env.TEST_USER_EMAIL;
  const expectedPassword = process.env.TEST_USER_PASSWORD;

  if (!expectedEmail || !expectedPassword) {
    return NextResponse.json(
      { error: "TEST_USER_EMAIL and TEST_USER_PASSWORD env vars must be set" },
      { status: 500 },
    );
  }

  if (email.trim().toLowerCase() !== expectedEmail.trim().toLowerCase() || password !== expectedPassword) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // Look up the real user from the DB to get the correct tenantId
  let user: AuthUser;
  const dbUser = await prisma.user.findFirst({
    where: { email: { equals: email.trim().toLowerCase(), mode: "insensitive" } },
    select: { id: true, email: true, name: true, role: true, tenantId: true },
  });

  if (dbUser) {
    user = {
      id: dbUser.id,
      tenantId: dbUser.tenantId,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
    };
  } else {
    // Fallback to env-based test user (e.g. DB not seeded yet)
    const fallback = getTestUser();
    if (!fallback.tenantId && process.env.NODE_ENV === "development" && process.env.DEMO_TENANT_ID) {
      fallback.tenantId = process.env.DEMO_TENANT_ID;
    }
    user = fallback;
    console.warn(
      "[test-auth/login] User not found in DB, falling back to env-based test user:",
      { email, tenantId: user.tenantId },
    );
  }

  const token = await createToken(user, secret);

  const res = NextResponse.json({ ok: true, user });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60, // 8 hours
  });

  return res;
}
