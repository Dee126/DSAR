export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";
import { createInventorySystemSchema } from "@/lib/validation";
import { calculateConfidenceScore, buildConfidenceInput } from "@/lib/confidence";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "DATA_INVENTORY_VIEW");

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status");
    const criticality = searchParams.get("criticality");

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (status) where.systemStatus = status;
    if (criticality) where.criticality = criticality;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const systems = await prisma.system.findMany({
      where: where as never,
      include: {
        ownerUser: { select: { id: true, name: true, email: true } },
        dataCategories: { select: { id: true, category: true, retentionPeriod: true, retentionDays: true } },
        processors: { select: { id: true, vendorName: true } },
        _count: { select: { discoveryRules: true, caseSystemLinks: true } },
      },
      orderBy: { name: "asc" },
    });

    // Compute confidence score for each system
    const result = systems.map((s) => ({
      ...s,
      confidenceScore: calculateConfidenceScore(buildConfidenceInput({
        ownerUserId: s.ownerUserId,
        dataResidencyPrimary: s.dataResidencyPrimary,
        processingRegions: s.processingRegions,
        automationReadiness: s.automationReadiness,
        connectorType: s.connectorType,
        dataCategories: s.dataCategories,
      })),
    }));

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "DATA_INVENTORY_MANAGE");

    const body = await request.json();
    const data = createInventorySystemSchema.parse(body);

    const system = await prisma.system.create({
      data: {
        tenantId: user.tenantId,
        name: data.name,
        description: data.description,
        owner: data.ownerUserId ? undefined : undefined,
        ownerUserId: data.ownerUserId ?? null,
        contactEmail: data.contactEmail || null,
        tags: data.tags ?? [],
        criticality: data.criticality ?? "MEDIUM",
        systemStatus: data.systemStatus ?? "ACTIVE",
        containsSpecialCategories: data.containsSpecialCategories ?? false,
        inScopeForDsar: data.inScopeForDsar ?? true,
        notes: data.notes,
        automationReadiness: data.automationReadiness ?? "MANUAL",
        connectorType: data.connectorType ?? "NONE",
        exportFormats: data.exportFormats ?? [],
        estimatedCollectionTimeMinutes: data.estimatedCollectionTimeMinutes ?? null,
        dataResidencyPrimary: data.dataResidencyPrimary,
        processingRegions: data.processingRegions ?? [],
        thirdCountryTransfers: data.thirdCountryTransfers ?? false,
        thirdCountryTransferDetails: data.thirdCountryTransferDetails,
        identifierTypes: data.identifierTypes ?? [],
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "DATA_INVENTORY_SYSTEM_CREATED",
      entityType: "System",
      entityId: system.id,
      ip,
      userAgent,
      details: { name: system.name },
    });

    return NextResponse.json(system, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
