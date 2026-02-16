import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { queryAuditLogs } from "@/lib/assurance-audit-service";
import { auditLogFilterSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "ASSURANCE_VIEW");

    const { searchParams } = new URL(request.url);
    const filters = auditLogFilterSchema.parse({
      entityType: searchParams.get("entityType") || undefined,
      action: searchParams.get("action") || undefined,
      actorUserId: searchParams.get("actorUserId") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    });

    const result = await queryAuditLogs(user.tenantId, {
      ...filters,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
