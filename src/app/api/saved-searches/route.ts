import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce, has } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { createSavedSearchSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "SEARCH_SAVED_VIEW");

    // Users see: their own PRIVATE + TEAM + TENANT searches
    const where: Prisma.SavedSearchWhereInput = {
      tenantId: user.tenantId,
      OR: [
        { createdBy: user.id, visibility: "PRIVATE" },
        { visibility: "TEAM" },
        { visibility: "TENANT" },
      ],
    };

    const searches = await prisma.savedSearch.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      include: { creator: { select: { id: true, name: true } } },
    });

    return NextResponse.json(searches);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "SEARCH_SAVED_CREATE");

    const body = await request.json();
    const input = createSavedSearchSchema.parse(body);

    const saved = await prisma.savedSearch.create({
      data: {
        tenantId: user.tenantId,
        createdBy: user.id,
        name: input.name,
        queryText: input.queryText,
        filtersJson: (input.filtersJson ?? null) as Prisma.JsonObject | null,
        sortJson: (input.sortJson ?? null) as Prisma.JsonObject | null,
        visibility: input.visibility,
        pinned: input.pinned,
      },
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
