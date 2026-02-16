import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { runRetentionDeletionJob } from "@/lib/retention-service";

export async function POST() {
  try {
    const user = await requireAuth();
    enforce(user.role, "ASSURANCE_RETENTION_RUN");

    const result = await runRetentionDeletionJob(
      user.tenantId,
      "USER",
      user.id
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
