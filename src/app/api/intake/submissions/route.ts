import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { getSubmissions } from "@/lib/services/intake-service";
import { handleApiError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "read");

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;
    const channel = url.searchParams.get("channel") || undefined;
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    const result = await getSubmissions(user.tenantId, { status, channel, page, limit });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
