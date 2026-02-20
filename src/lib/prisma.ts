import { PrismaClient } from "@prisma/client";

// ── Supabase-Vercel integration env-var mapping ─────────────────────
// The Supabase integration on Vercel sets POSTGRES_PRISMA_URL (pooled,
// with ?pgbouncer=true) and POSTGRES_URL_NON_POOLING (direct), but NOT
// DATABASE_URL / DIRECT_URL which Prisma expects.  prisma/deploy.js
// does this mapping at build time; we also need it at runtime so the
// serverless functions can reach the database.
if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}
if (!process.env.DIRECT_URL && process.env.POSTGRES_URL_NON_POOLING) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
