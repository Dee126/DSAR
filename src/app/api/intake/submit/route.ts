import { NextRequest, NextResponse } from "next/server";
import { intakeSubmissionSchema } from "@/lib/validation";
import { createSubmission } from "@/lib/services/intake-service";
import { getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";
import { ApiError } from "@/lib/errors";
import {
  checkRateLimit,
  hashIpForRateLimit,
  rateKey,
  RATE_LIMITS,
} from "@/lib/security/rate-limiter";

// Max body size for intake (with file uploads): 50MB
const MAX_BODY_SIZE = 50 * 1024 * 1024;

// Allowed MIME types for attachments
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_ATTACHMENTS = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: { tenantSlug?: string } }
) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug");
    if (!tenantSlug) {
      throw new ApiError(400, "tenantSlug query parameter is required");
    }

    const contentType = request.headers.get("content-type") || "";
    const clientInfo = getClientInfo(request);

    // Sprint 9.2: Rate limit per IP + tenant slug
    const ipHash = hashIpForRateLimit(clientInfo.ip);
    checkRateLimit(
      "intake_submit",
      rateKey(ipHash, tenantSlug),
      RATE_LIMITS.INTAKE_SUBMIT,
    );

    let body: Record<string, unknown>;
    const attachmentInputs: Array<{
      filename: string;
      contentType: string;
      buffer: Buffer;
    }> = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();

      // Extract JSON fields
      body = {
        preferredLanguage: formData.get("preferredLanguage") as string,
        requestTypes: JSON.parse((formData.get("requestTypes") as string) || "[]"),
        subjectType: formData.get("subjectType") as string || undefined,
        subjectEmail: formData.get("subjectEmail") as string || undefined,
        subjectPhone: formData.get("subjectPhone") as string || undefined,
        subjectName: formData.get("subjectName") as string || undefined,
        subjectAddress: formData.get("subjectAddress") as string || undefined,
        customerId: formData.get("customerId") as string || undefined,
        employeeId: formData.get("employeeId") as string || undefined,
        requestDetails: formData.get("requestDetails") as string || undefined,
        consentGiven: formData.get("consentGiven") === "true",
        honeypot: formData.get("website_url") as string || undefined,
      };

      // Extract file attachments with security checks
      const files = formData.getAll("attachments");
      if (files.length > MAX_ATTACHMENTS) {
        throw new ApiError(400, `Maximum ${MAX_ATTACHMENTS} attachments allowed`);
      }
      for (const file of files) {
        if (file instanceof File) {
          // Sprint 9.2: Validate MIME type
          if (!ALLOWED_MIME_TYPES.has(file.type)) {
            throw new ApiError(400, `File type '${file.type}' is not allowed`);
          }
          // Sprint 9.2: Validate file size
          if (file.size > MAX_ATTACHMENT_SIZE) {
            throw new ApiError(400, `File '${file.name}' exceeds maximum size of 10MB`);
          }
          const buffer = Buffer.from(await file.arrayBuffer());
          attachmentInputs.push({
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            buffer,
          });
        }
      }
    } else {
      body = await request.json();
    }

    // Sprint 9.2: Honeypot check — if filled, silently accept but don't process
    if (body.honeypot && typeof body.honeypot === "string" && body.honeypot.trim().length > 0) {
      // Return success response to not reveal detection
      return NextResponse.json(
        { reference: `INTAKE-${Date.now()}` },
        { status: 201 }
      );
    }

    // Validate
    const validated = intakeSubmissionSchema.parse(body);

    const result = await createSubmission(
      tenantSlug,
      {
        preferredLanguage: validated.preferredLanguage,
        requestTypes: validated.requestTypes,
        subjectType: validated.subjectType,
        subjectEmail: validated.subjectEmail || undefined,
        subjectPhone: validated.subjectPhone,
        subjectName: validated.subjectName,
        subjectAddress: validated.subjectAddress,
        customerId: validated.customerId,
        employeeId: validated.employeeId,
        requestDetails: validated.requestDetails,
        consentGiven: validated.consentGiven,
        honeypot: validated.honeypot,
      },
      attachmentInputs,
      clientInfo
    );

    return NextResponse.json(
      { reference: result.reference },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
