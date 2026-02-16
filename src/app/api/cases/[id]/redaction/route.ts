/**
 * API: /api/cases/[id]/redaction
 *
 * Module 8.3 — Redaction & Sensitive Data Controls + Legal Exceptions
 *
 * GET  — Returns all redaction data for a case (entries, flags, exceptions, denials, review state)
 * POST — Create or manage redaction-related entities
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import {
  createSensitiveDataFlagSchema,
  reviewSensitiveDataFlagSchema,
  enhancedRedactionEntrySchema,
  approveRedactionEntrySchema,
  createLegalExceptionSchema,
  decideLegalExceptionSchema,
  createPartialDenialSchema,
  decidePartialDenialSchema,
  updateRedactionReviewStateSchema,
} from "@/lib/validation";
import {
  createRedactionEntry,
  approveRedactionEntry,
  getRedactionEntries,
  getRedactionReviewState,
  updateRedactionReviewState,
  checkRedactionGate,
} from "@/lib/redaction-controls-service";
import {
  createSensitiveDataFlag,
  reviewSensitiveDataFlag,
  getSensitiveDataFlags,
} from "@/lib/sensitive-data-service";
import {
  createLegalException,
  decideLegalException,
  getLegalExceptions,
  createPartialDenial,
  decidePartialDenial,
  getPartialDenials,
} from "@/lib/legal-exception-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "SENSITIVE_DATA_VIEW");

    const { id: caseId } = await params;
    const tenantId = user.tenantId;

    const [redactionEntries, sensitiveFlags, legalExceptions, partialDenials, reviewState, gateResult] =
      await Promise.all([
        getRedactionEntries(tenantId, caseId),
        getSensitiveDataFlags(tenantId, caseId),
        getLegalExceptions(tenantId, caseId),
        getPartialDenials(tenantId, caseId),
        getRedactionReviewState(tenantId, caseId),
        checkRedactionGate(tenantId, caseId),
      ]);

    return NextResponse.json({
      redactionEntries,
      sensitiveFlags,
      legalExceptions,
      partialDenials,
      reviewState,
      gateResult,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id: caseId } = await params;
    const tenantId = user.tenantId;

    const body = await request.json();
    const { action } = body;

    switch (action) {
      // ─── Redaction Entries ──────────────────────────────────
      case "create_redaction": {
        enforce(user.role, "REDACTION_REVIEW");
        const data = enhancedRedactionEntrySchema.parse(body);
        const entry = await createRedactionEntry(tenantId, caseId, user.id, data, request);
        return NextResponse.json(entry, { status: 201 });
      }

      case "approve_redaction": {
        enforce(user.role, "REDACTION_REVIEW");
        const { entryId } = body;
        const data = approveRedactionEntrySchema.parse(body);
        const entry = await approveRedactionEntry(tenantId, entryId, user.id, data.approved, request);
        return NextResponse.json(entry);
      }

      // ─── Sensitive Data Flags ──────────────────────────────
      case "create_sensitive_flag": {
        enforce(user.role, "SENSITIVE_DATA_FLAG");
        const data = createSensitiveDataFlagSchema.parse(body);
        const flag = await createSensitiveDataFlag(tenantId, caseId, user.id, data, request);
        return NextResponse.json(flag, { status: 201 });
      }

      case "review_sensitive_flag": {
        enforce(user.role, "SENSITIVE_DATA_REVIEW");
        const { flagId } = body;
        const data = reviewSensitiveDataFlagSchema.parse(body);
        const flag = await reviewSensitiveDataFlag(tenantId, flagId, user.id, data, request);
        return NextResponse.json(flag);
      }

      // ─── Legal Exceptions ──────────────────────────────────
      case "create_legal_exception": {
        enforce(user.role, "LEGAL_EXCEPTION_PROPOSE");
        const data = createLegalExceptionSchema.parse(body);
        const exception = await createLegalException(tenantId, caseId, user.id, data, request);
        return NextResponse.json(exception, { status: 201 });
      }

      case "decide_legal_exception": {
        enforce(user.role, "LEGAL_EXCEPTION_APPROVE");
        const { exceptionId } = body;
        const data = decideLegalExceptionSchema.parse(body);
        const exception = await decideLegalException(
          tenantId, exceptionId, user.id, data.decision, data.rejectionReason, request,
        );
        return NextResponse.json(exception);
      }

      // ─── Partial Denials ───────────────────────────────────
      case "create_partial_denial": {
        enforce(user.role, "PARTIAL_DENIAL_CREATE");
        const data = createPartialDenialSchema.parse(body);
        const denial = await createPartialDenial(tenantId, caseId, user.id, data, request);
        return NextResponse.json(denial, { status: 201 });
      }

      case "decide_partial_denial": {
        enforce(user.role, "PARTIAL_DENIAL_APPROVE");
        const { denialId } = body;
        const data = decidePartialDenialSchema.parse(body);
        const denial = await decidePartialDenial(tenantId, denialId, user.id, data.decision, request);
        return NextResponse.json(denial);
      }

      // ─── Redaction Review State ────────────────────────────
      case "update_review_state": {
        enforce(user.role, "REDACTION_REVIEW_STATE_MANAGE");
        const data = updateRedactionReviewStateSchema.parse(body);
        const review = await updateRedactionReviewState(
          tenantId, caseId, user.id, data.state, data.notes, request,
        );
        return NextResponse.json(review);
      }

      case "check_gate": {
        enforce(user.role, "SENSITIVE_DATA_VIEW");
        const gateResult = await checkRedactionGate(tenantId, caseId);
        return NextResponse.json(gateResult);
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
