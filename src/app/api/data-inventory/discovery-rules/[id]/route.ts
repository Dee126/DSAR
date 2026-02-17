import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError, ApiError } from "@/lib/errors";
import { updateDiscoveryRuleSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "DISCOVERY_RULES_MANAGE");

    const existing = await prisma.discoveryRule.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });
    if (!existing) throw new ApiError(404, "Discovery rule not found");

    const body = await request.json();
    const data = updateDiscoveryRuleSchema.parse(body);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.dsarTypes !== undefined) updateData.dsarTypes = data.dsarTypes;
    if (data.dataSubjectTypes !== undefined) updateData.dataSubjectTypes = data.dataSubjectTypes;
    if (data.identifierTypes !== undefined) updateData.identifierTypes = data.identifierTypes;
    if (data.weight !== undefined) updateData.weight = data.weight;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.systemId !== undefined) updateData.systemId = data.systemId;
    if ("conditions" in data) updateData.conditions = data.conditions ?? Prisma.JsonNull;

    const rule = await prisma.discoveryRule.update({
      where: { id: params.id },
      data: updateData,
      include: { system: { select: { id: true, name: true } } },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "DISCOVERY_RULE_UPDATED",
      entityType: "DiscoveryRule",
      entityId: params.id,
      ip,
      userAgent,
      details: { changes: Object.keys(data) },
    });

    return NextResponse.json(rule);
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
    enforce(user.role, "DISCOVERY_RULES_MANAGE");

    const existing = await prisma.discoveryRule.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });
    if (!existing) throw new ApiError(404, "Discovery rule not found");

    await prisma.discoveryRule.delete({ where: { id: params.id } });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "DISCOVERY_RULE_DELETED",
      entityType: "DiscoveryRule",
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
