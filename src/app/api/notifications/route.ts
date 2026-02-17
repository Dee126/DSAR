export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/notifications
 * Returns notifications for the current user.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "NOTIFICATIONS_VIEW");

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = parseInt(searchParams.get("limit") ?? "30", 10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      tenantId: user.tenantId,
      recipientUserId: user.id,
    };
    if (unreadOnly) where.read = false;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: {
          tenantId: user.tenantId,
          recipientUserId: user.id,
          read: false,
        },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/notifications
 * Mark notifications as read. Body: { ids: string[] } or { all: true }
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "NOTIFICATIONS_VIEW");

    const body = await request.json();

    if (body.all === true) {
      await prisma.notification.updateMany({
        where: {
          tenantId: user.tenantId,
          recipientUserId: user.id,
          read: false,
        },
        data: { read: true, readAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    const ids = body.ids as string[];
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, "Provide ids array or { all: true }");
    }

    await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        tenantId: user.tenantId,
        recipientUserId: user.id,
      },
      data: { read: true, readAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
