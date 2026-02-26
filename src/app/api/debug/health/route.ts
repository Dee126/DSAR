import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/health
 * Lightweight liveness check — no auth, no DB.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}
