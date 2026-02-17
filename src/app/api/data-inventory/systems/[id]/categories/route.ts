import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError, ApiError } from "@/lib/errors";
import { createSystemDataCategorySchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "DATA_INVENTORY_MANAGE");

    const system = await prisma.system.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });
    if (!system) throw new ApiError(404, "System not found");

    const body = await request.json();
    const data = createSystemDataCategorySchema.parse(body);

    const category = await prisma.systemDataCategory.create({
      data: {
        tenantId: user.tenantId,
        systemId: params.id,
        ...data,
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "DATA_INVENTORY_CATEGORY_ADDED",
      entityType: "SystemDataCategory",
      entityId: category.id,
      ip,
      userAgent,
      details: { systemId: params.id, category: data.category },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "DATA_INVENTORY_MANAGE");

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    if (!categoryId) throw new ApiError(400, "categoryId query parameter required");

    const existing = await prisma.systemDataCategory.findFirst({
      where: { id: categoryId, systemId: params.id, tenantId: user.tenantId },
    });
    if (!existing) throw new ApiError(404, "Category link not found");

    await prisma.systemDataCategory.delete({ where: { id: categoryId } });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "DATA_INVENTORY_CATEGORY_REMOVED",
      entityType: "SystemDataCategory",
      entityId: categoryId,
      ip,
      userAgent,
      details: { systemId: params.id, category: existing.category },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
