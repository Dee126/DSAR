import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

/**
 * GET /api/health/readiness — Readiness probe
 *
 * Checks all dependencies before accepting traffic:
 * - Database connectivity
 * - Encryption key presence (production)
 * - Storage configuration
 *
 * Returns 200 if ready, 503 if not.
 * Suitable for Kubernetes readinessProbe and load balancer health checks.
 */
export async function GET() {
  const checks: Record<string, { status: "ok" | "fail"; latency_ms?: number; error?: string }> = {};

  // 1. Database connectivity
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latency_ms: Date.now() - dbStart };
  } catch (err) {
    checks.database = {
      status: "fail",
      latency_ms: Date.now() - dbStart,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  // 2. Encryption key (required in production)
  if (env.isProduction) {
    checks.encryption = env.hasEncryptionKey
      ? { status: "ok" }
      : { status: "fail", error: "PRIVACYPILOT_SECRET not configured" };
  } else {
    checks.encryption = { status: "ok" };
  }

  // 3. Storage configuration
  if (env.STORAGE_TYPE === "s3") {
    checks.storage = env.S3_BUCKET && env.S3_REGION
      ? { status: "ok" }
      : { status: "fail", error: "S3 configuration incomplete (S3_BUCKET, S3_REGION required)" };
  } else {
    checks.storage = { status: "ok" };
  }

  // 4. Auth secret
  checks.auth = env.NEXTAUTH_SECRET
    ? { status: "ok" }
    : { status: "fail", error: "NEXTAUTH_SECRET not configured" };

  const allReady = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json(
    {
      status: allReady ? "ready" : "not_ready",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allReady ? 200 : 503 },
  );
}
