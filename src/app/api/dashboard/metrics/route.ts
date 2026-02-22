import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getDashboardMetrics } from "@/server/dashboard/getDashboardMetrics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Resolve user identity: session → query param → header → anonymous
    const session = await getAuthSession();
    const params = request.nextUrl.searchParams;
    const tenantId =
      session?.user?.tenantId ??
      params.get("tenantId") ??
      request.headers.get("x-tenant-id") ??
      undefined;
    const userId =
      session?.user?.id ??
      params.get("userId") ??
      request.headers.get("x-user") ??
      undefined;

    const metrics = await getDashboardMetrics({ tenantId, userId });

    return NextResponse.json(metrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/dashboard/metrics] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
