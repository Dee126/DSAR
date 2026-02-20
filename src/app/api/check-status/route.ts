import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";

export const dynamic = "force-dynamic";

/**
 * GET /api/check-status
 *
 * Public diagnostic endpoint to verify database connectivity,
 * tenant existence, and admin user setup.
 *
 * Does NOT expose passwords or sensitive data.
 * Can be removed once login is confirmed working.
 */
export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      DIRECT_URL: !!process.env.DIRECT_URL,
      POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
      POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "(not set)",
      VERCEL_URL: process.env.VERCEL_URL ?? "(not set)",
      NODE_ENV: process.env.NODE_ENV ?? "(not set)",
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    database: false,
    tenant: false,
    users: [] as string[],
    adminPasswordValid: false,
    danielPasswordValid: false,
  };

  try {
    // 1. Database connectivity
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;

    // 2. Tenant check
    const tenantId = "00000000-0000-4000-8000-000000000001";
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    checks.tenant = !!tenant;
    checks.tenantName = tenant?.name ?? null;

    // 3. List all users (email + role only)
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { email: true, role: true, lastLoginAt: true },
      orderBy: { email: "asc" },
    });
    checks.users = users.map((u) => ({
      email: u.email,
      role: u.role,
      lastLogin: u.lastLoginAt,
    }));
    checks.userCount = users.length;

    // 4. Verify admin@acme-corp.com password
    const adminUser = await prisma.user.findFirst({
      where: { email: "admin@acme-corp.com" },
    });
    if (adminUser) {
      checks.adminPasswordValid = await compare("admin123", adminUser.passwordHash);
      checks.adminPasswordHashLength = adminUser.passwordHash.length;
    } else {
      checks.adminPasswordValid = "USER_NOT_FOUND";
    }

    // 5. Verify daniel.schormann@gmail.com password
    const danielUser = await prisma.user.findFirst({
      where: { email: "daniel.schormann@gmail.com" },
    });
    if (danielUser) {
      checks.danielPasswordValid = await compare("admin123", danielUser.passwordHash);
    } else {
      checks.danielPasswordValid = "USER_NOT_FOUND";
    }

    return NextResponse.json(checks, { status: 200 });
  } catch (error) {
    checks.error = error instanceof Error ? error.message : String(error);
    return NextResponse.json(checks, { status: 500 });
  }
}
