import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { rebuildIndexForTenant } from "@/lib/search-index-service";
import { logAudit, getClientInfo } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "SEARCH_INDEX_REBUILD");

    const { indexed } = await rebuildIndexForTenant(user.tenantId);

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "SEARCH_INDEX_REBUILD",
      entityType: "SearchIndex",
      ip,
      userAgent,
      details: { indexed },
    });

    return NextResponse.json({ ok: true, indexed });
  } catch (error) {
    return handleApiError(error);
  }
}
