import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { decideApproval } from "@/lib/sod-guard-service";
import { decideApprovalSchema } from "@/lib/validation";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "ASSURANCE_APPROVAL_DECIDE");

    const { id } = await params;
    const body = await request.json();
    const data = decideApprovalSchema.parse(body);

    const result = await decideApproval(
      user.tenantId,
      id,
      user.id,
      data.decision,
      data.reason
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
