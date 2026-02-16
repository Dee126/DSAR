/**
 * Linkage Service
 *
 * Link/unlink DSAR cases to incidents. Propagates tags and notes.
 * Multi-tenant safe.
 */

import { prisma } from "./prisma";
import type { DsarIncidentSubjectStatus } from "@prisma/client";

export async function linkDsarToIncident(
  tenantId: string,
  caseId: string,
  incidentId: string,
  userId: string,
  linkReason?: string,
  subjectInScope?: DsarIncidentSubjectStatus,
) {
  // Verify both case and incident belong to tenant
  const [dsarCase, incident] = await Promise.all([
    prisma.dSARCase.findFirst({ where: { id: caseId, tenantId } }),
    prisma.incident.findFirst({ where: { id: incidentId, tenantId } }),
  ]);

  if (!dsarCase) throw new Error("Case not found");
  if (!incident) throw new Error("Incident not found");

  return prisma.dsarIncident.create({
    data: {
      tenantId,
      caseId,
      incidentId,
      linkReason,
      subjectInScope: subjectInScope || "UNKNOWN",
      linkedByUserId: userId,
    },
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
      incident: {
        select: { id: true, title: true, severity: true, status: true },
      },
      linkedBy: { select: { id: true, name: true } },
    },
  });
}

export async function unlinkDsarFromIncident(
  tenantId: string,
  caseId: string,
  incidentId: string,
) {
  return prisma.dsarIncident.deleteMany({
    where: { tenantId, caseId, incidentId },
  });
}

export async function getLinkedIncidentsForCase(tenantId: string, caseId: string) {
  return prisma.dsarIncident.findMany({
    where: { tenantId, caseId },
    include: {
      incident: {
        select: {
          id: true,
          title: true,
          severity: true,
          status: true,
          detectedAt: true,
          regulatorNotificationRequired: true,
          regulatorNotifiedAt: true,
          _count: { select: { dsarIncidents: true, regulatorRecords: true } },
        },
      },
      linkedBy: { select: { id: true, name: true } },
    },
  });
}

export async function getLinkedCasesForIncident(tenantId: string, incidentId: string) {
  return prisma.dsarIncident.findMany({
    where: { tenantId, incidentId },
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
  });
}

/**
 * Check if a case has any active incident links with regulator timelines.
 */
export async function hasActiveRegulatorTimeline(tenantId: string, caseId: string): Promise<boolean> {
  const links = await prisma.dsarIncident.findMany({
    where: { tenantId, caseId },
    include: {
      incident: {
        select: {
          regulatorNotificationRequired: true,
          status: true,
          regulatorRecords: { where: { status: { in: ["DRAFT", "SUBMITTED", "INQUIRY"] } } },
        },
      },
    },
  });

  return links.some(
    (link) =>
      link.incident.regulatorNotificationRequired &&
      link.incident.status !== "RESOLVED" &&
      link.incident.regulatorRecords.length > 0,
  );
}
