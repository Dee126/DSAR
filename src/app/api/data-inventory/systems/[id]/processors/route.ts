import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError, ApiError } from "@/lib/errors";
import { createSystemProcessorSchema } from "@/lib/validation";
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
    const data = createSystemProcessorSchema.parse(body);

    const processor = await prisma.systemProcessor.create({
      data: {
        tenantId: user.tenantId,
        systemId: params.id,
        ...data,
        contactEmail: data.contactEmail || null,
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "DATA_INVENTORY_PROCESSOR_ADDED",
      entityType: "SystemProcessor",
      entityId: processor.id,
      ip,
      userAgent,
      details: { systemId: params.id, vendorName: data.vendorName },
    });

    return NextResponse.json(processor, { status: 201 });
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
    const processorId = searchParams.get("processorId");
    if (!processorId) throw new ApiError(400, "processorId query parameter required");

    const existing = await prisma.systemProcessor.findFirst({
      where: { id: processorId, systemId: params.id, tenantId: user.tenantId },
    });
    if (!existing) throw new ApiError(404, "Processor not found");

    await prisma.systemProcessor.delete({ where: { id: processorId } });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "DATA_INVENTORY_PROCESSOR_REMOVED",
      entityType: "SystemProcessor",
      entityId: processorId,
      ip,
      userAgent,
      details: { systemId: params.id, vendorName: existing.vendorName },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
