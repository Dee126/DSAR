export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError, ApiError } from "@/lib/errors";
import { createHolidaySchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/holidays
 * Returns holidays for the tenant.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    enforce(user.role, "SLA_CONFIG_VIEW");

    const holidays = await prisma.holiday.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(holidays);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/holidays
 * Add a holiday.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "SLA_CONFIG_EDIT");

    const body = await request.json();
    const data = createHolidaySchema.parse(body);

    const holiday = await prisma.holiday.create({
      data: {
        tenantId: user.tenantId,
        date: new Date(data.date),
        name: data.name,
        locale: data.locale,
      },
    });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "HOLIDAY_CREATED",
      entityType: "Holiday",
      entityId: holiday.id,
      ip,
      userAgent,
      details: { date: data.date, name: data.name },
    });

    return NextResponse.json(holiday, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/holidays
 * Remove a holiday by id query param.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "SLA_CONFIG_EDIT");

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) throw new ApiError(400, "id query parameter required");

    const existing = await prisma.holiday.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new ApiError(404, "Holiday not found");

    await prisma.holiday.delete({ where: { id } });

    const { ip, userAgent } = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "HOLIDAY_DELETED",
      entityType: "Holiday",
      entityId: id,
      ip,
      userAgent,
      details: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
