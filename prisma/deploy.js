/**
 * deploy.js — Vercel build-time database setup (v2)
 *
 * Runs during `npm run build` on Vercel.
 * 1. Pushes the Prisma schema to the database (creates/updates tables)
 * 2. Ensures the default tenant and admin users exist
 *
 * Skips gracefully if DATABASE_URL is not set.
 */
const { execSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.warn("[deploy] WARNING: DATABASE_URL is not set. Skipping database setup.");
    console.warn("[deploy] Set DATABASE_URL in Vercel Environment Variables to enable DB setup.");
    return;
  }

  console.log("[deploy] DATABASE_URL is set. Starting database setup...");

  // Step 1: Push schema to database
  try {
    console.log("[deploy] Running prisma db push...");
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      stdio: "inherit",
      timeout: 60000,
    });
    console.log("[deploy] Schema pushed successfully.");
  } catch (err) {
    console.error("[deploy] ERROR: prisma db push failed:", err.message);
    console.error("[deploy] Continuing with build anyway...");
    return;
  }

  // Step 2: Ensure tenant and admin users exist
  const prisma = new PrismaClient();
  try {
    console.log("[deploy] Ensuring tenant and admin users...");

    const tenantId = "00000000-0000-4000-8000-000000000001";

    // Ensure tenant
    const tenant = await prisma.tenant.upsert({
      where: { id: tenantId },
      update: {},
      create: {
        id: tenantId,
        name: "Acme Corp",
        slaDefaultDays: 30,
      },
    });
    console.log("[deploy] Tenant ensured:", tenant.id, tenant.name);

    // Hash passwords
    const adminHash = await bcrypt.hash("admin123", 12);
    const danielHash = await bcrypt.hash("admin123", 12);

    // Ensure admin@acme-corp.com
    const admin = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: "admin@acme-corp.com" } },
      update: { passwordHash: adminHash, role: "TENANT_ADMIN" },
      create: {
        tenantId,
        email: "admin@acme-corp.com",
        name: "Admin",
        passwordHash: adminHash,
        role: "TENANT_ADMIN",
      },
    });
    console.log("[deploy] User ensured:", admin.email);

    // Ensure daniel.schormann@gmail.com
    const daniel = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: "daniel.schormann@gmail.com" } },
      update: { passwordHash: danielHash, role: "TENANT_ADMIN" },
      create: {
        tenantId,
        email: "daniel.schormann@gmail.com",
        name: "Daniel Schormann",
        passwordHash: danielHash,
        role: "TENANT_ADMIN",
      },
    });
    console.log("[deploy] User ensured:", daniel.email);

    // Verify
    const userCount = await prisma.user.count({ where: { tenantId } });
    console.log("[deploy] Total users in tenant:", userCount);
    console.log("[deploy] Database setup complete!");
  } catch (err) {
    console.error("[deploy] ERROR during user setup:", err.message);
    console.error("[deploy] Build will continue, but login may not work until DB is set up.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[deploy] Unexpected error:", e);
  // Don't exit with error code — let the build continue
});
