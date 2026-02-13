import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import {
  runPreFlightChecks,
  enforceContentScanPermission,
  enforceExportPermission,
  checkForAnomalies,
  maskIdentifierForLog,
  DEFAULT_GOVERNANCE_SETTINGS,
} from "@/lib/copilot/governance";
import type {
  GovernanceSettings,
  CopilotRunRequest,
  RateLimitState,
} from "@/lib/copilot/governance";
import { addActivityLogEntry } from "@/app/api/governance/activity-log/route";
import { buildReportEntry } from "@/lib/copilot/governance-report";

// ---------------------------------------------------------------------------
// In-memory run store (production: CopilotRun table via Prisma)
// ---------------------------------------------------------------------------

interface CopilotRunRecord {
  id: string;
  caseId: string;
  tenantId: string;
  userId: string;
  userRole: string;
  userName: string;
  justification: string;
  status: "CREATED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  contentScanRequested: boolean;
  ocrRequested: boolean;
  llmRequested: boolean;
  totalFindings: number;
  containsSpecialCategory: boolean;
  legalApprovalStatus: string;
  createdAt: string;
  completedAt: string | null;
  errorDetails: string | null;
}

const runStore: CopilotRunRecord[] = [];

// In-memory rate limit tracking
const rateLimitTracker = {
  tenantRunsToday: new Map<string, number>(),
  userRunsToday: new Map<string, number>(),
  concurrentRuns: new Map<string, number>(),
};

function getRateLimitState(tenantId: string, userId: string): RateLimitState {
  return {
    tenantRunsToday: rateLimitTracker.tenantRunsToday.get(tenantId) ?? 0,
    userRunsToday: rateLimitTracker.userRunsToday.get(userId) ?? 0,
    concurrentRuns: rateLimitTracker.concurrentRuns.get(tenantId) ?? 0,
  };
}

function incrementRateLimits(tenantId: string, userId: string): void {
  rateLimitTracker.tenantRunsToday.set(
    tenantId,
    (rateLimitTracker.tenantRunsToday.get(tenantId) ?? 0) + 1,
  );
  rateLimitTracker.userRunsToday.set(
    userId,
    (rateLimitTracker.userRunsToday.get(userId) ?? 0) + 1,
  );
  rateLimitTracker.concurrentRuns.set(
    tenantId,
    (rateLimitTracker.concurrentRuns.get(tenantId) ?? 0) + 1,
  );
}

function decrementConcurrent(tenantId: string): void {
  const current = rateLimitTracker.concurrentRuns.get(tenantId) ?? 0;
  rateLimitTracker.concurrentRuns.set(tenantId, Math.max(0, current - 1));
}

export function getRunStore(): CopilotRunRecord[] {
  return runStore;
}

