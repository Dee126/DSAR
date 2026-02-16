import { NextRequest, NextResponse } from "next/server";
import { emailIngestSchema } from "@/lib/validation";
import { ingestEmail } from "@/lib/services/email-ingest-service";
import { handleApiError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = emailIngestSchema.parse(body);

    const result = await ingestEmail({
      from: data.from,
      subject: data.subject,
      body: data.body,
      bodyHtml: data.bodyHtml,
      receivedAt: data.receivedAt,
      tenantSlug: data.tenantSlug,
      attachments: data.attachments,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
