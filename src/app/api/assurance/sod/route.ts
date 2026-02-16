import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { getSodPolicy, updateSodPolicy } from "@/lib/sod-guard-service";
import { updateSodPolicySchema } from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireAuth();
    enforce(user.role, "ASSURANCE_VIEW");

    const policy = await getSodPolicy(user.tenantId);
    return NextResponse.json(policy);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "ASSURANCE_SOD_MANAGE");

    const body = await request.json();
    const data = updateSodPolicySchema.parse(body);

    const policy = await updateSodPolicy(user.tenantId, {
      enabled: data.enabled,
      rulesJson: data.rules,
      exemptions: data.exemptions as Record<string, unknown> | undefined,
    });

    return NextResponse.json(policy);
  } catch (error) {
    return handleApiError(error);
  }
}
