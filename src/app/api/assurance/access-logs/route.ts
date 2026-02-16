import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { queryAccessLogs } from "@/lib/access-log-service";
import { accessLogFilterSchema } from "@/lib/validation";
import type { AccessResourceType, AccessOutcome } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "ASSURANCE_VIEW");

    const { searchParams } = new URL(request.url);
    const filters = accessLogFilterSchema.parse({
      resourceType: searchParams.get("resourceType") || undefined,
      caseId: searchParams.get("caseId") || undefined,
      outcome: searchParams.get("outcome") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    });

    const result = await queryAccessLogs(user.tenantId, {
      ...filters,
      resourceType: filters.resourceType as AccessResourceType | undefined,
      outcome: filters.outcome as AccessOutcome | undefined,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
