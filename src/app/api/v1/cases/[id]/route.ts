import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/errors";
import { authenticateApiKey, enforceScope, logApiCall, checkRateLimit } from "@/lib/api-key-auth";
import { logAudit, getClientInfo } from "@/lib/audit";
import { emitWebhookEvent } from "@/lib/webhook-service";
import { isValidTransition } from "@/lib/state-machine";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiUser = await authenticateApiKey(request);
    enforceScope(apiUser, "cases:read");
    checkRateLimit(apiUser.apiKeyId);

    const { id } = await params;
    const dsarCase = await prisma.dSARCase.findFirst({
      where: { id, tenantId: apiUser.tenantId },
      include: {
        dataSubject: { select: { fullName: true, email: true, phone: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        caseSystemLinks: { include: { system: { select: { id: true, name: true } } } },
        stateTransitions: { orderBy: { changedAt: "desc" }, take: 10 },
      },
    });

    if (!dsarCase) throw new ApiError(404, "Case not found");

    await logApiCall(request, apiUser, "DSARCase", id);
    return NextResponse.json({ data: dsarCase });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiUser = await authenticateApiKey(request);
    enforceScope(apiUser, "cases:write");
    checkRateLimit(apiUser.apiKeyId);

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.dSARCase.findFirst({
      where: { id, tenantId: apiUser.tenantId },
    });
    if (!existing) throw new ApiError(404, "Case not found");

    const updateData: any = {};

    // Handle status transition
    if (body.status && body.status !== existing.status) {
      if (!isValidTransition(existing.status, body.status)) {
        throw new ApiError(400, `Invalid transition from ${existing.status} to ${body.status}`);
      }
      updateData.status = body.status;

      // Create transition record
      await prisma.dSARStateTransition.create({
        data: {
          tenantId: apiUser.tenantId,
          caseId: id,
          fromStatus: existing.status,
          toStatus: body.status,
          changedByUserId: apiUser.createdBy,
          reason: body.reason || "Updated via API",
        },
      });

      await emitWebhookEvent(apiUser.tenantId, "case.status_changed", "DSARCase", id, {
        caseNumber: existing.caseNumber,
        fromStatus: existing.status,
        toStatus: body.status,
      });
    }

    if (body.priority) updateData.priority = body.priority;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.assignedToUserId !== undefined) updateData.assignedToUserId = body.assignedToUserId;

    const updated = await prisma.dSARCase.update({
      where: { id },
      data: updateData,
    });

    await logApiCall(request, apiUser, "DSARCase", id);
    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: apiUser.tenantId,
      actorUserId: apiUser.createdBy,
      action: "CASE_UPDATE",
      entityType: "DSARCase",
      entityId: id,
      ip,
      userAgent,
      details: { via: "public_api", changes: Object.keys(updateData) },
    });

    if (!body.status) {
      await emitWebhookEvent(apiUser.tenantId, "case.updated", "DSARCase", id, {
        caseNumber: existing.caseNumber,
        changes: Object.keys(updateData),
      });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
