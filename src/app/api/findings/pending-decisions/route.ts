import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/findings/pending-decisions
 * Returns findings that have an AI-suggested action of DELETE or REVIEW_REQUIRED
 * but no human decision yet. Ordered by risk score desc, then creation date desc.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "data_inventory", "read");

    const effectiveTenantId =
      process.env.NODE_ENV === "development" && process.env.DEMO_TENANT_ID
        ? process.env.DEMO_TENANT_ID
        : user.tenantId;

    const items = await prisma.finding.findMany({
      where: {
        tenantId: effectiveTenantId,
        aiSuggestedAction: { in: ["DELETE", "REVIEW_REQUIRED"] },
        humanDecision: null,
      },
      select: {
        id: true,
        systemId: true,
        dataCategory: true,
        summary: true,
        aiRiskScore: true,
        aiSuggestedAction: true,
        aiConfidence: true,
        aiLegalReference: true,
        sensitivityScore: true,
        containsSpecialCategory: true,
        createdAt: true,
      },
      orderBy: [
        { aiRiskScore: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({
      ok: true,
      total: items.length,
      items,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
