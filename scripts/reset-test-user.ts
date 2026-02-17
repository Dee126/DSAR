/**
 * scripts/reset-test-user.ts
 *
 * Deterministic reset/upsert of the test user for demo/dev environments.
 * Uses Prisma + bcryptjs (same stack as the app).
 *
 * Usage:  npm run reset:test-user
 *         npx tsx scripts/reset-test-user.ts
 *
 * Guards: Refuses to run when NODE_ENV=production or VERCEL_ENV=production.
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

// ── Production guard ─────────────────────────────────────────────────────────
const env = process.env.NODE_ENV ?? "";
const vercelEnv = process.env.VERCEL_ENV ?? "";

if (env === "production" || vercelEnv === "production") {
  console.error(
    "ERROR: reset-test-user is blocked in production (NODE_ENV=%s, VERCEL_ENV=%s).",
    env,
    vercelEnv,
  );
  process.exit(1);
}

// ── Config ───────────────────────────────────────────────────────────────────
const TEST_EMAIL = "daniel.schormann@gmail.com";
const TEST_PASSWORD = "admin123";
const TEST_NAME = "Daniel Schormann";
const TEST_ROLE = "TENANT_ADMIN" as const;
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const TENANT_NAME = "Acme Corp";
const BCRYPT_ROUNDS = 12;

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const prisma = new PrismaClient();

  try {
    console.log("--- reset-test-user ---");
    console.log(`Environment: NODE_ENV=${env}, VERCEL_ENV=${vercelEnv}`);

    // 1. Ensure tenant exists
    const tenant = await prisma.tenant.upsert({
      where: { id: TENANT_ID },
      update: {},
      create: {
        id: TENANT_ID,
        name: TENANT_NAME,
        slaDefaultDays: 30,
      },
    });
    console.log(`OK  Tenant "${tenant.name}" (${tenant.id})`);

    // 2. Hash password
    const passwordHash = await hash(TEST_PASSWORD, BCRYPT_ROUNDS);

    // 3. Upsert user — always resets password + role
    const user = await prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: TENANT_ID, email: TEST_EMAIL },
      },
      update: {
        passwordHash,
        name: TEST_NAME,
        role: TEST_ROLE,
      },
      create: {
        tenantId: TENANT_ID,
        email: TEST_EMAIL,
        name: TEST_NAME,
        passwordHash,
        role: TEST_ROLE,
      },
    });

    console.log(`OK  User "${user.name}" <${user.email}> (${user.role})`);
    console.log(`OK  Password set to: ${TEST_PASSWORD}`);
    console.log("--- done ---");
  } catch (error) {
    console.error("ERROR:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
