export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError, ApiError } from "@/lib/errors";
import { updateInventorySystemSchema } from "@/lib/validation";
import { calculateConfidenceScore, buildConfidenceInput } from "@/lib/confidence";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "DATA_INVENTORY_VIEW");

    const system = await prisma.system.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      include: {
        ownerUser: { select: { id: true, name: true, email: true } },
        dataCategories: true,
        processors: true,
        discoveryRules: { where: { active: true } },
        caseSystemLinks: {
          include: {
            case: { select: { id: true, caseNumber: true, type: true, status: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        _count: { select: { discoveryRules: true, caseSystemLinks: true, tasks: true } },
      },
    });

    if (!system) throw new ApiError(404, "System not found");

    const confidenceScore = calculateConfidenceScore(buildConfidenceInput({
      ownerUserId: system.ownerUserId,
      dataResidencyPrimary: system.dataResidencyPrimary,
      processingRegions: system.processingRegions,
      automationReadiness: system.automationReadiness,
      connectorType: system.connectorType,
      dataCategories: system.dataCategories,
    }));

    return NextResponse.json({ ...system, confidenceScore });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "DATA_INVENTORY_MANAGE");

    const existing = await prisma.system.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });
    if (!existing) throw new ApiError(404, "System not found");

    const body = await request.json();
    const data = updateInventorySystemSchema.parse(body);

    const system = await prisma.system.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.ownerUserId !== undefined && { ownerUserId: data.ownerUserId }),
        ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail || null }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.criticality !== undefined && { criticality: data.criticality }),
        ...(data.systemStatus !== undefined && { systemStatus: data.systemStatus }),
        ...(data.containsSpecialCategories !== undefined && { containsSpecialCategories: data.containsSpecialCategories }),
        ...(data.inScopeForDsar !== undefined && { inScopeForDsar: data.inScopeForDsar }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.automationReadiness !== undefined && { automationReadiness: data.automationReadiness }),
        ...(data.connectorType !== undefined && { connectorType: data.connectorType }),
        ...(data.exportFormats !== undefined && { exportFormats: data.exportFormats }),
        ...(data.estimatedCollectionTimeMinutes !== undefined && { estimatedCollectionTimeMinutes: data.estimatedCollectionTimeMinutes }),
        ...(data.dataResidencyPrimary !== undefined && { dataResidencyPrimary: data.dataResidencyPrimary }),
        ...(data.processingRegions !== undefined && { processingRegions: data.processingRegions }),
        ...(data.thirdCountryTransfers !== undefined && { thirdCountryTransfers: data.thirdCountryTransfers }),
        ...(data.thirdCountryTransferDetails !== undefined && { thirdCountryTransferDetails: data.thirdCountryTransferDetails }),
        ...(data.identifierTypes !== undefined && { identifierTypes: data.identifierTypes }),
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "DATA_INVENTORY_SYSTEM_UPDATED",
      entityType: "System",
      entityId: system.id,
      ip,
      userAgent,
      details: { changes: Object.keys(data) },
    });

    return NextResponse.json(system);
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

    const existing = await prisma.system.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });
    if (!existing) throw new ApiError(404, "System not found");

    await prisma.system.delete({ where: { id: params.id } });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "DATA_INVENTORY_SYSTEM_DELETED",
      entityType: "System",
      entityId: params.id,
      ip,
      userAgent,
      details: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
