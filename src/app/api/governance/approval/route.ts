export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import {
  getCopilotRoleScope,
  checkTwoPersonApproval,
  DEFAULT_GOVERNANCE_SETTINGS,
} from "@/lib/copilot/governance";
import type { GovernanceSettings, TwoPersonApprovalState } from "@/lib/copilot/governance";

// ---------------------------------------------------------------------------
// In-memory approval store (production: stored in ExportApproval table)
// ---------------------------------------------------------------------------

interface ApprovalRecord {
  runId: string;
  caseId: string;
  tenantId: string;
  type: "ART9_LEGAL_REVIEW" | "EXPORT_APPROVAL";
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedBy: string;
  requestedAt: string;
  approvals: Array<{
    userId: string;
    role: string;
    approved: boolean;
    comment: string;
    timestamp: string;
  }>;
}

const approvalStore: ApprovalRecord[] = [];

function getApprovalStore(): ApprovalRecord[] {
  return approvalStore;
}

/**
 * POST /api/governance/approval
 *
 * Submit an approval decision for a run's Art. 9 legal review or export.
 *
 * Body:
 *   runId: string
 *   caseId: string
 *   type: "ART9_LEGAL_REVIEW" | "EXPORT_APPROVAL"
 *   action: "APPROVE" | "REJECT"
 *   comment: string
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { runId, caseId, type, action, comment } = body;

    // Validate required fields
    if (!runId || !caseId || !type || !action) {
      return NextResponse.json(
        { error: "Missing required fields: runId, caseId, type, action", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    if (!["ART9_LEGAL_REVIEW", "EXPORT_APPROVAL"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be ART9_LEGAL_REVIEW or EXPORT_APPROVAL.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    if (!["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be APPROVE or REJECT.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    // Role check: only DPO/TENANT_ADMIN/SUPER_ADMIN can approve
    const scope = getCopilotRoleScope(user.role);
    if (!scope.canApproveExport && !scope.canApproveArt9) {
      return NextResponse.json(
        { error: `Role '${user.role}' cannot approve or reject.`, code: "APPROVAL_FORBIDDEN" },
        { status: 403 },
      );
    }

    // Find or create approval record
    let record = approvalStore.find(
      (r) => r.runId === runId && r.type === type && r.tenantId === user.tenantId,
    );

    if (!record) {
      record = {
        runId,
        caseId,
        tenantId: user.tenantId,
        type,
        status: "PENDING",
        requestedBy: body.requestedBy ?? user.id,
        requestedAt: new Date().toISOString(),
        approvals: [],
      };
      approvalStore.push(record);
    }

    // Check user hasn't already approved
    const existingApproval = record.approvals.find((a) => a.userId === user.id);
    if (existingApproval) {
      return NextResponse.json(
        { error: "You have already submitted an approval decision for this item.", code: "ALREADY_APPROVED" },
        { status: 409 },
      );
    }

    // Add approval
    record.approvals.push({
      userId: user.id,
      role: user.role,
      approved: action === "APPROVE",
      comment: comment ?? "",
      timestamp: new Date().toISOString(),
    });

    // If rejected, mark as rejected immediately
    if (action === "REJECT") {
      record.status = "REJECTED";
    } else {
      // For two-person approval: check if we have enough approvals
      const approvalState: TwoPersonApprovalState = {
        approvals: record.approvals,
      };

      const settings: GovernanceSettings = {
        ...DEFAULT_GOVERNANCE_SETTINGS,
        twoPersonApprovalForExport: type === "EXPORT_APPROVAL",
      };

      const twoPersonCheck = checkTwoPersonApproval(
        approvalState,
        record.requestedBy,
        settings,
      );

      if (twoPersonCheck.allowed) {
        record.status = "APPROVED";
      }

      // For Art. 9: single DPO approval is sufficient
      if (type === "ART9_LEGAL_REVIEW" && action === "APPROVE") {
        record.status = "APPROVED";
      }
    }

    // Audit log
    const clientInfo = getClientInfo(request);
    const auditAction = type === "ART9_LEGAL_REVIEW"
      ? `COPILOT_LEGAL_APPROVAL_${action === "APPROVE" ? "GRANTED" : "REJECTED"}`
      : `COPILOT_EXPORT_APPROVAL_${action === "APPROVE" ? "GRANTED" : "REJECTED"}`;

    await logAudit({
      action: auditAction,
      actorUserId: user.id,
      tenantId: user.tenantId,
      entityType: "ExportApproval",
      entityId: runId,
      details: {
        runId,
        caseId,
        type,
        action,
        comment,
        approvalStatus: record.status,
        totalApprovals: record.approvals.length,
      },
      ...clientInfo,
    });

    return NextResponse.json({
      runId: record.runId,
      type: record.type,
      status: record.status,
      approvals: record.approvals.length,
      requiredApprovals: type === "EXPORT_APPROVAL" ? 2 : 1,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/governance/approval?runId=...&type=...
 * Check approval status for a run.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");
    const type = searchParams.get("type");

    if (!runId) {
      return NextResponse.json(
        { error: "Missing required param: runId", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const records = approvalStore.filter(
      (r) =>
        r.runId === runId &&
        r.tenantId === user.tenantId &&
        (!type || r.type === type),
    );

    return NextResponse.json({ approvals: records });
  } catch (error) {
    return handleApiError(error);
  }
}
