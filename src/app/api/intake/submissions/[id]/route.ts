import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";
import { ApiError } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "read");

    const submission = await prisma.intakeSubmission.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      include: {
        attachments: true,
        emailIngestEvent: true,
        case: {
          select: { id: true, caseNumber: true, status: true },
        },
      },
    });

    if (!submission) {
      throw new ApiError(404, "Submission not found");
    }

    return NextResponse.json(submission);
  } catch (error) {
    return handleApiError(error);
  }
}
