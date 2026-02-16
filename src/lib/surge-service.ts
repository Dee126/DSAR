/**
 * Surge Service
 *
 * Manages DSAR surge groups linked to incidents. Supports bulk actions:
 * - Apply system suggestions to all cases in group
 * - Create standard tasks for all cases
 * - Set response template
 * - Create extension notices when deadline risk is high
 *
 * Multi-tenant safe.
 */

import { prisma } from "./prisma";

export async function createSurgeGroup(
  tenantId: string,
  incidentId: string,
  userId: string,
  name: string,
  description?: string,
  caseIds?: string[],
) {
  // Verify incident
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, tenantId },
    include: { incidentSystems: { select: { systemId: true } } },
  });
  if (!incident) throw new Error("Incident not found");

  const suggestedSystems = incident.incidentSystems.map((s) => s.systemId);

  const surgeGroup = await prisma.surgeGroup.create({
    data: {
      tenantId,
      incidentId,
      name,
      description,
      suggestedSystems,
      createdByUserId: userId,
    },
  });

  // Add initial members
  if (caseIds && caseIds.length > 0) {
    const validCases = await prisma.dSARCase.findMany({
      where: { tenantId, id: { in: caseIds } },
      select: { id: true },
    });

    await prisma.surgeGroupMember.createMany({
      data: validCases.map((c) => ({
        tenantId,
        surgeGroupId: surgeGroup.id,
        caseId: c.id,
      })),
      skipDuplicates: true,
    });
  }

  return prisma.surgeGroup.findUnique({
    where: { id: surgeGroup.id },
    include: {
      members: {
        include: {
          case: {
            select: { id: true, caseNumber: true, type: true, status: true, priority: true, dueDate: true },
          },
        },
      },
      _count: { select: { members: true } },
    },
  });
}

export async function addCasesToSurgeGroup(
  tenantId: string,
  surgeGroupId: string,
  caseIds: string[],
) {
  const validCases = await prisma.dSARCase.findMany({
    where: { tenantId, id: { in: caseIds } },
    select: { id: true },
  });

  await prisma.surgeGroupMember.createMany({
    data: validCases.map((c) => ({
      tenantId,
      surgeGroupId,
      caseId: c.id,
    })),
    skipDuplicates: true,
  });

  return prisma.surgeGroupMember.count({ where: { surgeGroupId } });
}

export async function getSurgeGroup(tenantId: string, surgeGroupId: string) {
  return prisma.surgeGroup.findFirst({
    where: { id: surgeGroupId, tenantId },
    include: {
      incident: { select: { id: true, title: true, severity: true, status: true } },
      createdBy: { select: { id: true, name: true } },
      members: {
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
        },
      },
      _count: { select: { members: true } },
    },
  });
}

/**
 * Bulk action: Apply system suggestions from incident to all cases in surge group.
 */
export async function bulkApplySystems(
  tenantId: string,
  surgeGroupId: string,
  systemIds: string[],
): Promise<{ casesAffected: number; linksCreated: number }> {
  const members = await prisma.surgeGroupMember.findMany({
    where: { surgeGroupId, tenantId },
    select: { caseId: true },
  });

  let linksCreated = 0;
  for (const member of members) {
    for (const systemId of systemIds) {
      try {
        await prisma.caseSystemLink.create({
          data: {
            tenantId,
            caseId: member.caseId,
            systemId,
            suggestedByDiscovery: false,
            notes: "Added via surge group bulk action",
          },
        });
        linksCreated++;
      } catch {
        // Skip duplicates (unique constraint)
      }
    }
  }

  return { casesAffected: members.length, linksCreated };
}

/**
 * Bulk action: Create standard tasks for all cases in surge group.
 */
export async function bulkCreateTasks(
  tenantId: string,
  surgeGroupId: string,
  taskTitle: string,
  taskDescription?: string,
): Promise<{ casesAffected: number; tasksCreated: number }> {
  const members = await prisma.surgeGroupMember.findMany({
    where: { surgeGroupId, tenantId },
    select: { caseId: true },
  });

  const tasksData = members.map((m) => ({
    tenantId,
    caseId: m.caseId,
    title: taskTitle,
    description: taskDescription || null,
  }));

  const result = await prisma.task.createMany({ data: tasksData });

  return { casesAffected: members.length, tasksCreated: result.count };
}

/**
 * Bulk action: Create extension notices for cases with deadline risk.
 */
export async function bulkCreateExtensionNotices(
  tenantId: string,
  surgeGroupId: string,
  extensionDays: number,
  extensionReason: string,
): Promise<{ casesAffected: number; extensionsApplied: number }> {
  const members = await prisma.surgeGroupMember.findMany({
    where: { surgeGroupId, tenantId },
    select: { caseId: true },
  });

  let extensionsApplied = 0;
  for (const member of members) {
    const deadline = await prisma.caseDeadline.findUnique({
      where: { caseId: member.caseId },
    });

    if (deadline && deadline.currentRisk !== "GREEN" && !deadline.extendedDueAt) {
      const newDue = new Date(deadline.effectiveDueAt);
      newDue.setDate(newDue.getDate() + extensionDays);

      await prisma.caseDeadline.update({
        where: { caseId: member.caseId },
        data: {
          extendedDueAt: newDue,
          effectiveDueAt: newDue,
          extensionDays,
          extensionReason,
          extensionAppliedAt: new Date(),
        },
      });

      extensionsApplied++;
    }
  }

  return { casesAffected: members.length, extensionsApplied };
}
