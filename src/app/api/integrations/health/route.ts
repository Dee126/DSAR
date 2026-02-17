export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "read");

    const integrations = await prisma.integration.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        name: true,
        provider: true,
        status: true,
        healthStatus: true,
        lastSuccessAt: true,
        lastHealthCheckAt: true,
        lastError: true,
      },
    });

    const total = integrations.length;
    const enabled = integrations.filter((i) => i.status === "ENABLED");
    const connected = enabled.length;
    const issues = enabled.filter(
      (i) => i.healthStatus === "FAILED" || i.healthStatus === "DEGRADED"
    ).length;

    const lastSuccessAt = integrations
      .map((i) => i.lastSuccessAt)
      .filter(Boolean)
      .sort((a, b) => (b?.getTime() ?? 0) - (a?.getTime() ?? 0))[0] ?? null;

    return NextResponse.json({
      total,
      connected,
      issues,
      lastSuccessAt,
      integrations: integrations.map((i) => ({
        id: i.id,
        name: i.name,
        provider: i.provider,
        status: i.status,
        healthStatus: i.healthStatus,
        lastSuccessAt: i.lastSuccessAt,
        lastError: i.lastError,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
