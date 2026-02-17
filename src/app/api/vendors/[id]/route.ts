import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import {
  updateVendorSchema,
  createVendorContactSchema,
  createVendorDpaSchema,
  createVendorSlaConfigSchema,
  createVendorEscalationSchema,
} from "@/lib/validation";
import {
  getVendor,
  updateVendor,
  addVendorContact,
  removeVendorContact,
  addVendorDpa,
  upsertVendorSlaConfig,
} from "@/lib/vendor-service";
import {
  createVendorEscalation,
  acknowledgeEscalation,
  resolveEscalation,
} from "@/lib/vendor-request-service";

/**
 * GET /api/vendors/[id] — Get vendor detail
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "VENDOR_VIEW");

    const vendor = await getVendor(user.tenantId, params.id);
    if (!vendor) throw new ApiError(404, "Vendor not found");

    return NextResponse.json(vendor);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/vendors/[id] — Update vendor
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "VENDOR_MANAGE");

    const body = await request.json();
    const data = updateVendorSchema.parse(body);

    const vendor = await updateVendor(user.tenantId, params.id, data);

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "vendor.updated",
      entityType: "Vendor",
      entityId: params.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: data,
    });

    return NextResponse.json(vendor);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/vendors/[id] — Sub-resource actions
 * Body: { action: "add_contact" | "remove_contact" | "add_dpa" | "set_sla" | "escalate" | "ack_escalation" | "resolve_escalation", ...data }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    const clientInfo = getClientInfo(request);
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case "add_contact": {
        enforce(user.role, "VENDOR_MANAGE");
        const data = createVendorContactSchema.parse(body);
        const contact = await addVendorContact(user.tenantId, params.id, data);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "vendor.contact_added",
          entityType: "VendorContact",
          entityId: contact.id,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { vendorId: params.id, name: data.name, email: data.email },
        });

        return NextResponse.json(contact, { status: 201 });
      }

      case "remove_contact": {
        enforce(user.role, "VENDOR_MANAGE");
        const contactId = body.contactId as string;
        if (!contactId) throw new ApiError(400, "contactId is required");

        await removeVendorContact(user.tenantId, contactId);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "vendor.contact_removed",
          entityType: "VendorContact",
          entityId: contactId,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { vendorId: params.id },
        });

        return NextResponse.json({ success: true });
      }

      case "add_dpa": {
        enforce(user.role, "VENDOR_MANAGE");
        const data = createVendorDpaSchema.parse(body);
        const dpa = await addVendorDpa(user.tenantId, params.id, data);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "vendor.dpa_added",
          entityType: "VendorDpa",
          entityId: dpa.id,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { vendorId: params.id, title: data.title },
        });

        return NextResponse.json(dpa, { status: 201 });
      }

      case "set_sla": {
        enforce(user.role, "VENDOR_MANAGE");
        const data = createVendorSlaConfigSchema.parse(body);
        const sla = await upsertVendorSlaConfig(user.tenantId, params.id, data);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "vendor.sla_updated",
          entityType: "VendorSlaConfig",
          entityId: sla.id,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { vendorId: params.id, ...data },
        });

        return NextResponse.json(sla);
      }

      case "escalate": {
        enforce(user.role, "VENDOR_ESCALATION_MANAGE");
        const data = createVendorEscalationSchema.parse({ ...body, vendorId: params.id });
        const escalation = await createVendorEscalation(user.tenantId, user.id, data);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "vendor.escalation_created",
          entityType: "VendorEscalation",
          entityId: escalation.id,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { vendorId: params.id, severity: data.severity, reason: data.reason },
        });

        return NextResponse.json(escalation, { status: 201 });
      }

      case "ack_escalation": {
        enforce(user.role, "VENDOR_ESCALATION_MANAGE");
        const escalationId = body.escalationId as string;
        if (!escalationId) throw new ApiError(400, "escalationId is required");

        const esc = await acknowledgeEscalation(user.tenantId, escalationId);
        return NextResponse.json(esc);
      }

      case "resolve_escalation": {
        enforce(user.role, "VENDOR_ESCALATION_MANAGE");
        const escalationId = body.escalationId as string;
        if (!escalationId) throw new ApiError(400, "escalationId is required");

        const esc = await resolveEscalation(user.tenantId, escalationId);
        return NextResponse.json(esc);
      }

      default:
        throw new ApiError(400, `Unknown action: ${action}`);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
