export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError, ApiError } from "@/lib/errors";
import { createCaseSystemLinkSchema, updateCaseSystemLinkSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "CASES_READ");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });
    if (!dsarCase) throw new ApiError(404, "Case not found");

    const links = await prisma.caseSystemLink.findMany({
      where: { caseId: params.id, tenantId: user.tenantId },
      include: {
        system: {
          select: {
            id: true, name: true, description: true, criticality: true,
            automationReadiness: true, connectorType: true, systemStatus: true,
          },
        },
      },
      orderBy: [{ discoveryScore: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(links);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "CASES_UPDATE");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });
    if (!dsarCase) throw new ApiError(404, "Case not found");

    const body = await request.json();
    const data = createCaseSystemLinkSchema.parse(body);

    // Verify system exists and belongs to tenant
    const system = await prisma.system.findFirst({
      where: { id: data.systemId, tenantId: user.tenantId },
    });
    if (!system) throw new ApiError(404, "System not found");

    const link = await prisma.caseSystemLink.create({
      data: {
        tenantId: user.tenantId,
        caseId: params.id,
        systemId: data.systemId,
        collectionStatus: data.collectionStatus ?? "PENDING",
        suggestedByDiscovery: data.suggestedByDiscovery ?? false,
        discoveryScore: data.discoveryScore,
        discoveryReason: data.discoveryReason,
        notes: data.notes,
      },
      include: {
        system: {
          select: { id: true, name: true, description: true, criticality: true, automationReadiness: true },
        },
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "CASE_SYSTEM_LINKED",
      entityType: "CaseSystemLink",
      entityId: link.id,
      ip,
      userAgent,
      details: { caseId: params.id, systemId: data.systemId, systemName: system.name },
    });

    return NextResponse.json(link, { status: 201 });
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
    enforce(user.role, "CASES_UPDATE");

    const body = await request.json();
    const { linkId, ...updateData } = body;
    if (!linkId) throw new ApiError(400, "linkId is required");

    const data = updateCaseSystemLinkSchema.parse(updateData);

    const existing = await prisma.caseSystemLink.findFirst({
      where: { id: linkId, caseId: params.id, tenantId: user.tenantId },
    });
    if (!existing) throw new ApiError(404, "Link not found");

    const link = await prisma.caseSystemLink.update({
      where: { id: linkId },
      data,
      include: {
        system: { select: { id: true, name: true } },
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "CASE_SYSTEM_LINK_UPDATED",
      entityType: "CaseSystemLink",
      entityId: linkId,
      ip,
      userAgent,
      details: { caseId: params.id, changes: Object.keys(data) },
    });

    return NextResponse.json(link);
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
    enforce(user.role, "CASES_UPDATE");

    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get("linkId");
    if (!linkId) throw new ApiError(400, "linkId query parameter required");

    const existing = await prisma.caseSystemLink.findFirst({
      where: { id: linkId, caseId: params.id, tenantId: user.tenantId },
    });
    if (!existing) throw new ApiError(404, "Link not found");

    await prisma.caseSystemLink.delete({ where: { id: linkId } });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "CASE_SYSTEM_UNLINKED",
      entityType: "CaseSystemLink",
      entityId: linkId,
      ip,
      userAgent,
      details: { caseId: params.id, systemId: existing.systemId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
