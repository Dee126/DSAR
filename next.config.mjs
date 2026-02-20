// ── Runtime env-var mapping for Supabase-Vercel integration ─────────
// The Supabase integration sets POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING
// but Prisma expects DATABASE_URL / DIRECT_URL.  Map them early so every
// serverless function cold-start has the right values.
if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}
if (!process.env.DIRECT_URL && process.env.POSTGRES_URL_NON_POOLING) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING;
}

// Auto-detect NEXTAUTH_URL on Vercel when not explicitly set.
// This must happen before the Next.js server starts so both API routes
// AND middleware see the correct value.
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
};

export default nextConfig;
