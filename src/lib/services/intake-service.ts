import { prisma } from "../prisma";
import { getStorage } from "../storage";
import { classifySubmission } from "./classification-service";
import { findDuplicates, createDedupeCandidates } from "./dedupe-service";
import { logAudit } from "../audit";
import { ApiError } from "../errors";
import { v4 as uuidv4 } from "uuid";

function generateIntakeReference(): string {
  const rand = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();
  return `INK-${rand}`;
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (entry.count >= limit) {
    throw new ApiError(429, "Rate limit exceeded. Please try again later.");
  }
  entry.count++;
}

export interface IntakeSubmissionInput {
  preferredLanguage: string;
  requestTypes: string[];
  subjectType?: string;
  subjectEmail?: string;
  subjectPhone?: string;
  subjectName?: string;
  subjectAddress?: string;
  customerId?: string;
  employeeId?: string;
  requestDetails?: string;
  consentGiven: boolean;
  honeypot?: string;
}

export interface IntakeAttachmentInput {
  filename: string;
  contentType: string;
  buffer: Buffer;
}

export async function createSubmission(
  tenantSlug: string,
  input: IntakeSubmissionInput,
  attachments: IntakeAttachmentInput[],
  clientInfo: { ip: string; userAgent: string }
): Promise<{ reference: string; id: string }> {
  // Resolve tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug },
    include: { tenantIntakeSettings: true },
  });
  if (!tenant) {
    throw new ApiError(404, "Organization not found");
  }
  const tenantId = tenant.id;

  // Load settings
  const settings = tenant.tenantIntakeSettings;
  const rateLimitPerMin = settings?.rateLimitPerMinute ?? 5;
  const rateLimitPerHr = settings?.rateLimitPerHour ?? 20;
  const maxAttach = settings?.maxAttachments ?? 5;
  const maxSizeMb = settings?.maxAttachmentSizeMb ?? 10;

  // Rate limit by IP
  checkRateLimit(`intake:min:${clientInfo.ip}`, rateLimitPerMin, 60_000);
  checkRateLimit(`intake:hr:${clientInfo.ip}`, rateLimitPerHr, 3_600_000);

  // Spam check: honeypot
  const isSpam = !!(input.honeypot && input.honeypot.length > 0);

  // Validate attachments
  if (attachments.length > maxAttach) {
    throw new ApiError(400, `Maximum ${maxAttach} attachments allowed`);
  }
  for (const att of attachments) {
    if (att.buffer.length > maxSizeMb * 1024 * 1024) {
      throw new ApiError(400, `Attachment ${att.filename} exceeds ${maxSizeMb}MB limit`);
    }
  }

  // Classify
  const classification = classifySubmission({
    requestTypes: input.requestTypes,
    subjectType: input.subjectType,
    requestDetails: input.requestDetails,
    subjectEmail: input.subjectEmail,
    preferredLanguage: input.preferredLanguage,
  });

  const reference = generateIntakeReference();

  // Create submission
  const submission = await prisma.intakeSubmission.create({
    data: {
      tenantId,
      reference,
      channel: "WEB",
      status: isSpam ? "SPAM" : "NEW",
      preferredLanguage: input.preferredLanguage || "en",
      requestTypes: classification.requestTypes,
      subjectType: classification.subjectType,
      jurisdiction: classification.jurisdiction,
      classificationConfidence: classification.confidence,
      subjectEmail: input.subjectEmail || null,
      subjectPhone: input.subjectPhone || null,
      subjectName: input.subjectName || null,
      subjectAddress: input.subjectAddress || null,
      customerId: input.customerId || null,
      employeeId: input.employeeId || null,
      requestDetails: input.requestDetails || null,
      consentGiven: input.consentGiven,
      honeypotValue: input.honeypot || null,
      ipAddress: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      receivedAt: new Date(),
    },
  });

  // Upload attachments
  if (attachments.length > 0) {
    const storage = getStorage();
    for (const att of attachments) {
      const result = await storage.upload(att.buffer, att.filename, att.contentType);
      await prisma.intakeAttachment.create({
        data: {
          tenantId,
          submissionId: submission.id,
          filename: att.filename,
          contentType: att.contentType,
          storageKey: result.storageKey,
          size: result.size,
          hash: result.hash,
        },
      });
    }
  }

  // Audit
  await logAudit({
    tenantId,
    action: "intake.submission_created",
    entityType: "IntakeSubmission",
    entityId: submission.id,
    ip: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    details: {
      reference,
      channel: "WEB",
      isSpam,
      requestTypes: classification.requestTypes,
    },
  });

  // Auto-create case if setting enabled and not spam
  if (settings?.autoCreateCase && !isSpam) {
    const { createCaseFromSubmission } = await import("./case-creation-service");
    await createCaseFromSubmission(tenantId, submission.id);
  }

  return { reference, id: submission.id };
}

export async function markAsSpam(
  tenantId: string,
  submissionId: string,
  userId: string,
  clientInfo: { ip: string; userAgent: string }
): Promise<void> {
  const submission = await prisma.intakeSubmission.findFirst({
    where: { id: submissionId, tenantId },
  });
  if (!submission) throw new ApiError(404, "Submission not found");

  await prisma.intakeSubmission.update({
    where: { id: submissionId },
    data: { status: "SPAM", processedByUserId: userId, processedAt: new Date() },
  });

  await logAudit({
    tenantId,
    actorUserId: userId,
    action: "intake.marked_spam",
    entityType: "IntakeSubmission",
    entityId: submissionId,
    ip: clientInfo.ip,
    userAgent: clientInfo.userAgent,
    details: { reference: submission.reference },
  });
}

export async function getSubmissions(
  tenantId: string,
  filters: { status?: string; channel?: string; page?: number; limit?: number }
) {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { tenantId };
  if (filters.status) where.status = filters.status;
  if (filters.channel) where.channel = filters.channel;

  const [submissions, total] = await Promise.all([
    prisma.intakeSubmission.findMany({
      where,
      include: { attachments: true, case: { select: { id: true, caseNumber: true, status: true } } },
      orderBy: { receivedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.intakeSubmission.count({ where }),
  ]);

  return {
    data: submissions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
