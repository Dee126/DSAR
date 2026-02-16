/**
 * Incident Service
 *
 * CRUD operations for incidents, timeline events, assessments,
 * regulator records, contacts, communications, and systems linkage.
 *
 * Multi-tenant safe: all operations scoped by tenantId.
 */

import { prisma } from "./prisma";
import type {
  IncidentSeverity,
  IncidentStatus,
  IncidentTimelineEventType,
  RegulatorRecordStatus,
  IncidentSourceType,
} from "@prisma/client";

export interface CreateIncidentInput {
  title: string;
  description?: string;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  detectedAt?: string;
  containedAt?: string;
  resolvedAt?: string;
  regulatorNotificationRequired?: boolean;
  numberOfDataSubjectsEstimate?: number | null;
  categoriesOfDataAffected?: string[];
  crossBorder?: boolean;
  tags?: string[];
}

export async function createIncident(
  tenantId: string,
  userId: string,
  input: CreateIncidentInput,
) {
  return prisma.incident.create({
    data: {
      tenantId,
      title: input.title,
      description: input.description,
      severity: input.severity || "MEDIUM",
      status: input.status || "OPEN",
      detectedAt: input.detectedAt ? new Date(input.detectedAt) : null,
      containedAt: input.containedAt ? new Date(input.containedAt) : null,
      resolvedAt: input.resolvedAt ? new Date(input.resolvedAt) : null,
      regulatorNotificationRequired: input.regulatorNotificationRequired ?? false,
      numberOfDataSubjectsEstimate: input.numberOfDataSubjectsEstimate,
      categoriesOfDataAffected: input.categoriesOfDataAffected || [],
      crossBorder: input.crossBorder ?? false,
      tags: input.tags || [],
      createdByUserId: userId,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function updateIncident(
  tenantId: string,
  incidentId: string,
  input: Partial<CreateIncidentInput>,
) {
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.severity !== undefined) data.severity = input.severity;
  if (input.status !== undefined) data.status = input.status;
  if (input.detectedAt !== undefined) data.detectedAt = input.detectedAt ? new Date(input.detectedAt) : null;
  if (input.containedAt !== undefined) data.containedAt = input.containedAt ? new Date(input.containedAt) : null;
  if (input.resolvedAt !== undefined) data.resolvedAt = input.resolvedAt ? new Date(input.resolvedAt) : null;
  if (input.regulatorNotificationRequired !== undefined) data.regulatorNotificationRequired = input.regulatorNotificationRequired;
  if (input.numberOfDataSubjectsEstimate !== undefined) data.numberOfDataSubjectsEstimate = input.numberOfDataSubjectsEstimate;
  if (input.categoriesOfDataAffected !== undefined) data.categoriesOfDataAffected = input.categoriesOfDataAffected;
  if (input.crossBorder !== undefined) data.crossBorder = input.crossBorder;
  if (input.tags !== undefined) data.tags = input.tags;

  return prisma.incident.update({
    where: { id: incidentId },
    data,
  });
}

export async function getIncident(tenantId: string, incidentId: string) {
  return prisma.incident.findFirst({
    where: { id: incidentId, tenantId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      sources: true,
      incidentSystems: {
        include: { system: { select: { id: true, name: true, description: true, criticality: true } } },
      },
      contacts: true,
      timeline: {
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { timestamp: "asc" },
      },
      communications: {
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      assessments: {
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { version: "desc" },
      },
      regulatorRecords: { orderBy: { createdAt: "desc" } },
      dsarIncidents: {
        include: {
          case: {
            select: {
              id: true,
              caseNumber: true,
              type: true,
              status: true,
              priority: true,
              dueDate: true,
              dataSubject: { select: { fullName: true } },
            },
          },
          linkedBy: { select: { id: true, name: true } },
        },
      },
      surgeGroups: {
        include: { _count: { select: { members: true } } },
      },
      authorityExportRuns: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { id: true, name: true } } },
      },
    },
  });
}

export async function listIncidents(
  tenantId: string,
  filters?: {
    status?: IncidentStatus;
    severity?: IncidentSeverity;
    regulatorNotified?: boolean;
    hasLinkedDsars?: boolean;
  },
) {
  const where: Record<string, unknown> = { tenantId };

  if (filters?.status) where.status = filters.status;
  if (filters?.severity) where.severity = filters.severity;
  if (filters?.regulatorNotified !== undefined) {
    where.regulatorNotifiedAt = filters.regulatorNotified ? { not: null } : null;
  }

  const incidents = await prisma.incident.findMany({
    where,
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: {
        select: {
          dsarIncidents: true,
          regulatorRecords: true,
          timeline: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (filters?.hasLinkedDsars !== undefined) {
    return incidents.filter((i) =>
      filters.hasLinkedDsars ? i._count.dsarIncidents > 0 : i._count.dsarIncidents === 0,
    );
  }

  return incidents;
}

export async function addTimelineEvent(
  tenantId: string,
  incidentId: string,
  userId: string,
  input: { eventType: IncidentTimelineEventType; timestamp: string; description: string },
) {
  return prisma.incidentTimeline.create({
    data: {
      tenantId,
      incidentId,
      eventType: input.eventType,
      timestamp: new Date(input.timestamp),
      description: input.description,
      createdByUserId: userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function addAssessment(
  tenantId: string,
  incidentId: string,
  userId: string,
  input: {
    natureOfBreach?: string;
    categoriesAndApproxSubjects?: string;
    categoriesAndApproxRecords?: string;
    likelyConsequences?: string;
    measuresTakenOrProposed?: string;
    dpoContactDetails?: string;
    additionalNotes?: string;
  },
) {
  const existing = await prisma.incidentAssessment.count({
    where: { tenantId, incidentId },
  });

  return prisma.incidentAssessment.create({
    data: {
      tenantId,
      incidentId,
      ...input,
      version: existing + 1,
      createdByUserId: userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function addRegulatorRecord(
  tenantId: string,
  incidentId: string,
  input: {
    authorityName: string;
    country?: string;
    referenceNumber?: string;
    status?: RegulatorRecordStatus;
    notes?: string;
  },
) {
  return prisma.incidentRegulatorRecord.create({
    data: {
      tenantId,
      incidentId,
      authorityName: input.authorityName,
      country: input.country,
      referenceNumber: input.referenceNumber,
      status: input.status || "DRAFT",
      notes: input.notes,
    },
  });
}

export async function updateRegulatorRecord(
  tenantId: string,
  recordId: string,
  input: Partial<{
    authorityName: string;
    country: string;
    referenceNumber: string;
    status: RegulatorRecordStatus;
    notes: string;
    submittedAt: string;
  }>,
) {
  const data: Record<string, unknown> = {};
  if (input.authorityName !== undefined) data.authorityName = input.authorityName;
  if (input.country !== undefined) data.country = input.country;
  if (input.referenceNumber !== undefined) data.referenceNumber = input.referenceNumber;
  if (input.status !== undefined) data.status = input.status;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.submittedAt !== undefined) data.submittedAt = new Date(input.submittedAt);

  return prisma.incidentRegulatorRecord.update({
    where: { id: recordId },
    data,
  });
}

export async function addContact(
  tenantId: string,
  incidentId: string,
  input: { role: string; name: string; email?: string; phone?: string; notes?: string },
) {
  return prisma.incidentContact.create({
    data: { tenantId, incidentId, ...input },
  });
}

export async function addCommunication(
  tenantId: string,
  incidentId: string,
  userId: string,
  input: {
    direction: string;
    channel: string;
    recipient?: string;
    subject?: string;
    body?: string;
    documentRef?: string;
    sentAt?: string;
  },
) {
  return prisma.incidentCommunication.create({
    data: {
      tenantId,
      incidentId,
      direction: input.direction,
      channel: input.channel,
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      documentRef: input.documentRef,
      sentAt: input.sentAt ? new Date(input.sentAt) : null,
      createdByUserId: userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function addIncidentSystem(
  tenantId: string,
  incidentId: string,
  systemId: string,
  notes?: string,
) {
  return prisma.incidentSystem.create({
    data: { tenantId, incidentId, systemId, notes },
    include: { system: { select: { id: true, name: true, description: true, criticality: true } } },
  });
}

export async function removeIncidentSystem(
  tenantId: string,
  incidentId: string,
  systemId: string,
) {
  return prisma.incidentSystem.deleteMany({
    where: { tenantId, incidentId, systemId },
  });
}

export async function addIncidentSource(
  tenantId: string,
  incidentId: string,
  input: {
    sourceType?: IncidentSourceType;
    externalId?: string;
    externalUrl?: string;
    systemName?: string;
  },
) {
  return prisma.incidentSource.create({
    data: {
      tenantId,
      incidentId,
      sourceType: input.sourceType || "MANUAL",
      externalId: input.externalId,
      externalUrl: input.externalUrl,
      systemName: input.systemName,
      importedAt: input.sourceType !== "MANUAL" ? new Date() : null,
    },
  });
}

/**
 * Get incident stats for dashboard widget.
 */
export async function getIncidentDashboardStats(tenantId: string) {
  const [
    totalOpen,
    totalContained,
    totalResolved,
    bySeverity,
    linkedDsarCount,
    overdueLinkedCases,
  ] = await Promise.all([
    prisma.incident.count({ where: { tenantId, status: "OPEN" } }),
    prisma.incident.count({ where: { tenantId, status: "CONTAINED" } }),
    prisma.incident.count({ where: { tenantId, status: "RESOLVED" } }),
    prisma.incident.groupBy({
      by: ["severity"],
      where: { tenantId, status: { in: ["OPEN", "CONTAINED"] } },
      _count: true,
    }),
    prisma.dsarIncident.count({ where: { tenantId } }),
    prisma.dsarIncident.count({
      where: {
        tenantId,
        case: { dueDate: { lt: new Date() }, status: { notIn: ["CLOSED", "REJECTED"] } },
      },
    }),
  ]);

  const severityDistribution = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0, ...bySeverity.reduce(
    (acc, g) => ({ ...acc, [g.severity]: g._count }),
    {} as Record<string, number>,
  )};

  return {
    openIncidents: totalOpen,
    contained: totalContained,
    resolved: totalResolved,
    linkedDSARs: linkedDsarCount,
    overdueDSARs: overdueLinkedCases,
    severityDistribution,
  };
}
