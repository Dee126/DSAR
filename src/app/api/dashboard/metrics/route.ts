import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getDashboardMetrics } from "@/server/dashboard/metrics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Resolve user identity: session → x-user header → anonymous
    const session = await getAuthSession();
    const tenantId =
      session?.user?.tenantId ??
      request.headers.get("x-tenant-id") ??
      undefined;
    const userId =
      session?.user?.id ?? request.headers.get("x-user") ?? undefined;

    const metrics = await getDashboardMetrics({ tenantId, userId });

    return NextResponse.json(metrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/dashboard/metrics] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
