import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { listApprovals } from "@/lib/sod-guard-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "ASSURANCE_VIEW");

    const { searchParams } = new URL(request.url);

    const result = await listApprovals(user.tenantId, {
      status: searchParams.get("status") || undefined,
      scopeType: searchParams.get("scopeType") || undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
