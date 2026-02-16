import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/errors";
import { authenticateApiKey, enforceScope, logApiCall, checkRateLimit } from "@/lib/api-key-auth";
import { emitWebhookEvent } from "@/lib/webhook-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiUser = await authenticateApiKey(request);
    enforceScope(apiUser, "vendors:write");
    checkRateLimit(apiUser.apiKeyId);

    const { id } = await params;
    const body = await request.json();

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id, tenantId: apiUser.tenantId },
    });
    if (!dsarCase) throw new ApiError(404, "Case not found");

    const vendor = await prisma.vendor.findFirst({
      where: { id: body.vendorId, tenantId: apiUser.tenantId },
    });
    if (!vendor) throw new ApiError(404, "Vendor not found");

    const vendorRequest = await prisma.vendorRequest.create({
      data: {
        tenantId: apiUser.tenantId,
        caseId: id,
        vendorId: body.vendorId,
        systemId: body.systemId || null,
        subject: body.subject,
        bodyHtml: body.bodyHtml,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        createdByUserId: apiUser.createdBy,
      },
    });

    await logApiCall(request, apiUser, "VendorRequest", vendorRequest.id);

    await emitWebhookEvent(apiUser.tenantId, "vendor_request.created", "VendorRequest", vendorRequest.id, {
      caseId: id,
      vendorId: body.vendorId,
      subject: body.subject,
    });

    return NextResponse.json({ data: vendorRequest }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
