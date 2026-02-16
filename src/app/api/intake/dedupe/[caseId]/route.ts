import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "read");

    const candidates = await prisma.dedupeCandidate.findMany({
      where: {
        tenantId: user.tenantId,
        caseId: params.caseId,
      },
      include: {
        candidateCase: {
          select: {
            id: true,
            caseNumber: true,
            status: true,
            type: true,
            createdAt: true,
            dataSubject: {
              select: { fullName: true, email: true },
            },
          },
        },
      },
      orderBy: { score: "desc" },
    });

    return NextResponse.json({ data: candidates });
  } catch (error) {
    return handleApiError(error);
  }
}
