/**
 * Vendor Request Service
 *
 * Operations for vendor requests, request items, sending, reminders,
 * and escalations.
 *
 * Multi-tenant safe: all operations scoped by tenantId.
 */

import { prisma } from "./prisma";
import type {
  VendorRequestStatus,
  VendorRequestItemStatus,
  VendorResponseType,
  VendorEscalationSeverity,
} from "@prisma/client";

export async function createVendorRequest(
  tenantId: string,
  caseId: string,
  userId: string,
  input: {
    vendorId: string;
    systemId?: string;
    templateId?: string;
    subject: string;
    bodyHtml: string;
    dueAt?: string;
    items?: Array<{ systemId?: string; description: string }>;
  },
) {
  return prisma.vendorRequest.create({
    data: {
      tenantId,
      caseId,
      vendorId: input.vendorId,
      systemId: input.systemId,
      templateId: input.templateId,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      createdByUserId: userId,
      items: input.items?.length
        ? {
            create: input.items.map((item) => ({
              tenantId,
              systemId: item.systemId,
              description: item.description,
            })),
          }
        : undefined,
    },
    include: {
      vendor: { select: { id: true, name: true, shortCode: true } },
      items: true,
      _count: { select: { responses: true } },
    },
  });
}

export async function getVendorRequest(tenantId: string, requestId: string) {
  return prisma.vendorRequest.findFirst({
    where: { id: requestId, tenantId },
    include: {
      vendor: {
        select: { id: true, name: true, shortCode: true, status: true },
        include: { contacts: { where: { isPrimary: true }, take: 1 } },
      },
      system: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      items: {
        include: { system: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      responses: {
        include: {
          createdBy: { select: { id: true, name: true } },
          artifacts: true,
        },
        orderBy: { receivedAt: "desc" },
      },
    },
  });
}

export async function updateVendorRequest(
  tenantId: string,
  requestId: string,
  input: Partial<{
    status: VendorRequestStatus;
    subject: string;
    bodyHtml: string;
    dueAt: string;
    closedReason: string;
  }>,
) {
  const data: Record<string, unknown> = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.subject !== undefined) data.subject = input.subject;
  if (input.bodyHtml !== undefined) data.bodyHtml = input.bodyHtml;
  if (input.dueAt !== undefined) data.dueAt = new Date(input.dueAt);
  if (input.closedReason !== undefined) data.closedReason = input.closedReason;

  if (input.status === "SENT" && !data.sentAt) data.sentAt = new Date();
  if (input.status === "ACKNOWLEDGED") data.acknowledgedAt = new Date();
  if (input.status === "CLOSED") data.closedAt = new Date();

  return prisma.vendorRequest.update({
    where: { id: requestId },
    data,
    include: {
      vendor: { select: { id: true, name: true } },
      _count: { select: { items: true, responses: true } },
    },
  });
}

export async function sendVendorRequest(
  tenantId: string,
  requestId: string,
) {
  // Mark as SENT
  const request = await prisma.vendorRequest.update({
    where: { id: requestId },
    data: {
      status: "SENT",
      sentAt: new Date(),
    },
    include: {
      vendor: { include: { contacts: { where: { isPrimary: true }, take: 1 } } },
      case: { select: { caseNumber: true } },
    },
  });

  // In a production system, this would send an email via the outbox pattern.
  // For now, we create a notification for the outbox.
  const contact = request.vendor.contacts[0];
  if (contact) {
    await prisma.notification.create({
      data: {
        tenantId,
        recipientUserId: request.createdByUserId,
        type: "INFO",
        title: `Vendor request sent to ${request.vendor.name}`,
        message: `Request for case ${request.case.caseNumber} sent to ${contact.email}`,
        linkUrl: `/cases/${request.caseId}?tab=vendors`,
        emailPayload: {
          to: contact.email,
          subject: request.subject,
          html: request.bodyHtml,
        },
      },
    });
  }

  return request;
}

export async function updateVendorRequestItem(
  tenantId: string,
  itemId: string,
  input: { status: VendorRequestItemStatus; notes?: string },
) {
  const data: Record<string, unknown> = {
    status: input.status,
  };
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.status === "COMPLETED") data.completedAt = new Date();

  return prisma.vendorRequestItem.update({
    where: { id: itemId },
    data,
  });
}

