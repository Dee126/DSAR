import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { clarificationRequestSchema, resolveClarificationSchema } from "@/lib/validation";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";
import { ApiError } from "@/lib/errors";

const CLARIFICATION_TEMPLATE_EN = (questions: string[]) => `
Dear Data Subject,

Thank you for your request. In order to process your DSAR request effectively, we require additional information:

${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Please provide the requested information at your earliest convenience. Your request remains on file and will be processed once the necessary information is received.

Kind regards,
Privacy Team
`.trim();

const CLARIFICATION_TEMPLATE_DE = (questions: string[]) => `
Sehr geehrte/r Betroffene/r,

vielen Dank für Ihre Anfrage. Um Ihre DSGVO-Anfrage bearbeiten zu können, benötigen wir zusätzliche Informationen:

${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Bitte stellen Sie uns die genannten Informationen baldmöglichst zur Verfügung. Ihre Anfrage bleibt registriert und wird bearbeitet, sobald die erforderlichen Informationen vorliegen.

Mit freundlichen Grüßen,
Datenschutz-Team
`.trim();

// POST: Create clarification request for a submission/case
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "update");

    const body = await request.json();
    const data = clarificationRequestSchema.parse(body);
    const clientInfo = getClientInfo(request);

    // Find the submission and its case
    const submission = await prisma.intakeSubmission.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });

    if (!submission) {
      throw new ApiError(404, "Submission not found");
    }

    if (!submission.caseId) {
      throw new ApiError(400, "Must create a case before requesting clarification");
    }

    // Generate template based on language
    const lang = submission.preferredLanguage || "en";
    const templateFn = lang === "de" ? CLARIFICATION_TEMPLATE_DE : CLARIFICATION_TEMPLATE_EN;
    const templateBody = data.templateBody || templateFn(data.questions);

    // Create clarification request
    const clarification = await prisma.clarificationRequest.create({
      data: {
        tenantId: user.tenantId,
        caseId: submission.caseId,
        questions: data.questions,
        templateBody,
        status: "OPEN",
        createdByUserId: user.id,
      },
    });

    // Check if clarification should pause the clock
    const settings = await prisma.tenantIntakeSettings.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (settings?.clarificationPausesClock) {
      try {
        await prisma.deadlineEvent.create({
          data: {
            tenantId: user.tenantId,
            caseId: submission.caseId,
            eventType: "PAUSED",
            description: "Paused for clarification",
            actorUserId: user.id,
          },
        });
      } catch {
        // Deadline model may not be initialized
      }
    }

    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "intake.clarification_requested",
      entityType: "ClarificationRequest",
      entityId: clarification.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: submission.caseId,
        questionCount: data.questions.length,
        pausesClock: settings?.clarificationPausesClock || false,
      },
    });

    return NextResponse.json(clarification, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH: Resolve clarification request
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "update");

    const body = await request.json();
    const data = resolveClarificationSchema.parse(body);
    const clientInfo = getClientInfo(request);

    // Find the clarification (id here is clarification ID)
    const url = new URL(request.url);
    const clarificationId = url.searchParams.get("clarificationId");

    if (!clarificationId) {
      throw new ApiError(400, "clarificationId query parameter required");
    }

    const clarification = await prisma.clarificationRequest.findFirst({
      where: { id: clarificationId, tenantId: user.tenantId },
    });

    if (!clarification) {
      throw new ApiError(404, "Clarification request not found");
    }

    // Resolve it
    const updated = await prisma.clarificationRequest.update({
      where: { id: clarificationId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedNote: data.resolvedNote,
      },
    });

    // Resume clock if paused
    const settings = await prisma.tenantIntakeSettings.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (settings?.clarificationPausesClock) {
      try {
        await prisma.deadlineEvent.create({
          data: {
            tenantId: user.tenantId,
            caseId: clarification.caseId,
            eventType: "RESUMED",
            description: "Clarification resolved",
            actorUserId: user.id,
          },
        });
      } catch {
        // Deadline model may not be initialized
      }
    }

    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "intake.clarification_resolved",
      entityType: "ClarificationRequest",
      entityId: clarificationId,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: clarification.caseId,
        resolvedNote: data.resolvedNote,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
