import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce, has } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { updateSavedSearchSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "SEARCH_SAVED_VIEW");

    const saved = await prisma.savedSearch.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      include: { creator: { select: { id: true, name: true } } },
    });

    if (!saved) throw new ApiError(404, "Saved search not found");

    // Check visibility access
    if (saved.visibility === "PRIVATE" && saved.createdBy !== user.id) {
      throw new ApiError(403, "Not authorized to view this saved search");
    }

    return NextResponse.json(saved);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "SEARCH_SAVED_CREATE");

    const existing = await prisma.savedSearch.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });

    if (!existing) throw new ApiError(404, "Saved search not found");

    // Only creator or managers can edit
    if (existing.createdBy !== user.id && !has(user.role, "SEARCH_SAVED_MANAGE")) {
      throw new ApiError(403, "Not authorized to edit this saved search");
    }

    const body = await request.json();
    const input = updateSavedSearchSchema.parse(body);

    const updated = await prisma.savedSearch.update({
      where: { id: params.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.queryText !== undefined && { queryText: input.queryText }),
        ...(input.filtersJson !== undefined && { filtersJson: input.filtersJson as Prisma.JsonObject }),
        ...(input.sortJson !== undefined && { sortJson: input.sortJson as Prisma.JsonObject }),
        ...(input.visibility !== undefined && { visibility: input.visibility }),
        ...(input.pinned !== undefined && { pinned: input.pinned }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "SEARCH_SAVED_CREATE");

    const existing = await prisma.savedSearch.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });

    if (!existing) throw new ApiError(404, "Saved search not found");

    if (existing.createdBy !== user.id && !has(user.role, "SEARCH_SAVED_MANAGE")) {
      throw new ApiError(403, "Not authorized to delete this saved search");
    }

    await prisma.savedSearch.delete({ where: { id: params.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
