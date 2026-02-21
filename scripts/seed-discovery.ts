/**
 * seed-discovery.ts — Runs the Discovery & Heatmap seed SQL against the database.
 *
 * Usage:
 *   npx tsx scripts/seed-discovery.ts            # runs migration + seed
 *   npx tsx scripts/seed-discovery.ts --seed-only # seed data only (migration already applied)
 *   npx tsx scripts/seed-discovery.ts --migrate-only # migration only (no seed data)
 *
 * Requires DATABASE_URL to be set (or POSTGRES_PRISMA_URL as fallback).
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve } from "path";

// Map Supabase-Vercel env vars
if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}

if (!process.env.DATABASE_URL) {
  console.error("[seed-discovery] ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function runSqlFile(label: string, relativePath: string) {
  const filePath = resolve(__dirname, "..", relativePath);
  console.log(`[seed-discovery] Reading ${label}: ${filePath}`);

  const sql = readFileSync(filePath, "utf-8");

  console.log(`[seed-discovery] Executing ${label}...`);
  await prisma.$executeRawUnsafe(sql);
  console.log(`[seed-discovery] ${label} completed.`);
}

async function main() {
  const args = process.argv.slice(2);
  const seedOnly = args.includes("--seed-only");
  const migrateOnly = args.includes("--migrate-only");

  try {
    if (!seedOnly) {
      await runSqlFile(
        "Discovery & Heatmap migration",
        "supabase/migrations/20260221_discovery_heatmap_mvp.sql"
      );
    }

    if (!migrateOnly) {
      await runSqlFile(
        "Discovery & Heatmap seed data",
        "supabase/discovery-seed.sql"
      );
    }

    console.log("[seed-discovery] All done!");
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error("[seed-discovery] ERROR:", message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
