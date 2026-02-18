import { NextRequest, NextResponse } from "next/server";
import { getDashboardMetrics } from "@/server/dashboard/metrics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const tenantId = searchParams.get("tenantId") ?? undefined;
    const userId = searchParams.get("userId") ?? undefined;

    const metrics = await getDashboardMetrics({
      tenantId,
      userIdOrEmail: userId,
    });

    return NextResponse.json(metrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/dashboard/metrics] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
