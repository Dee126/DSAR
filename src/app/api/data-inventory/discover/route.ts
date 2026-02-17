export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { runDiscoverySchema } from "@/lib/validation";
import { runDiscovery, type SystemInfo, type DiscoveryRule as DiscoveryRuleInput } from "@/lib/discovery";
import { calculateConfidenceScore, buildConfidenceInput } from "@/lib/confidence";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/data-inventory/discover
 *
 * Run the discovery engine for a given DSAR type and identifiers.
 * Returns suggested systems ranked by score.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "DATA_INVENTORY_VIEW");

    const body = await request.json();
    const input = runDiscoverySchema.parse(body);

    // Load active rules
    const rules = await prisma.discoveryRule.findMany({
      where: { tenantId: user.tenantId, active: true },
    });

    // Load systems referenced by rules
    const systemIds = Array.from(new Set(rules.map((r) => r.systemId)));
    const systemRows = await prisma.system.findMany({
      where: { id: { in: systemIds }, tenantId: user.tenantId },
      include: {
        dataCategories: { select: { retentionPeriod: true, retentionDays: true } },
      },
    });

    // Build system info map
    const systemMap = new Map<string, SystemInfo>();
    for (const s of systemRows) {
      const confidenceScore = calculateConfidenceScore(buildConfidenceInput({
        ownerUserId: s.ownerUserId,
        dataResidencyPrimary: s.dataResidencyPrimary,
        processingRegions: s.processingRegions,
        automationReadiness: s.automationReadiness,
        connectorType: s.connectorType,
        dataCategories: s.dataCategories,
      }));
      systemMap.set(s.id, {
        id: s.id,
        name: s.name,
        inScopeForDsar: s.inScopeForDsar,
        confidenceScore,
        identifierTypes: s.identifierTypes,
      });
    }

    // Map Prisma rules to discovery engine format
    const engineRules: DiscoveryRuleInput[] = rules.map((r) => ({
      id: r.id,
      systemId: r.systemId,
      dsarTypes: r.dsarTypes,
      dataSubjectTypes: r.dataSubjectTypes,
      identifierTypes: r.identifierTypes,
      weight: r.weight,
      active: r.active,
      conditions: r.conditions as Record<string, unknown> | null,
    }));

    const suggestions = runDiscovery(
      {
        dsarType: input.dsarType as "ACCESS" | "ERASURE" | "RECTIFICATION" | "RESTRICTION" | "PORTABILITY" | "OBJECTION",
        dataSubjectType: input.dataSubjectType,
        identifierTypes: input.identifierTypes,
      },
      engineRules,
      systemMap,
    );

    return NextResponse.json({ suggestions });
  } catch (error) {
    return handleApiError(error);
  }
}
