import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { createVendorRequestTemplateSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/vendors/templates — List vendor request templates
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "VENDOR_TEMPLATE_VIEW");

    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get("vendorId");
    const language = searchParams.get("language");

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (vendorId) where.vendorId = vendorId;
    if (language) where.language = language;

    const templates = await prisma.vendorRequestTemplate.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(templates);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/vendors/templates — Create vendor request template
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "VENDOR_TEMPLATE_MANAGE");

    const body = await request.json();
    const data = createVendorRequestTemplateSchema.parse(body);

    const template = await prisma.vendorRequestTemplate.create({
      data: {
        tenantId: user.tenantId,
        vendorId: data.vendorId,
        name: data.name,
        language: data.language,
        dsarTypes: data.dsarTypes,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        placeholders: data.placeholders || [],
        isDefault: data.isDefault,
      },
      include: {
        vendor: { select: { id: true, name: true } },
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "vendor.template_created",
      entityType: "VendorRequestTemplate",
      entityId: template.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { name: data.name, language: data.language },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
