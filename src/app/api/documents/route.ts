import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "documents", "read");

    const documents = await prisma.document.findMany({
      where: { tenantId: user.tenantId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
        case: {
          select: { id: true, caseNumber: true },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json({ data: documents });
  } catch (error) {
    return handleApiError(error);
  }
}
