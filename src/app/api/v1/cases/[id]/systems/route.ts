import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/errors";
import { authenticateApiKey, enforceScope, logApiCall, checkRateLimit } from "@/lib/api-key-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiUser = await authenticateApiKey(request);
    enforceScope(apiUser, "cases:write");
    checkRateLimit(apiUser.apiKeyId);

    const { id } = await params;
    const body = await request.json();

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id, tenantId: apiUser.tenantId },
    });
    if (!dsarCase) throw new ApiError(404, "Case not found");

    const system = await prisma.system.findFirst({
      where: { id: body.systemId, tenantId: apiUser.tenantId },
    });
    if (!system) throw new ApiError(404, "System not found");

    const link = await prisma.caseSystemLink.create({
      data: {
        tenantId: apiUser.tenantId,
        caseId: id,
        systemId: body.systemId,
        collectionStatus: body.collectionStatus || "PENDING",
        notes: body.notes || null,
      },
    });

    await logApiCall(request, apiUser, "CaseSystemLink", link.id);
    return NextResponse.json({ data: link }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
