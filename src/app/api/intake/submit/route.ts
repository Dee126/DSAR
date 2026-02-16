import { NextRequest, NextResponse } from "next/server";
import { intakeSubmissionSchema } from "@/lib/validation";
import { createSubmission } from "@/lib/services/intake-service";
import { getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";
import { ApiError } from "@/lib/errors";

// Max body size for intake (with file uploads): 50MB
const MAX_BODY_SIZE = 50 * 1024 * 1024;

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

      // Extract file attachments
      const files = formData.getAll("attachments");
      for (const file of files) {
        if (file instanceof File) {
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