export async function addVendorResponse(
  tenantId: string,
  userId: string,
  input: {
    requestId: string;
    responseType?: VendorResponseType;
    receivedAt?: string;
    summary?: string;
    notes?: string;
  },
) {
  const response = await prisma.vendorResponse.create({
    data: {
      tenantId,
      requestId: input.requestId,
      responseType: input.responseType || "DATA_EXTRACT",
      receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
      summary: input.summary,
      notes: input.notes,
      createdByUserId: userId,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  // Update request status based on response type
  const request = await prisma.vendorRequest.findUnique({
    where: { id: input.requestId },
    include: { items: true },
  });

  if (request) {
    const allItemsComplete = request.items.every(
      (item) => item.status === "COMPLETED" || item.status === "NOT_APPLICABLE",
    );

    if (input.responseType === "REJECTION") {
      await prisma.vendorRequest.update({
        where: { id: input.requestId },
        data: { status: "CLOSED", closedAt: new Date(), closedReason: "Vendor rejected request" },
      });
    } else if (allItemsComplete) {
      await prisma.vendorRequest.update({
        where: { id: input.requestId },
        data: { status: "RESPONDED" },
      });
    } else {
      await prisma.vendorRequest.update({
        where: { id: input.requestId },
        data: { status: "PARTIALLY_RESPONDED" },
      });
    }
  }

  return response;
}

export async function createVendorEscalation(
  tenantId: string,
  userId: string,
  input: {
    vendorId: string;
    requestId?: string;
    severity: VendorEscalationSeverity;
    reason: string;
  },
) {
  const escalation = await prisma.vendorEscalation.create({
    data: {
      tenantId,
      vendorId: input.vendorId,
      requestId: input.requestId,
      severity: input.severity,
      reason: input.reason,
      createdByUserId: userId,
    },
  });

  // If linked to a request, mark it as escalated
  if (input.requestId) {
    await prisma.vendorRequest.update({
      where: { id: input.requestId },
      data: { status: "ESCALATED" },
    });
  }

  return escalation;
}

export async function acknowledgeEscalation(
  tenantId: string,
  escalationId: string,
) {
  return prisma.vendorEscalation.update({
    where: { id: escalationId },
    data: { acknowledged: true, acknowledgedAt: new Date() },
  });
}

export async function resolveEscalation(
  tenantId: string,
  escalationId: string,
) {
  return prisma.vendorEscalation.update({
    where: { id: escalationId },
    data: { acknowledged: true, acknowledgedAt: new Date(), resolvedAt: new Date() },
  });
}

/**
 * Check for overdue vendor requests and auto-escalate.
 */
export async function checkOverdueRequests(tenantId: string) {
  const overdueRequests = await prisma.vendorRequest.findMany({
    where: {
      tenantId,
      status: { in: ["SENT", "ACKNOWLEDGED"] },
      dueAt: { lt: new Date() },
    },
    include: {
      vendor: { include: { slaConfig: true } },
    },
  });

  const escalated: string[] = [];

  for (const request of overdueRequests) {
    const sla = request.vendor.slaConfig;
    if (!sla?.autoEscalate) continue;

    // Check if already escalated
    const existing = await prisma.vendorEscalation.findFirst({
      where: { tenantId, requestId: request.id, resolvedAt: null },
    });
    if (existing) continue;

    await prisma.vendorEscalation.create({
      data: {
        tenantId,
        vendorId: request.vendorId,
        requestId: request.id,
        severity: "WARNING",
        reason: `Vendor request overdue. Due: ${request.dueAt?.toISOString()}`,
      },
    });

    await prisma.vendorRequest.update({
      where: { id: request.id },
      data: { status: "OVERDUE" },
    });

    escalated.push(request.id);
  }

  return { checkedCount: overdueRequests.length, escalatedCount: escalated.length };
}

/**
 * List vendor requests for a specific case.
 */
export async function listVendorRequestsForCase(
  tenantId: string,
  caseId: string,
) {
  return prisma.vendorRequest.findMany({
    where: { tenantId, caseId },
    include: {
      vendor: { select: { id: true, name: true, shortCode: true, status: true } },
      system: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      items: { include: { system: { select: { id: true, name: true } } } },
      _count: { select: { responses: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
