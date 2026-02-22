export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { ApiError, handleApiError } from "@/lib/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/connectors/:id/runs — list runs for a connector
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "integrations", "read");
    const { id } = await params;

    const connector = await prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!connector) {
      throw new ApiError(404, "Connector not found");
    }

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10));
    const skip = (page - 1) * limit;

    const [runs, total] = await Promise.all([
      prisma.connectorRun.findMany({
        where: { connectorId: id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.connectorRun.count({ where: { connectorId: id } }),
    ]);

    return NextResponse.json({
      data: runs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
