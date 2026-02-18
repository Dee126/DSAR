/**
 * ensure-admin.js
 *
 * Runs during `npm run build` on Vercel to guarantee the default tenant
 * and admin user exist in the production database.
 *
 * Uses CommonJS (not ESM) to avoid import compatibility issues on Vercel.
 * Uses upsert so it is safe to run on every deploy (idempotent).
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("[ensure-admin] Starting...");
  console.log("[ensure-admin] DATABASE_URL set:", !!process.env.DATABASE_URL);

  const tenantId = "00000000-0000-4000-8000-000000000001";

  // 1. Ensure tenant exists
  const tenant = await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: "Acme Corp",
      slaDefaultDays: 30,
    },
  });
  console.log("[ensure-admin] Tenant ensured:", tenant.id, tenant.name);

  // 2. Hash the password
  const passwordHash = await bcrypt.hash("admin123", 12);
  console.log("[ensure-admin] Password hashed, length:", passwordHash.length);

  // Verify hash works before inserting
  const verifyOk = await bcrypt.compare("admin123", passwordHash);
  console.log("[ensure-admin] Hash self-verify:", verifyOk);

  if (!verifyOk) {
    throw new Error("bcrypt hash self-verification failed! Something is wrong with bcryptjs.");
  }

  // 3. Ensure admin user (admin@acme-corp.com)
  const adminUser = await prisma.user.upsert({
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
  console.log("[ensure-admin] User ensured:", adminUser.email, "role:", adminUser.role);

  // 4. Ensure second admin user (daniel.schormann@gmail.com)
  const danielUser = await prisma.user.upsert({
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
  console.log("[ensure-admin] User ensured:", danielUser.email, "role:", danielUser.role);

  // 5. Verify: count all users in this tenant
  const userCount = await prisma.user.count({ where: { tenantId } });
  console.log("[ensure-admin] Total users in tenant:", userCount);

  // 6. Final verification: read the user back and check password
  const readBack = await prisma.user.findFirst({
    where: { email: "admin@acme-corp.com" },
  });
  if (readBack) {
    const finalCheck = await bcrypt.compare("admin123", readBack.passwordHash);
    console.log("[ensure-admin] Final DB password check for admin@acme-corp.com:", finalCheck);
  } else {
    console.error("[ensure-admin] ERROR: Could not read back admin@acme-corp.com from DB!");
  }

  console.log("[ensure-admin] Done. All users created/updated successfully.");
}

main()
  .catch((e) => {
    console.error("[ensure-admin] FATAL ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
