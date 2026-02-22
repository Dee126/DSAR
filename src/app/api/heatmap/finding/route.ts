export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/heatmap/finding?id=...
 *
 * Returns full detail for a single finding, including evidence items
 * and mitigation tasks.
 * Stable DTO — returns 404 if not found (never crashes on empty DB).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "data_inventory", "read");

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      throw new ApiError(400, "id query parameter is required");
    }

    const finding = await prisma.finding.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        system: {
          select: {
            id: true,
            name: true,
            description: true,
            criticality: true,
          },
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
