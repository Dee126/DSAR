import { PrismaClient } from "@prisma/client";

// ── Supabase-Vercel integration env-var mapping ─────────────────────
// The Supabase integration on Vercel may set POSTGRES_PRISMA_URL (pooled,
// port 6543 with pgbouncer) instead of DATABASE_URL.  Map it so Prisma
// can connect at runtime via the connection pooler.
// NOTE: DIRECT_URL (port 5432, non-pooled) is NOT mapped at runtime —
// it is only needed for migrations/schema pushes which should be run
// locally or in CI, never during Vercel build or at runtime.
if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
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
