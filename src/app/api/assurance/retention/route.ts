import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { listRetentionPolicies, upsertRetentionPolicy } from "@/lib/retention-service";
import { upsertRetentionPolicySchema } from "@/lib/validation";
import type { RetentionArtifactType, RetentionDeleteMode } from "@prisma/client";

export async function GET() {
  try {
    const user = await requireAuth();
    enforce(user.role, "ASSURANCE_RETENTION_VIEW");

    const policies = await listRetentionPolicies(user.tenantId);
    return NextResponse.json(policies);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "ASSURANCE_RETENTION_MANAGE");

    const body = await request.json();
    const data = upsertRetentionPolicySchema.parse(body);

    const policy = await upsertRetentionPolicy(
      user.tenantId,
      data.artifactType as RetentionArtifactType,
      {
        retentionDays: data.retentionDays,
        deleteMode: data.deleteMode as RetentionDeleteMode,
        legalHoldRespects: data.legalHoldRespects,
        enabled: data.enabled,
      }
    );

    return NextResponse.json(policy);
  } catch (error) {
    return handleApiError(error);
  }
}
