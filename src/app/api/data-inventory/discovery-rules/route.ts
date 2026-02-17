export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";
import { createDiscoveryRuleSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET() {
  try {
    const user = await requireAuth();
    enforce(user.role, "DISCOVERY_RULES_VIEW");

    const rules = await prisma.discoveryRule.findMany({
      where: { tenantId: user.tenantId },
      include: {
        system: { select: { id: true, name: true, systemStatus: true } },
      },
      orderBy: [{ active: "desc" }, { weight: "desc" }],
    });

    return NextResponse.json(rules);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "DISCOVERY_RULES_MANAGE");

    const body = await request.json();
    const data = createDiscoveryRuleSchema.parse(body);

    const rule = await prisma.discoveryRule.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        dsarTypes: data.dsarTypes,
        dataSubjectTypes: data.dataSubjectTypes ?? [],
        identifierTypes: data.identifierTypes ?? [],
        conditions: data.conditions ? (data.conditions as Prisma.InputJsonValue) : Prisma.JsonNull,
        systemId: data.systemId,
        weight: data.weight,
        active: data.active ?? true,
      },
      include: {
        system: { select: { id: true, name: true } },
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "DISCOVERY_RULE_CREATED",
      entityType: "DiscoveryRule",
      entityId: rule.id,
      ip,
      userAgent,
      details: { name: data.name, systemId: data.systemId },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
