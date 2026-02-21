export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

interface RouteParams {
  params: { id: string; itemId: string };
}

const DecisionSchema = z.object({
  decision: z.enum(["INCLUDED", "EXCLUDED"]),
  reason: z.string().optional(),
});

/**
 * PATCH /api/cases/[id]/proposed-items/[itemId]
 *
 * Update the decision on a proposed data asset item:
 *   - INCLUDED: the DPO confirms this item should be in the DSAR response
 *   - EXCLUDED: the DPO excludes it (e.g., exemption, irrelevant), reason required
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "update");

    const body = await request.json();
    const data = DecisionSchema.parse(body);

    if (data.decision === "EXCLUDED" && !data.reason?.trim()) {
      throw new ApiError(400, "Reason is required when excluding an item");
    }

    const item = await prisma.dsarCaseItem.findFirst({
      where: {
        id: params.itemId,
        caseId: params.id,
        tenantId: user.tenantId,
      },
    });

    if (!item) throw new ApiError(404, "Item not found");

    const updated = await prisma.dsarCaseItem.update({
      where: { id: params.itemId },
      data: {
        decision: data.decision,
        decisionReason: data.reason ?? null,
        decidedByUserId: user.id,
        decidedAt: new Date(),
      },
      include: {
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Audit event
    await prisma.dsarAuditEvent.create({
      data: {
        tenantId: user.tenantId,
        caseId: params.id,
        actorUserId: user.id,
        action: data.decision === "INCLUDED" ? "item.included" : "item.excluded",
        entityType: "DsarCaseItem",
        entityId: params.itemId,
        details: {
          title: item.title,
          assetType: item.assetType,
          decision: data.decision,
          reason: data.reason ?? null,
          previousDecision: item.decision,
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
