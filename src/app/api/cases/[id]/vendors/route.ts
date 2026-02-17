export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import {
  createVendorRequestSchema,
  updateVendorRequestSchema,
  sendVendorRequestSchema,
  createVendorResponseSchema,
  updateVendorRequestItemSchema,
} from "@/lib/validation";
import {
  deriveVendorsForCase,
  autoCreateVendorRequests,
  getVendorRequestSummaryForCase,
} from "@/lib/vendor-derivation-service";
import {
  createVendorRequest,
  getVendorRequest,
  updateVendorRequest,
  sendVendorRequest,
  updateVendorRequestItem,
  addVendorResponse,
  listVendorRequestsForCase,
} from "@/lib/vendor-request-service";

/**
 * GET /api/cases/[id]/vendors — Get vendor involvement for a case
 * Query: ?view=derive | requests | detail&requestId=xxx
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "VENDOR_REQUEST_VIEW");

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "requests";

    switch (view) {
      case "derive": {
        const derived = await deriveVendorsForCase(user.tenantId, params.id);
        return NextResponse.json(derived);
      }

      case "detail": {
        const requestId = searchParams.get("requestId");
        if (!requestId) throw new ApiError(400, "requestId required for detail view");
        const detail = await getVendorRequest(user.tenantId, requestId);
        if (!detail) throw new ApiError(404, "Vendor request not found");
        return NextResponse.json(detail);
      }

      case "summary": {
        const summary = await getVendorRequestSummaryForCase(user.tenantId, params.id);
        return NextResponse.json(summary);
      }

      case "requests":
      default: {
        const requests = await listVendorRequestsForCase(user.tenantId, params.id);
        return NextResponse.json(requests);
      }
    }
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/cases/[id]/vendors — Vendor request actions
 * Body: { action: "create" | "auto_derive" | "update" | "send" | "add_response" | "update_item", ...data }
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
      case "create": {
        enforce(user.role, "VENDOR_REQUEST_CREATE");
        const data = createVendorRequestSchema.parse(body);

        const req = await createVendorRequest(user.tenantId, params.id, user.id, {
          vendorId: data.vendorId,
          systemId: data.systemId,
          templateId: data.templateId,
          subject: data.subject,
          bodyHtml: data.bodyHtml,
          dueAt: data.dueAt,
          items: data.items,
        });

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "vendor.request_created",
          entityType: "VendorRequest",
          entityId: req.id,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { caseId: params.id, vendorId: data.vendorId },
        });

        return NextResponse.json(req, { status: 201 });
      }

      case "auto_derive": {
        enforce(user.role, "VENDOR_REQUEST_CREATE");
        const templateId = body.templateId as string | undefined;
        const dueDays = body.dueDays as number | undefined;

        const requestIds = await autoCreateVendorRequests(
          user.tenantId,
          params.id,
          user.id,
          { templateId, dueDays },
        );

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "vendor.auto_derived",
          entityType: "VendorRequest",
          entityId: null,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { caseId: params.id, requestCount: requestIds.length },
        });

        return NextResponse.json({ requestIds, count: requestIds.length }, { status: 201 });
      }

      case "update": {
        enforce(user.role, "VENDOR_REQUEST_SEND");
        const requestId = body.requestId as string;
        if (!requestId) throw new ApiError(400, "requestId is required");

        const data = updateVendorRequestSchema.parse(body);
        const req = await updateVendorRequest(user.tenantId, requestId, data);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "vendor.request_updated",
          entityType: "VendorRequest",
          entityId: requestId,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { caseId: params.id, ...data },
        });

        return NextResponse.json(req);
      }

      case "send": {
        enforce(user.role, "VENDOR_REQUEST_SEND");
        const requestId = body.requestId as string;
        if (!requestId) throw new ApiError(400, "requestId is required");

        if (body.recipientEmail) {
          sendVendorRequestSchema.parse(body);
        }

        const req = await sendVendorRequest(user.tenantId, requestId);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "vendor.request_sent",
          entityType: "VendorRequest",
          entityId: requestId,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { caseId: params.id, vendorName: req.vendor.name },
        });

        return NextResponse.json(req);
      }

      case "add_response": {
        enforce(user.role, "VENDOR_RESPONSE_LOG");
        const data = createVendorResponseSchema.parse(body);

        const response = await addVendorResponse(user.tenantId, user.id, data);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "vendor.response_logged",
          entityType: "VendorResponse",
          entityId: response.id,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { caseId: params.id, requestId: data.requestId, responseType: data.responseType },
        });

        return NextResponse.json(response, { status: 201 });
      }

      case "update_item": {
        enforce(user.role, "VENDOR_REQUEST_SEND");
        const itemId = body.itemId as string;
        if (!itemId) throw new ApiError(400, "itemId is required");

        const data = updateVendorRequestItemSchema.parse(body);
        const item = await updateVendorRequestItem(user.tenantId, itemId, data);

        return NextResponse.json(item);
      }

      default:
        throw new ApiError(400, `Unknown action: ${action}`);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
