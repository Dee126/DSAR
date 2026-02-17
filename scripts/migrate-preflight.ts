#!/usr/bin/env npx tsx
/**
 * Migration Preflight Check
 *
 * Run before applying migrations to verify:
 * 1. Database is reachable
 * 2. Pending migrations exist
 * 3. No destructive operations detected (best-effort)
 *
 * Usage:
 *   npm run migrate:preflight
 *   npx tsx scripts/migrate-preflight.ts
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const DESTRUCTIVE_PATTERNS = [
  /DROP\s+TABLE/i,
  /DROP\s+COLUMN/i,
  /DROP\s+INDEX/i,
  /ALTER\s+TABLE\s+.*\s+DROP/i,
  /TRUNCATE/i,
  /DELETE\s+FROM/i,
];

interface PreflightResult {
  checks: Array<{ name: string; status: "pass" | "warn" | "fail"; detail: string }>;
  canProceed: boolean;
}

function checkDatabaseConnection(): { status: "pass" | "fail"; detail: string } {
  try {
    execSync("npx prisma db execute --stdin <<< 'SELECT 1'", {
      stdio: "pipe",
      timeout: 10000,
    });
    return { status: "pass", detail: "Database is reachable" };
  } catch {
    return { status: "fail", detail: "Cannot connect to database. Check DATABASE_URL." };
  }
}

function checkPendingMigrations(): { status: "pass" | "warn"; detail: string } {
  try {
    const output = execSync("npx prisma migrate status 2>&1", {
      stdio: "pipe",
      timeout: 30000,
    }).toString();

    if (output.includes("Database schema is up to date")) {
      return { status: "pass", detail: "No pending migrations" };
    }

    const pendingMatch = output.match(/(\d+)\s+migration/);
    return {
      status: "warn",
      detail: pendingMatch
        ? `${pendingMatch[1]} pending migration(s) detected`
        : "Pending migrations detected",
    };
  } catch {
    return { status: "warn", detail: "Could not determine migration status" };
  }
}

function checkDestructiveOperations(): { status: "pass" | "warn"; detail: string; warnings: string[] } {
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  const warnings: string[] = [];

  if (!fs.existsSync(migrationsDir)) {
    return { status: "pass", detail: "No migrations directory found", warnings };
  }

  const dirs = fs.readdirSync(migrationsDir).filter((d) => {
    const fullPath = path.join(migrationsDir, d);
    return fs.statSync(fullPath).isDirectory();
  });

  for (const dir of dirs) {
    const sqlFile = path.join(migrationsDir, dir, "migration.sql");
    if (!fs.existsSync(sqlFile)) continue;

    const content = fs.readFileSync(sqlFile, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("--")) continue; // Skip comments

      for (const pattern of DESTRUCTIVE_PATTERNS) {
        if (pattern.test(line)) {
          warnings.push(`${dir}/migration.sql:${i + 1}: ${line.slice(0, 100)}`);
          break;
        }
      }
    }
  }

  if (warnings.length > 0) {
    return {
      status: "warn",
      detail: `${warnings.length} potentially destructive operation(s) found`,
      warnings,
    };
  }

  return { status: "pass", detail: "No destructive operations detected", warnings };
}

function checkEnvVars(): { status: "pass" | "fail"; detail: string } {
  if (!process.env.DATABASE_URL) {
    return { status: "fail", detail: "DATABASE_URL is not set" };
  }

  // Check if it looks like a production database
  const url = process.env.DATABASE_URL;
  const isProd = url.includes("prod") || url.includes("production") || url.includes("rds.amazonaws.com");
  if (isProd) {
    return { status: "pass", detail: "DATABASE_URL set (production database detected — proceed with caution)" };
  }

  return { status: "pass", detail: "DATABASE_URL is set" };
}

// ── Main ─────────────────────────────────────────────────────────────

function run(): void {
  console.log("═══ Migration Preflight Check ═══\n");

  const result: PreflightResult = { checks: [], canProceed: true };

  // Check 1: Environment
  console.log("1. Checking environment variables...");
  const envCheck = checkEnvVars();
  result.checks.push({ name: "Environment", ...envCheck });
  if (envCheck.status === "fail") result.canProceed = false;
  console.log(`   ${envCheck.status === "pass" ? "✓" : "✗"} ${envCheck.detail}`);

  // Check 2: Database connection
  console.log("2. Checking database connection...");
  const dbCheck = checkDatabaseConnection();
  result.checks.push({ name: "Database", ...dbCheck });
  if (dbCheck.status === "fail") result.canProceed = false;
  console.log(`   ${dbCheck.status === "pass" ? "✓" : "✗"} ${dbCheck.detail}`);

  // Check 3: Pending migrations
  console.log("3. Checking migration status...");
  const migrationCheck = checkPendingMigrations();
  result.checks.push({ name: "Migrations", ...migrationCheck });
  console.log(`   ${migrationCheck.status === "pass" ? "✓" : "⚠"} ${migrationCheck.detail}`);

  // Check 4: Destructive operations
  console.log("4. Scanning for destructive operations...");
  const destructiveCheck = checkDestructiveOperations();
  result.checks.push({ name: "Destructive Ops", ...destructiveCheck });
  console.log(`   ${destructiveCheck.status === "pass" ? "✓" : "⚠"} ${destructiveCheck.detail}`);
  if (destructiveCheck.warnings.length > 0) {
    for (const w of destructiveCheck.warnings) {
      console.log(`      ⚠ ${w}`);
    }
  }

  // Summary
  console.log("\n═══ Summary ═══");
  if (result.canProceed) {
    console.log("✓ All critical checks passed. Safe to proceed with migration.");
  } else {
    console.log("✗ Critical checks failed. Fix issues before migrating.");
    process.exit(1);
  }

  if (result.checks.some((c) => c.status === "warn")) {
    console.log("⚠ Warnings detected. Review before proceeding.");
  }
}

run();
