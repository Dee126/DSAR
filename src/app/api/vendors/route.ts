import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { createVendorSchema } from "@/lib/validation";
import { createVendor, listVendors } from "@/lib/vendor-service";
import type { VendorStatus } from "@prisma/client";

/**
 * GET /api/vendors — List vendors
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "VENDOR_VIEW");

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as VendorStatus | null;
    const search = searchParams.get("search") || undefined;
    const hasDpa = searchParams.get("hasDpa");

    const vendors = await listVendors(user.tenantId, {
      status: status || undefined,
      search,
      hasDpa: hasDpa !== null ? hasDpa === "true" : undefined,
    });

    return NextResponse.json(vendors);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/vendors — Create vendor
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "VENDOR_MANAGE");

    const body = await request.json();
    const data = createVendorSchema.parse(body);

    const vendor = await createVendor(user.tenantId, data);

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "vendor.created",
      entityType: "Vendor",
      entityId: vendor.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { name: data.name },
    });

    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
