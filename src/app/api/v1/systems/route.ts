import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";
import { authenticateApiKey, enforceScope, logApiCall, checkRateLimit } from "@/lib/api-key-auth";
import { v1PaginationSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const apiUser = await authenticateApiKey(request);
    enforceScope(apiUser, "systems:read");
    checkRateLimit(apiUser.apiKeyId);
    await logApiCall(request, apiUser, "System");

    const url = new URL(request.url);
    const { page, pageSize } = v1PaginationSchema.parse({
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("pageSize"),
    });

    const where = { tenantId: apiUser.tenantId };

    const [systems, total] = await Promise.all([
      prisma.system.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          owner: true,
          contactEmail: true,
          criticality: true,
          systemStatus: true,
          automationReadiness: true,
          connectorType: true,
          inScopeForDsar: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.system.count({ where }),
    ]);

    return NextResponse.json({
      data: systems,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
