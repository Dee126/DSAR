import { prisma } from "../prisma";
import { getStorage } from "../storage";
import { classifySubmission } from "./classification-service";
import { logAudit } from "../audit";
import { ApiError } from "../errors";
import { v4 as uuidv4 } from "uuid";

// Regex patterns for parsing identifiers from email body
const EMAIL_REGEX = /[\w.-]+@[\w.-]+\.\w{2,}/g;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{2,4}/g;
const CUSTOMER_ID_REGEX = /(?:customer[_\- ]?(?:id|nr|number|no))[:\s]*([A-Z0-9-]+)/gi;
const EMPLOYEE_ID_REGEX = /(?:employee[_\- ]?(?:id|nr|number|no)|mitarbeiter[_\- ]?(?:nr|nummer))[:\s]*([A-Z0-9-]+)/gi;

function parseIdentifiersFromText(text: string): {
  emails: string[];
  phones: string[];
  customerIds: string[];
  employeeIds: string[];
} {
  const emails = Array.from(new Set(text.match(EMAIL_REGEX) || []));
  const phones = Array.from(new Set(text.match(PHONE_REGEX) || []));

  const customerIds: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = CUSTOMER_ID_REGEX.exec(text)) !== null) {
    customerIds.push(match[1]);
  }

  const employeeIds: string[] = [];
  while ((match = EMPLOYEE_ID_REGEX.exec(text)) !== null) {
    employeeIds.push(match[1]);
  }

  return {
    emails: emails.slice(0, 5),
    phones: phones.slice(0, 3),
    customerIds: Array.from(new Set(customerIds)),
    employeeIds: Array.from(new Set(employeeIds)),
  };
}

function generateReference(): string {
  const rand = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();
  return `INK-${rand}`;
}

export interface EmailIngestInput {
  from: string;
  subject?: string;
  body?: string;
  bodyHtml?: string;
  receivedAt?: string;
  tenantSlug: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    base64: string;
  }>;
}

export async function ingestEmail(input: EmailIngestInput): Promise<{
  submissionId: string;
  reference: string;
  parsedIdentifiers: Record<string, unknown>;
}> {
  // Resolve tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: input.tenantSlug },
  });
  if (!tenant) {
    throw new ApiError(404, "Tenant not found");
  }
  const tenantId = tenant.id;

  // Parse identifiers
  const bodyText = input.body || "";
  const parsed = parseIdentifiersFromText(bodyText);

  // Extract sender email as primary identifier
  const senderEmail = input.from.match(EMAIL_REGEX)?.[0] || input.from;

  // Subject identifier (if any)
  const subjectParsed = parseIdentifiersFromText(input.subject || "");

  const allEmails = Array.from(new Set([senderEmail, ...parsed.emails, ...subjectParsed.emails]));
  const primaryEmail = allEmails[0] || senderEmail;

  const parsedIdentifiers = {
    email: primaryEmail,
    additionalEmails: allEmails.slice(1),
    phones: parsed.phones,
    customerIds: [...parsed.customerIds, ...subjectParsed.customerIds],
    employeeIds: [...parsed.employeeIds, ...subjectParsed.employeeIds],
  };

  // Classify
  const classification = classifySubmission({
    requestDetails: [input.subject || "", bodyText].join(" "),
    subjectEmail: primaryEmail,
  });

  const reference = generateReference();
  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();

  // Create submission
  const submission = await prisma.intakeSubmission.create({
    data: {
      tenantId,
      reference,
      channel: "EMAIL",
      status: "NEW",
      preferredLanguage: "en",
      requestTypes: classification.requestTypes,
      subjectType: classification.subjectType,
      jurisdiction: classification.jurisdiction,
      classificationConfidence: classification.confidence,
      subjectEmail: primaryEmail,
      subjectName: extractNameFromEmail(input.from),
      requestDetails: bodyText.substring(0, 5000), // Limit stored body
      consentGiven: false, // Email ingest doesn't have explicit consent
      receivedAt,
    },
  });

  // Create email ingest event
  await prisma.emailIngestEvent.create({
    data: {
      tenantId,
      submissionId: submission.id,
      fromAddress: input.from,
      subject: input.subject,
      bodyPlain: bodyText.substring(0, 10000),
      bodyHtml: input.bodyHtml?.substring(0, 20000),
      receivedAt,
      parsedIdentifiers: parsedIdentifiers as any,
      mappingStatus: "MAPPED",
    },
  });

  // Upload attachments
  if (input.attachments && input.attachments.length > 0) {
    const storage = getStorage();
    for (const att of input.attachments.slice(0, 5)) {
      try {
        const buffer = Buffer.from(att.base64, "base64");
        const result = await storage.upload(buffer, att.filename, att.contentType);
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
      } catch (err) {
        console.error(`Failed to upload email attachment ${att.filename}:`, err);
      }
    }
  }

  // Audit
  await logAudit({
    tenantId,
    action: "intake.email_ingested",
    entityType: "IntakeSubmission",
    entityId: submission.id,
    details: {
      reference,
      from: input.from,
      subject: input.subject,
      parsedIdentifiers,
    },
  });

  return {
    submissionId: submission.id,
    reference,
    parsedIdentifiers,
  };
}

function extractNameFromEmail(from: string): string | undefined {
  // "John Doe <john@example.com>" → "John Doe"
  const match = from.match(/^([^<]+)\s*</);
  if (match) return match[1].trim();
  return undefined;
}
