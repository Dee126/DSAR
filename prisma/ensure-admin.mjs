/**
 * ensure-admin.mjs
 *
 * Runs during `npm run build` on Vercel to guarantee the default tenant
 * and admin user exist in the production database.
 * Uses upsert so it is safe to run on every deploy (idempotent).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const tenantId = "00000000-0000-4000-8000-000000000001";

  // 1. Ensure tenant exists
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: "Acme Corp",
      slaDefaultDays: 30,
    },
  });

  // 2. Ensure admin user exists (always reset password on deploy)
  const passwordHash = await bcrypt.hash("admin123", 12);

  await prisma.user.upsert({
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

  console.log("✓ Default tenant and admin user ensured.");
}

main()
  .catch((e) => {
    console.error("ensure-admin failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
