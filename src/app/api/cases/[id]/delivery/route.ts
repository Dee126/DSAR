import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { getClientInfo } from "@/lib/audit";
import {
  createDeliveryPackageSchema,
  createDeliveryLinkSchema,
  revokeDeliveryLinkSchema,
} from "@/lib/validation";
import { buildDeliveryPackage, getDeliveryPackages } from "@/lib/delivery-package-service";
import { createDeliveryLink, revokeDeliveryLink, getDeliveryLinks } from "@/lib/delivery-link-service";
import { sendOtp } from "@/lib/delivery-otp-service";
import { getDeliveryEvents } from "@/lib/delivery-event-service";

/**
 * GET /api/cases/[id]/delivery
 * Returns delivery packages, links, and events for a case.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "DELIVERY_VIEW");
    const { id: caseId } = await params;

    const [packages, links, events] = await Promise.all([
      getDeliveryPackages(user.tenantId, caseId),
      getDeliveryLinks(user.tenantId, caseId),
      getDeliveryEvents(user.tenantId, caseId),
    ]);

    return NextResponse.json({ packages, links, events });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/cases/[id]/delivery
 * Actions: create_package, create_link, revoke_link, resend_otp
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: caseId } = await params;
    const body = await request.json();
    const { ip, userAgent } = getClientInfo(request);
    const action = body.action as string;

    switch (action) {
      case "create_package": {
        enforce(user.role, "DELIVERY_CREATE_PACKAGE");
        const data = createDeliveryPackageSchema.parse(body);
        const pkg = await buildDeliveryPackage({
          tenantId: user.tenantId,
          caseId,
          generatedByUserId: user.id,
          responseDocIds: data.responseDocIds,
          documentIds: data.documentIds,
        });
        return NextResponse.json({ success: true, package: pkg }, { status: 201 });
      }

      case "create_link": {
        enforce(user.role, "DELIVERY_CREATE_LINK");
        const data = createDeliveryLinkSchema.parse(body);
        const { link, rawToken } = await createDeliveryLink({
          tenantId: user.tenantId,
          caseId,
          createdByUserId: user.id,
          recipientEmail: data.recipientEmail,
          packageId: data.packageId,
          expiresDays: data.expiresDays,
          otpRequired: data.otpRequired,
          maxDownloads: data.maxDownloads,
          language: data.language,
          ip,
          userAgent,
        });

        return NextResponse.json(
          {
            success: true,
            link: {
              id: link.id,
              status: link.status,
              expiresAt: link.expiresAt,
              maxDownloads: link.maxDownloads,
              otpRequired: link.otpRequired,
              subjectContact: link.subjectContact,
            },
            // Raw token shown ONCE — must be copied now
            token: rawToken,
            portalUrl: `/public/${user.tenantId}/delivery/${rawToken}`,
          },
          { status: 201 }
        );
      }

      case "revoke_link": {
        enforce(user.role, "DELIVERY_REVOKE_LINK");
        const data = revokeDeliveryLinkSchema.parse(body);
        const linkId = body.linkId as string;
        if (!linkId) {
          return NextResponse.json({ error: "linkId is required" }, { status: 400 });
        }
        const link = await revokeDeliveryLink(
          user.tenantId,
          linkId,
          user.id,
          data.reason,
          ip,
          userAgent
        );
        return NextResponse.json({ success: true, link });
      }

      case "resend_otp": {
        enforce(user.role, "DELIVERY_CREATE_LINK");
        const linkId = body.linkId as string;
        if (!linkId) {
          return NextResponse.json({ error: "linkId is required" }, { status: 400 });
        }
        const result = await sendOtp({
          linkId,
          tenantId: user.tenantId,
          ip,
          userAgent,
        });
        return NextResponse.json({
          success: true,
          expiresAt: result.expiresAt,
          // In production, OTP is sent via email.
          // For dev/demo, include it in response.
          otp: process.env.NODE_ENV !== "production" ? result.otp : undefined,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
