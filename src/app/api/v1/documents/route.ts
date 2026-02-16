import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";
import { authenticateApiKey, enforceScope, logApiCall, checkRateLimit } from "@/lib/api-key-auth";
import { v1PaginationSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const apiUser = await authenticateApiKey(request);
    enforceScope(apiUser, "documents:read");
    checkRateLimit(apiUser.apiKeyId);
    await logApiCall(request, apiUser, "Document");

    const url = new URL(request.url);
    const { page, pageSize } = v1PaginationSchema.parse({
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("pageSize"),
    });
    const caseId = url.searchParams.get("caseId") || undefined;

    const where: any = { tenantId: apiUser.tenantId, deletedAt: null };
    if (caseId) where.caseId = caseId;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          caseId: true,
          filename: true,
          contentType: true,
          size: true,
          classification: true,
          uploadedAt: true,
          // No storageKey or hash — metadata only
        },
      }),
      prisma.document.count({ where }),
    ]);

    return NextResponse.json({
      data: documents,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
