import { prisma } from "../prisma";
import { generateCaseNumber, calculateDueDate } from "../utils";
import { logAudit } from "../audit";
import { ApiError } from "../errors";
import { findDuplicates, createDedupeCandidates } from "./dedupe-service";

export async function createCaseFromSubmission(
  tenantId: string,
  submissionId: string,
  actorUserId?: string,
  clientInfo?: { ip: string; userAgent: string }
): Promise<{ caseId: string; caseNumber: string; dedupeCount: number }> {
  const submission = await prisma.intakeSubmission.findFirst({
    where: { id: submissionId, tenantId },
    include: { attachments: true },
  });

  if (!submission) throw new ApiError(404, "Submission not found");
  if (submission.status === "SPAM") throw new ApiError(400, "Cannot create case from spam submission");
  if (submission.caseId) throw new ApiError(400, "Case already created for this submission");

  // Get tenant for SLA
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

  const requestTypes = (submission.requestTypes as string[]) || ["ACCESS"];
  const primaryType = requestTypes[0] || "ACCESS";

  // Find or create DataSubject
  let dataSubject = null;
  if (submission.subjectEmail) {
    dataSubject = await prisma.dataSubject.findFirst({
      where: { tenantId, email: submission.subjectEmail },
    });
  }

  if (!dataSubject) {
    dataSubject = await prisma.dataSubject.create({
      data: {
        tenantId,
        fullName: submission.subjectName || "Unknown",
        email: submission.subjectEmail,
        phone: submission.subjectPhone,
        address: submission.subjectAddress,
        preferredLanguage: submission.preferredLanguage,
        identifiers: {
          ...(submission.customerId ? { customerId: submission.customerId } : {}),
          ...(submission.employeeId ? { employeeId: submission.employeeId } : {}),
        },
      },
    });
  }

  const caseNumber = generateCaseNumber();
  const receivedAt = submission.receivedAt;
  const dueDate = calculateDueDate(receivedAt, tenant.slaDefaultDays);

  // Create case
  const newCase = await prisma.dSARCase.create({
    data: {
      tenantId,
      caseNumber,
      type: primaryType as any,
      status: "NEW",
      priority: "MEDIUM",
      channel: submission.channel,
      requesterType: submission.subjectType || null,
      description: submission.requestDetails || `Intake submission ${submission.reference}`,
      receivedAt,
      dueDate,
      dataSubjectId: dataSubject.id,
      createdByUserId: actorUserId || (await getSystemUser(tenantId)),
      intakeChannel: submission.channel,
      intakeReference: submission.reference,
    },
  });

  // Link submission to case
  await prisma.intakeSubmission.update({
    where: { id: submissionId },
    data: {
      caseId: newCase.id,
      status: "PROCESSED",
      processedByUserId: actorUserId || null,
      processedAt: new Date(),
    },
  });

  // Copy attachments to case documents
  for (const att of submission.attachments) {
    await prisma.document.create({
      data: {
        tenantId,
        caseId: newCase.id,
        filename: att.filename,
        contentType: att.contentType,
        storageKey: att.storageKey,
        size: att.size,
        hash: att.hash,
        classification: "INTERNAL",
        uploadedByUserId: actorUserId || (await getSystemUser(tenantId)),
        tags: ["intake-attachment"],
      },
    });
  }

  // Create CaseDeadline if the model exists
  try {
    await prisma.caseDeadline.create({
      data: {
        tenantId,
        caseId: newCase.id,
        receivedAt,
        legalDueAt: dueDate,
        effectiveDueAt: dueDate,
        currentRisk: "GREEN",
        daysRemaining: tenant.slaDefaultDays,
      },
    });

    await prisma.deadlineEvent.create({
      data: {
        tenantId,
        caseId: newCase.id,
        eventType: "CREATED",
        description: `Case created from intake submission ${submission.reference}`,
        actorUserId: actorUserId || null,
      },
    });
  } catch {
    // Deadline models may not exist yet — continue
  }

  // Run dedupe
  let dedupeCount = 0;
  try {
    const settings = await prisma.tenantIntakeSettings.findUnique({ where: { tenantId } });
    const windowDays = settings?.dedupeWindowDays ?? 30;

    const matches = await findDuplicates(
      tenantId,
      {
        email: submission.subjectEmail,
        phone: submission.subjectPhone,
        customerId: submission.customerId,
        employeeId: submission.employeeId,
        name: submission.subjectName,
        address: submission.subjectAddress,
      },
      newCase.id,
      windowDays
    );

    if (matches.length > 0) {
      await createDedupeCandidates(tenantId, newCase.id, matches);
      dedupeCount = matches.length;
    }
  } catch (err) {
    console.error("Dedupe check failed:", err);
  }

  // Audit
  await logAudit({
    tenantId,
    actorUserId: actorUserId || null,
    action: "intake.case_created",
    entityType: "DSARCase",
    entityId: newCase.id,
    ip: clientInfo?.ip || null,
    userAgent: clientInfo?.userAgent || null,
    details: {
      caseNumber,
      submissionReference: submission.reference,
      requestTypes,
      dedupeCount,
    },
  });

  return { caseId: newCase.id, caseNumber, dedupeCount };
}

async function getSystemUser(tenantId: string): Promise<string> {
  // Get the first admin user for this tenant as fallback
  const admin = await prisma.user.findFirst({
    where: { tenantId, role: { in: ["SUPER_ADMIN", "TENANT_ADMIN"] } },
  });
  if (!admin) throw new ApiError(500, "No admin user found for tenant");
  return admin.id;
}
