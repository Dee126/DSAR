import { NextResponse } from "next/server";

/**
 * GET /api/health/liveness — Liveness probe
 *
 * Returns 200 if the process is alive and responding.
 * No dependency checks — just confirms the server is up.
 * Suitable for Kubernetes livenessProbe.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "alive",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
