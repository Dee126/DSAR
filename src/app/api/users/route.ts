import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { createUserSchema } from "@/lib/validation";
import { hash } from "bcryptjs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "users", "read");

    const users = await prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "users", "create");

    const body = await request.json();
    const data = createUserSchema.parse(body);

    // Check email uniqueness within tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        tenantId: user.tenantId,
        email: data.email,
      },
    });

    if (existingUser) {
      throw new ApiError(409, "A user with this email already exists in your organization");
    }

    const passwordHash = await hash(data.password, 12);

    const newUser = await prisma.user.create({
      data: {
        tenantId: user.tenantId,
        email: data.email,
        name: data.name,
        passwordHash,
        role: data.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "user.created",
      entityType: "User",
      entityId: newUser.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
