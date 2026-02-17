export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError, ApiError } from "@/lib/errors";
import { extensionRequestSchema, pauseClockSchema, markExtensionNotifiedSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import {
  calculateLegalDueDate,
  computeEffectiveDueDate,
  calculateDaysRemaining,
  calculatePausedDays,
  validateExtension,
  DEFAULT_SLA_CONFIG,
} from "@/lib/deadline";
import { computeRisk, riskToEscalationSeverity, shouldEscalate } from "@/lib/risk";

/**
 * GET /api/cases/[id]/deadline
 * Returns deadline info, milestones, risk level for a case.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "DEADLINES_VIEW");

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });
    if (!dsarCase) throw new ApiError(404, "Case not found");

    const deadline = await prisma.caseDeadline.findUnique({
      where: { caseId: params.id },
    });

    const milestones = await prisma.caseMilestone.findMany({
      where: { caseId: params.id, tenantId: user.tenantId },
      orderBy: { plannedDueAt: "asc" },
    });

    const events = await prisma.deadlineEvent.findMany({
      where: { caseId: params.id, tenantId: user.tenantId },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const escalations = await prisma.escalation.findMany({
      where: { caseId: params.id, tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ deadline, milestones, events, escalations });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/cases/[id]/deadline
 * Initialize deadline for a case (called on case creation or manually).
 */
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

    // Check if deadline already exists
    const existing = await prisma.caseDeadline.findUnique({
      where: { caseId: params.id },
    });
    if (existing) throw new ApiError(409, "Deadline already initialized for this case");

    // Load SLA config
    const slaConfig = await prisma.tenantSlaConfig.findUnique({
      where: { tenantId: user.tenantId },
    });
    const config = slaConfig ?? DEFAULT_SLA_CONFIG;

    // Load holidays if business days mode
    const holidays = config.useBusinessDays
      ? await prisma.holiday.findMany({ where: { tenantId: user.tenantId } })
      : [];

    const receivedAt = dsarCase.receivedAt;
    const legalDueAt = calculateLegalDueDate(
      receivedAt,
      { ...DEFAULT_SLA_CONFIG, ...config },
      holidays,
    );
    const effectiveDueAt = legalDueAt;
    const daysRemaining = calculateDaysRemaining(effectiveDueAt);

    const isClosed = dsarCase.status === "CLOSED" || dsarCase.status === "REJECTED";
    const riskResult = computeRisk(
      {
        daysRemaining,
        isOverdue: daysRemaining < 0,
        isPaused: false,
        extensionPending: false,
        milestones: [],
        isClosed,
      },
      { yellowThresholdDays: config.yellowThresholdDays, redThresholdDays: config.redThresholdDays },
    );

    const deadline = await prisma.caseDeadline.create({
      data: {
        tenantId: user.tenantId,
        caseId: params.id,
        receivedAt,
        legalDueAt,
        effectiveDueAt,
        currentRisk: riskResult.level as "GREEN" | "YELLOW" | "RED",
        riskReasons: riskResult.reasons,
        daysRemaining,
      },
    });

    // Create milestones
    const milestoneTypes = [
      { type: "IDV_COMPLETE" as const, days: config.milestoneIdvDays },
      { type: "COLLECTION_COMPLETE" as const, days: config.milestoneCollectionDays },
      { type: "DRAFT_READY" as const, days: config.milestoneDraftDays },
      { type: "LEGAL_REVIEW_DONE" as const, days: config.milestoneLegalDays },
      { type: "RESPONSE_SENT" as const, days: config.initialDeadlineDays },
    ];

    for (const m of milestoneTypes) {
      const plannedDueAt = new Date(receivedAt);
      plannedDueAt.setDate(plannedDueAt.getDate() + m.days);
      await prisma.caseMilestone.create({
        data: {
          tenantId: user.tenantId,
          caseId: params.id,
          milestoneType: m.type,
          plannedDueAt,
        },
      });
    }

    // Create deadline event
    await prisma.deadlineEvent.create({
      data: {
        tenantId: user.tenantId,
        caseId: params.id,
        eventType: "CREATED",
        description: `Deadline initialized: due ${legalDueAt.toISOString().split("T")[0]}`,
        actorUserId: user.id,
        metadata: { legalDueAt: legalDueAt.toISOString(), daysRemaining },
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "DEADLINE_INITIALIZED",
      entityType: "CaseDeadline",
      entityId: deadline.id,
      ip,
      userAgent,
      details: { caseId: params.id, legalDueAt: legalDueAt.toISOString() },
    });

    return NextResponse.json(deadline, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/cases/[id]/deadline
 * Apply extension, pause/resume, or mark extension notified.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();

    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });
    if (!dsarCase) throw new ApiError(404, "Case not found");

    const deadline = await prisma.caseDeadline.findUnique({
      where: { caseId: params.id },
    });
    if (!deadline) throw new ApiError(404, "Deadline not initialized for this case");

    const body = await request.json();
    const action = body.action as string;

    const { ip, userAgent } = getClientInfo(request);

    if (action === "extend") {
      enforce(user.role, "DEADLINES_EXTEND");
      const data = extensionRequestSchema.parse(body);

      const slaConfig = await prisma.tenantSlaConfig.findUnique({
        where: { tenantId: user.tenantId },
      });
      const maxDays = slaConfig?.extensionMaxDays ?? DEFAULT_SLA_CONFIG.extensionMaxDays;

      const validation = validateExtension(data.extensionDays, deadline.extensionDays, maxDays);
      if (!validation.valid) throw new ApiError(400, validation.error!);

      const totalExtension = (deadline.extensionDays ?? 0) + data.extensionDays;
      const useBusinessDays = slaConfig?.useBusinessDays ?? false;
      const holidays = useBusinessDays
        ? await prisma.holiday.findMany({ where: { tenantId: user.tenantId } })
        : [];

      const newEffective = computeEffectiveDueDate({
        legalDueAt: deadline.legalDueAt,
        extensionDays: totalExtension,
        totalPausedDays: deadline.totalPausedDays,
        useBusinessDays,
        holidays,
      });

      const daysRemaining = calculateDaysRemaining(newEffective);

      const updated = await prisma.caseDeadline.update({
        where: { caseId: params.id },
        data: {
          extendedDueAt: newEffective,
          effectiveDueAt: newEffective,
          extensionDays: totalExtension,
          extensionReason: data.reason,
          extensionAppliedAt: new Date(),
          extensionNotificationRequired: data.notificationRequired,
          daysRemaining,
        },
      });

      await prisma.deadlineEvent.create({
        data: {
          tenantId: user.tenantId,
          caseId: params.id,
          eventType: "EXTENDED",
          description: `Extension of ${data.extensionDays} days applied (total: ${totalExtension}). Reason: ${data.reason}`,
          actorUserId: user.id,
          metadata: { extensionDays: data.extensionDays, totalExtension, reason: data.reason },
        },
      });

      // Update case's extendedDueDate
      await prisma.dSARCase.update({
        where: { id: params.id },
        data: { extendedDueDate: newEffective, extensionReason: data.reason },
      });

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "DEADLINE_EXTENDED",
        entityType: "CaseDeadline",
        entityId: updated.id,
        ip,
        userAgent,
        details: { extensionDays: data.extensionDays, reason: data.reason, newEffective: newEffective.toISOString() },
      });

      return NextResponse.json(updated);
    }

    if (action === "pause") {
      enforce(user.role, "DEADLINES_PAUSE");
      const data = pauseClockSchema.parse(body);

      if (deadline.pausedAt) throw new ApiError(400, "Clock is already paused");

      const updated = await prisma.caseDeadline.update({
        where: { caseId: params.id },
        data: {
          pausedAt: new Date(),
          pauseReason: data.reason,
          pauseApprovedBy: user.id,
        },
      });

      await prisma.deadlineEvent.create({
        data: {
          tenantId: user.tenantId,
          caseId: params.id,
          eventType: "PAUSED",
          description: `Clock paused. Reason: ${data.reason}`,
          actorUserId: user.id,
          metadata: { reason: data.reason },
        },
      });

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "DEADLINE_PAUSED",
        entityType: "CaseDeadline",
        entityId: updated.id,
        ip,
        userAgent,
        details: { reason: data.reason },
      });

      return NextResponse.json(updated);
    }

    if (action === "resume") {
      enforce(user.role, "DEADLINES_PAUSE");

      if (!deadline.pausedAt) throw new ApiError(400, "Clock is not paused");

      const pausedDays = calculatePausedDays(deadline.pausedAt);
      const totalPaused = deadline.totalPausedDays + pausedDays;

      const slaConfig = await prisma.tenantSlaConfig.findUnique({
        where: { tenantId: user.tenantId },
      });
      const useBusinessDays = slaConfig?.useBusinessDays ?? false;
      const holidays = useBusinessDays
        ? await prisma.holiday.findMany({ where: { tenantId: user.tenantId } })
        : [];

      const newEffective = computeEffectiveDueDate({
        legalDueAt: deadline.legalDueAt,
        extensionDays: deadline.extensionDays,
        totalPausedDays: totalPaused,
        useBusinessDays,
        holidays,
      });

      const daysRemaining = calculateDaysRemaining(newEffective);

      const updated = await prisma.caseDeadline.update({
        where: { caseId: params.id },
        data: {
          pausedAt: null,
          pauseReason: null,
          pauseApprovedBy: null,
          totalPausedDays: totalPaused,
          effectiveDueAt: newEffective,
          daysRemaining,
        },
      });

      await prisma.deadlineEvent.create({
        data: {
          tenantId: user.tenantId,
          caseId: params.id,
          eventType: "RESUMED",
          description: `Clock resumed after ${pausedDays} day(s) pause. Due date shifted to ${newEffective.toISOString().split("T")[0]}`,
          actorUserId: user.id,
          metadata: { pausedDays, totalPaused, newEffective: newEffective.toISOString() },
        },
      });

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "DEADLINE_RESUMED",
        entityType: "CaseDeadline",
        entityId: updated.id,
        ip,
        userAgent,
        details: { pausedDays, newEffective: newEffective.toISOString() },
      });

      return NextResponse.json(updated);
    }

    if (action === "mark_notified") {
      enforce(user.role, "DEADLINES_EXTEND");
      const data = markExtensionNotifiedSchema.parse(body);

      const updated = await prisma.caseDeadline.update({
        where: { caseId: params.id },
        data: {
          extensionNotificationSentAt: data.sentAt ? new Date(data.sentAt) : new Date(),
        },
      });

      await logAudit({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "EXTENSION_NOTIFICATION_SENT",
        entityType: "CaseDeadline",
        entityId: updated.id,
        ip,
        userAgent,
        details: { caseId: params.id },
      });

      return NextResponse.json(updated);
    }

    throw new ApiError(400, "Invalid action. Must be one of: extend, pause, resume, mark_notified");
  } catch (error) {
    return handleApiError(error);
  }
}
