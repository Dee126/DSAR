import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";
import { authenticateApiKey, enforceScope, logApiCall, checkRateLimit } from "@/lib/api-key-auth";
import { v1PaginationSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const apiUser = await authenticateApiKey(request);
    enforceScope(apiUser, "incidents:read");
    checkRateLimit(apiUser.apiKeyId);
    await logApiCall(request, apiUser, "Incident");

    const url = new URL(request.url);
    const { page, pageSize } = v1PaginationSchema.parse({
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("pageSize"),
    });

    const where = { tenantId: apiUser.tenantId };

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          severity: true,
          status: true,
          detectedAt: true,
          containedAt: true,
          resolvedAt: true,
          regulatorNotificationRequired: true,
          crossBorder: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.incident.count({ where }),
    ]);

    return NextResponse.json({
      data: incidents,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
