import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/health — Health check endpoint
 *
 * Checks database connectivity. Returns 200 if healthy, 503 if degraded.
 * No authentication required — suitable for load balancer probes.
 */
export async function GET() {
  const checks: Record<string, { status: "ok" | "fail"; latency_ms: number; error?: string }> = {};

  // Database connectivity check
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

  const allHealthy = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allHealthy ? 200 : 503 },
  );
}
