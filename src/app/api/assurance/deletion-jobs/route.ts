import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { listDeletionJobs } from "@/lib/retention-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "ASSURANCE_DELETION_VIEW");

    const { searchParams } = new URL(request.url);

    const result = await listDeletionJobs(user.tenantId, {
      status: searchParams.get("status") || undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
