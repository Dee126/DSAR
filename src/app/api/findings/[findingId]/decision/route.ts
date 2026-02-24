import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { HumanDecision } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_DECISIONS: Set<string> = new Set<string>(
  Object.values(HumanDecision),
);

/**
 * GET /api/findings/[findingId]/decision
 * Returns current AI + human decision fields for a finding (debug / review).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ findingId: string }> },
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "data_inventory", "read");

    const { findingId } = await params;

    const effectiveTenantId =
      process.env.NODE_ENV === "development" && process.env.DEMO_TENANT_ID
        ? process.env.DEMO_TENANT_ID
        : user.tenantId;

    const finding = await prisma.finding.findFirst({
      where: { id: findingId, tenantId: effectiveTenantId },
      select: {
        id: true,
        systemId: true,
        dataCategory: true,
        summary: true,
        sensitivityScore: true,
        containsSpecialCategory: true,
        aiRiskScore: true,
        aiConfidence: true,
        aiSuggestedAction: true,
        aiLegalReference: true,
        aiRationale: true,
        aiReviewStatus: true,
        humanDecision: true,
        humanDecisionReason: true,
        humanDecisionBy: true,
        humanDecisionAt: true,
        createdAt: true,
      },
    });

    if (!finding) {
      throw new ApiError(404, "Finding not found");
    }

    return NextResponse.json({ ok: true, finding });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/findings/[findingId]/decision
 * Submit a human decision on an AI-scored finding.
 *
 * Body: { decision: string, reason: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ findingId: string }> },
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "data_inventory", "manage");

    const { findingId } = await params;

    const effectiveTenantId =
      process.env.NODE_ENV === "development" && process.env.DEMO_TENANT_ID
        ? process.env.DEMO_TENANT_ID
        : user.tenantId;

    // ── Parse & validate body ────────────────────────────────────────────
    const body = await request.json();
    const { decision, reason } = body as {
      decision?: string;
      reason?: string;
    };

    if (!decision || !VALID_DECISIONS.has(decision)) {
      throw new ApiError(
        400,
        `Invalid decision. Must be one of: ${Array.from(VALID_DECISIONS).join(", ")}`,
      );
    }
    if (!reason || reason.trim().length < 5) {
      throw new ApiError(
        400,
        "Reason is required and must be at least 5 characters",
      );
    }

    // ── Load finding (tenant-scoped) ─────────────────────────────────────
    const finding = await prisma.finding.findFirst({
      where: { id: findingId, tenantId: effectiveTenantId },
      select: {
        id: true,
        aiSuggestedAction: true,
        aiRiskScore: true,
        humanDecision: true,
      },
    });

    if (!finding) {
      throw new ApiError(404, "Finding not found");
    }

    const previousHumanDecision = finding.humanDecision;
    const now = new Date();

    // ── Update finding ───────────────────────────────────────────────────
    const updated = await prisma.finding.update({
      where: { id: findingId },
      data: {
        humanDecision: decision as HumanDecision,
        humanDecisionReason: reason.trim(),
        humanDecisionBy: user.id,
        humanDecisionAt: now,
        aiReviewStatus: "REVIEWED",
      },
      select: {
        id: true,
        humanDecision: true,
        humanDecisionReason: true,
        humanDecisionBy: true,
        humanDecisionAt: true,
        aiReviewStatus: true,
      },
    });

    // ── Audit log ────────────────────────────────────────────────────────
    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: effectiveTenantId,
      actorUserId: user.id,
      action: "FINDING_HUMAN_DECISION",
      entityType: "Finding",
      entityId: findingId,
      ip,
      userAgent,
      details: {
        decision,
        reason: reason.trim(),
        aiSuggestedAction: finding.aiSuggestedAction,
        aiRiskScore: finding.aiRiskScore,
        previousHumanDecision,
        timestamp: now.toISOString(),
      },
    });

    return NextResponse.json({
      ok: true,
      findingId: updated.id,
      decision: updated.humanDecision,
      decidedAt: updated.humanDecisionAt,
      decidedByUserId: updated.humanDecisionBy,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
