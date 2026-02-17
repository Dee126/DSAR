export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { calculateDaysRemaining, DEFAULT_SLA_CONFIG } from "@/lib/deadline";
import { computeRisk, shouldEscalate, riskToEscalationSeverity } from "@/lib/risk";

/**
 * POST /api/risk-recompute
 * Recompute risk levels for all open cases in the tenant.
 * Can be called manually or via a cron job.
 */
export async function POST() {
  try {
    const user = await requireAuth();
    enforce(user.role, "DEADLINES_VIEW");

    const slaConfig = await prisma.tenantSlaConfig.findUnique({
      where: { tenantId: user.tenantId },
    });
    const config = slaConfig ?? DEFAULT_SLA_CONFIG;

    // Get all open cases with deadlines
    const deadlines = await prisma.caseDeadline.findMany({
      where: { tenantId: user.tenantId },
      include: {
        case: { select: { id: true, status: true, caseNumber: true } },
      },
    });

    let updated = 0;
    let escalated = 0;

    for (const dl of deadlines) {
      const isClosed = dl.case.status === "CLOSED" || dl.case.status === "REJECTED";
      const isPaused = !!dl.pausedAt;

      const daysRemaining = isPaused ? dl.daysRemaining : calculateDaysRemaining(dl.effectiveDueAt);

      // Load milestones
      const milestones = await prisma.caseMilestone.findMany({
        where: { caseId: dl.caseId, tenantId: user.tenantId },
      });

      const extensionPending = !!(
        dl.extensionDays &&
        dl.extensionDays > 0 &&
        dl.extensionNotificationRequired &&
        !dl.extensionNotificationSentAt
      );

      const riskResult = computeRisk(
        {
          daysRemaining,
          isOverdue: daysRemaining < 0,
          isPaused,
          extensionPending,
          milestones: milestones.map((m) => ({
            type: m.milestoneType,
            plannedDueAt: m.plannedDueAt,
            completedAt: m.completedAt,
          })),
          isClosed,
        },
        { yellowThresholdDays: config.yellowThresholdDays, redThresholdDays: config.redThresholdDays },
      );

      const previousLevel = dl.currentRisk;
      const newLevel = riskResult.level as "GREEN" | "YELLOW" | "RED";

      // Update deadline record
      if (previousLevel !== newLevel || dl.daysRemaining !== daysRemaining) {
        await prisma.caseDeadline.update({
          where: { id: dl.id },
          data: {
            currentRisk: newLevel,
            riskReasons: riskResult.reasons,
            daysRemaining: isPaused ? dl.daysRemaining : daysRemaining,
          },
        });
        updated++;
      }

      // Create escalation if risk worsened
      if (shouldEscalate(previousLevel, newLevel)) {
        const severity = riskToEscalationSeverity(newLevel, daysRemaining < 0);

        let recipientRoles: string[] = [];
        if (severity === "YELLOW_WARNING") recipientRoles = slaConfig?.escalationYellowRoles ?? ["DPO", "CASE_MANAGER"];
        if (severity === "RED_ALERT") recipientRoles = slaConfig?.escalationRedRoles ?? ["TENANT_ADMIN", "DPO"];
        if (severity === "OVERDUE_BREACH") recipientRoles = slaConfig?.escalationOverdueRoles ?? ["TENANT_ADMIN", "DPO"];

        await prisma.escalation.create({
          data: {
            tenantId: user.tenantId,
            caseId: dl.caseId,
            severity,
            reason: riskResult.reasons.join("; "),
            recipientRoles,
            createdByUserId: user.id,
          },
        });

        // Create notifications for recipients
        const recipients = await prisma.user.findMany({
          where: { tenantId: user.tenantId, role: { in: recipientRoles as never } },
        });

        for (const recipient of recipients) {
          await prisma.notification.create({
            data: {
              tenantId: user.tenantId,
              recipientUserId: recipient.id,
              type: daysRemaining < 0 ? "OVERDUE" : "ESCALATION",
              title: `${severity.replace(/_/g, " ")}: ${dl.case.caseNumber}`,
              message: riskResult.reasons.join("; "),
              linkUrl: `/cases/${dl.caseId}`,
            },
          });
        }

        escalated++;
      }
    }

    return NextResponse.json({ updated, escalated, total: deadlines.length });
  } catch (error) {
    return handleApiError(error);
  }
}
