import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { verifyAuditChainIntegrity } from "@/lib/assurance-audit-service";

export async function POST() {
  try {
    const user = await requireAuth();
    enforce(user.role, "ASSURANCE_AUDIT_VERIFY");

    const result = await verifyAuditChainIntegrity(user.tenantId);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
