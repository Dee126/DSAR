export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { updateVendorRequestTemplateSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/vendors/templates/[id] — Get template detail
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "VENDOR_TEMPLATE_VIEW");

    const template = await prisma.vendorRequestTemplate.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      include: { vendor: { select: { id: true, name: true } } },
    });
    if (!template) throw new ApiError(404, "Template not found");

    return NextResponse.json(template);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/vendors/templates/[id] — Update template
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "VENDOR_TEMPLATE_MANAGE");

    const body = await request.json();
    const data = updateVendorRequestTemplateSchema.parse(body);

    const template = await prisma.vendorRequestTemplate.update({
      where: { id: params.id },
      data: {
        ...data,
        dsarTypes: data.dsarTypes as any,
      },
      include: { vendor: { select: { id: true, name: true } } },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "vendor.template_updated",
      entityType: "VendorRequestTemplate",
      entityId: params.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: data,
    });

    return NextResponse.json(template);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/vendors/templates/[id] — Delete template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "VENDOR_TEMPLATE_MANAGE");

    await prisma.vendorRequestTemplate.deleteMany({
      where: { id: params.id, tenantId: user.tenantId },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "vendor.template_deleted",
      entityType: "VendorRequestTemplate",
      entityId: params.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
