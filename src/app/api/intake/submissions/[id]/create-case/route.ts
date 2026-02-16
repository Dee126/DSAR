import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { createCaseFromSubmission } from "@/lib/services/case-creation-service";
import { getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "create");

    const clientInfo = getClientInfo(request);

    const result = await createCaseFromSubmission(
      user.tenantId,
      params.id,
      user.id,
      clientInfo
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
