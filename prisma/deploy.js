/**
 * deploy.js — Vercel build-time database setup (v4)
 *
 * Runs during `npm run build` on Vercel.
 * 1. Pushes the Prisma schema to the database (creates/updates tables)
 * 2. Ensures the default tenant and admin users exist
 *
 * Retries on connection failures. Skips gracefully if DATABASE_URL is not set.
 */
const { execSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pushSchemaWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[deploy] Running prisma db push (attempt ${attempt}/${maxRetries})...`);
      execSync("npx prisma db push --skip-generate --accept-data-loss", {
        stdio: "inherit",
        timeout: 60000,
      });
      console.log("[deploy] Schema pushed successfully.");
      return true;
    } catch (err) {
      console.error(`[deploy] Attempt ${attempt} failed:`, err.message);
      if (attempt < maxRetries) {
        const waitMs = attempt * 5000;
        console.log(`[deploy] Waiting ${waitMs / 1000}s before retry...`);
        await sleep(waitMs);
      }
    }
  }
  return false;
}

async function main() {
  // Supabase-Vercel integration may set POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING
  // Map them to DATABASE_URL / DIRECT_URL if those aren't already set
  if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
    process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
    console.log("[deploy] Mapped POSTGRES_PRISMA_URL → DATABASE_URL");
  }
  if (!process.env.DIRECT_URL && process.env.POSTGRES_URL_NON_POOLING) {
    process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING;
    console.log("[deploy] Mapped POSTGRES_URL_NON_POOLING → DIRECT_URL");
  }

  if (!process.env.DATABASE_URL) {
    console.warn("[deploy] WARNING: DATABASE_URL is not set. Skipping database setup.");
    console.warn("[deploy] Set DATABASE_URL in Vercel Environment Variables to enable DB setup.");
    return;
  }

  // Log connection info (mask password)
  const dbUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;
  const maskedDb = dbUrl.replace(/:([^@]+)@/, ':***@');
  console.log("[deploy] DATABASE_URL:", maskedDb);
  console.log("[deploy] DIRECT_URL set:", !!directUrl);
  if (directUrl) {
    const maskedDirect = directUrl.replace(/:([^@]+)@/, ':***@');
    console.log("[deploy] DIRECT_URL:", maskedDirect);
  }
  console.log("[deploy] Starting database setup...");

  // Step 1: Push schema to database with retries
  const schemaOk = await pushSchemaWithRetry(3);
  if (!schemaOk) {
    console.error("[deploy] All prisma db push attempts failed. Continuing build without DB setup.");
    return;
  }

  // Step 2: Ensure tenant and admin users exist
  const prisma = new PrismaClient();
  try {
    console.log("[deploy] Ensuring tenant and admin users...");

    const tenantId = "00000000-0000-4000-8000-000000000001";

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

    const passwordHash = await bcrypt.hash("admin123", 12);

    const admin = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: "admin@acme-corp.com" } },
      update: { passwordHash, role: "TENANT_ADMIN" },
      create: {
        tenantId,
        email: "admin@acme-corp.com",
        name: "Admin",
        passwordHash,
        role: "TENANT_ADMIN",
      },
    });
    console.log("[deploy] User ensured:", admin.email);

    const daniel = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: "daniel.schormann@gmail.com" } },
      update: { passwordHash, role: "TENANT_ADMIN" },
      create: {
        tenantId,
        email: "daniel.schormann@gmail.com",
        name: "Daniel Schormann",
        passwordHash,
        role: "TENANT_ADMIN",
      },
    });
    console.log("[deploy] User ensured:", daniel.email);

    const userCount = await prisma.user.count({ where: { tenantId } });
    console.log("[deploy] Total users in tenant:", userCount);
    console.log("[deploy] Database setup complete!");
  } catch (err) {
    console.error("[deploy] ERROR during user setup:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[deploy] Unexpected error:", e);
});
