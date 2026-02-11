import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "read");

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search");

    const where: Prisma.DataSubjectWhereInput = {
      tenantId: user.tenantId,
    };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const dataSubjects = await prisma.dataSubject.findMany({
      where,
      orderBy: { fullName: "asc" },
      take: 50,
    });

    return NextResponse.json(dataSubjects);
  } catch (error) {
    return handleApiError(error);
  }
}