/**
 * POST /api/copilot/run
 *
 * Start a new Copilot discovery run with full governance enforcement.
 *
 * Body:
 *   caseId: string (required — case-only binding)
 *   justification: string (required — min 10 chars)
 *   contentScanRequested?: boolean
 *   ocrRequested?: boolean
 *   llmRequested?: boolean
 *   confirmed?: boolean
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const clientInfo = getClientInfo(request);

    const { caseId, justification, contentScanRequested, ocrRequested, llmRequested, confirmed } = body;

    // Governance settings (production: fetch from DB per tenant)
    const settings: GovernanceSettings = { ...DEFAULT_GOVERNANCE_SETTINGS };

    // Require confirmation if enabled
    if (settings.requireConfirmation && !confirmed) {
      return NextResponse.json(
        { error: "You must confirm this action is for DSAR processing.", code: "CONFIRMATION_REQUIRED" },
        { status: 400 },
      );
    }

    // Build pre-flight request
    const runRequest: CopilotRunRequest = {
      tenantId: user.tenantId,
      caseId,
      userId: user.id,
      userRole: user.role,
      justification,
      contentScanRequested: contentScanRequested ?? false,
      ocrRequested: ocrRequested ?? false,
      llmRequested: llmRequested ?? false,
    };

    // Rate limit state
    const rateLimitState = getRateLimitState(user.tenantId, user.id);

    // For this in-memory demo, we assume identityProfile exists if caseId is provided
    const identityProfileExists = !!caseId;

    // ─── Run ALL pre-flight governance checks ───
    const preflight = runPreFlightChecks(
      runRequest,
      settings,
      rateLimitState,
      identityProfileExists,
    );

    if (!preflight.allowed) {
      // Log blocked attempt
      await logAudit({
        action: "COPILOT_RUN_BLOCKED",
        actorUserId: user.id,
        tenantId: user.tenantId,
        entityType: "CopilotRun",
        entityId: caseId,
        details: {
          reason: preflight.reason,
          code: preflight.code,
          justification,
          caseId,
        },
        ...clientInfo,
      });

      // Anomaly detection on blocked attempts
      const anomalyCheck = checkForAnomalies({
        userId: user.id,
        tenantId: user.tenantId,
        runsInLastHour: rateLimitState.userRunsToday,
        distinctSubjectsInLastHour: 0,
        permissionDeniedInLastHour: 1,
      });

      if (anomalyCheck.isAnomaly) {
        await logAudit({
          action: "BREAK_GLASS_EVENT",
          actorUserId: user.id,
          tenantId: user.tenantId,
          entityType: "BreakGlassEvent",
          details: {
            eventType: anomalyCheck.eventType,
            description: anomalyCheck.description,
            triggerAction: "COPILOT_RUN_BLOCKED",
          },
          ...clientInfo,
        });
      }

      return NextResponse.json(
        { error: preflight.reason, code: preflight.code },
        { status: 403 },
      );
    }

    // Content scan permission check (separate from preflight)
    if (contentScanRequested) {
      const scanCheck = enforceContentScanPermission(user.role, true, settings);
      if (!scanCheck.allowed) {
        return NextResponse.json(
          { error: scanCheck.reason, code: scanCheck.code },
          { status: 403 },
        );
      }
    }

    // ─── Create the run ───
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const record: CopilotRunRecord = {
      id: runId,
      caseId,
      tenantId: user.tenantId,
      userId: user.id,
      userRole: user.role,
      userName: user.name,
      justification,
      status: "CREATED",
      contentScanRequested: contentScanRequested ?? false,
      ocrRequested: ocrRequested ?? false,
      llmRequested: llmRequested ?? false,
      totalFindings: 0,
      containsSpecialCategory: false,
      legalApprovalStatus: "NOT_REQUIRED",
      createdAt: now,
      completedAt: null,
      errorDetails: null,
    };

    runStore.push(record);
    incrementRateLimits(user.tenantId, user.id);

    // Audit log
    await logAudit({
      action: "COPILOT_RUN_STARTED",
      actorUserId: user.id,
      tenantId: user.tenantId,
      entityType: "CopilotRun",
      entityId: runId,
      details: {
        caseId,
        justification,
        contentScanRequested: contentScanRequested ?? false,
        ocrRequested: ocrRequested ?? false,
        llmRequested: llmRequested ?? false,
        executionMode: settings.defaultExecutionMode,
      },
      ...clientInfo,
    });

    // Add to governance activity log (masked subject)
    addActivityLogEntry(
      buildReportEntry({
        runId,
        caseId,
        caseNumber: body.caseNumber ?? caseId,
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        startedAt: new Date(),
        completedAt: null,
        status: "CREATED",
        justification,
        subjectIdentifierType: "name",
        subjectIdentifierValue: body.subjectName ?? "Unknown",
        systemsSearched: [],
        contentScanningUsed: contentScanRequested ?? false,
        ocrUsed: ocrRequested ?? false,
        art9Suspected: false,
        specialCategories: [],
        totalFindings: 0,
        totalEvidenceItems: 0,
        exportGenerated: false,
        exportApprovedBy: null,
        legalApprovalStatus: "NOT_REQUIRED",
      }),
    );

    return NextResponse.json({
      id: runId,
      status: record.status,
      caseId: record.caseId,
      justification: record.justification,
      createdAt: record.createdAt,
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/copilot/run?caseId=...
 * List runs for a case (tenant-scoped).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get("caseId");

    const runs = runStore.filter(
      (r) =>
        r.tenantId === user.tenantId &&
        (!caseId || r.caseId === caseId),
    );

    return NextResponse.json({ runs });
  } catch (error) {
    return handleApiError(error);
  }
}
