import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { markAsSpam } from "@/lib/services/intake-service";
import { getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "update");

    const clientInfo = getClientInfo(request);
    await markAsSpam(user.tenantId, params.id, user.id, clientInfo);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
