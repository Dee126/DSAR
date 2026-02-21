import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/findings/[id]
 *
 * Returns full finding detail including evidence items, metadata, and related tasks.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "read");

    const finding = await prisma.finding.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      include: {
        system: {
          select: { id: true, name: true, description: true, criticality: true },
        },
        run: {
          select: {
            id: true,
            status: true,
            case: {
              select: {
                id: true,
                caseNumber: true,
                dataSubject: {
                  select: { id: true, fullName: true },
                },
              },
            },
          },
        },
        statusChangedBy: {
          select: { id: true, name: true, email: true },
        },
        mitigationTasks: {
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            createdAt: true,
            assignee: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!finding) {
      throw new ApiError(404, "Finding not found");
    }

    // Fetch referenced evidence items
    let evidenceItems: Array<{
      id: string;
      location: string;
      title: string;
      itemType: string;
      provider: string;
      workload: string | null;
      sensitivityScore: number | null;
      metadata: unknown;
      createdAtSource: Date | null;
    }> = [];
    if (finding.evidenceItemIds.length > 0) {
      evidenceItems = await prisma.evidenceItem.findMany({
        where: {
          id: { in: finding.evidenceItemIds },
          tenantId: user.tenantId,
        },
        select: {
          id: true,
          location: true,
          title: true,
          itemType: true,
          provider: true,
          workload: true,
          sensitivityScore: true,
          metadata: true,
          createdAtSource: true,
        },
      });
    }

    return NextResponse.json({ ...finding, evidenceItems });
  } catch (error) {
    return handleApiError(error);
  }
}
