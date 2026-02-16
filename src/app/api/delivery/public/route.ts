import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ApiError } from "@/lib/errors";
import { validateToken, consumeDownload } from "@/lib/delivery-link-service";
import { sendOtp, verifyOtp } from "@/lib/delivery-otp-service";
import { recordDeliveryEvent } from "@/lib/delivery-event-service";
import { verifyDeliveryOtpSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  hashIpForRateLimit,
  rateKey,
  RATE_LIMITS,
} from "@/lib/security/rate-limiter";

function getPublicClientInfo(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  return { ip, userAgent };
}

/**
 * POST /api/delivery/public
 * Public endpoint (no auth required) for delivery portal operations.
 * Actions: validate, send_otp, verify_otp, download
 *
 * Sprint 9.2 Hardening:
 * - Invalid/expired tokens → 404 (no information leakage)
 * - Rate limiting on OTP send/verify
 * - No OTP in response (removed dev-mode disclosure)
 * - Storage keys never exposed to client
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as string;
    const token = body.token as string;
    const { ip, userAgent } = getPublicClientInfo(request);

    if (!token) {
      // Sprint 9.2: Return 404 for missing token — no info leakage
      throw new ApiError(404, "Not found");
    }

    // Sprint 9.2: General rate limit for all public portal actions
    const ipHash = hashIpForRateLimit(ip);
    checkRateLimit("delivery_public", ipHash, RATE_LIMITS.PUBLIC_GENERAL);

    switch (action) {
      case "validate": {
        // Sprint 9.2: Invalid token → 404 (validateToken already throws 404)
        const link = await validateToken(token);

        // Record portal view event
        await recordDeliveryEvent({
          tenantId: link.tenantId,
          caseId: link.caseId,
          deliveryLinkId: link.id,
          eventType: "PORTAL_VIEWED",
          ip,
          userAgent,
        });

        return NextResponse.json({
          valid: true,
          linkId: link.id,
          otpRequired: link.otpRequired,
          otpVerified: !link.otpRequired || (!link.otpHash && link.otpAttempts === 0 && !link.otpExpiresAt)
            ? false
            : !link.otpHash,
          language: link.language,
          subjectContact: link.subjectContact,
          expiresAt: link.expiresAt,
          maxDownloads: link.maxDownloads,
          usedDownloads: link.usedDownloads,
        });
      }

      case "send_otp": {
        const link = await validateToken(token);

        // Sprint 9.2: Rate limit OTP sends per link
        checkRateLimit("otp_send", link.id, RATE_LIMITS.OTP_SEND);

        const result = await sendOtp({
          linkId: link.id,
          tenantId: link.tenantId,
          ip,
          userAgent,
        });

        // Sprint 9.2: NEVER return OTP in response — removed dev mode disclosure
        return NextResponse.json({
          success: true,
          expiresAt: result.expiresAt,
          contactMasked: link.subjectContact,
        });
      }

      case "verify_otp": {
        const link = await validateToken(token);
        const data = verifyDeliveryOtpSchema.parse(body);

        // Sprint 9.2: Rate limit OTP verify attempts per link
        checkRateLimit("otp_verify", link.id, RATE_LIMITS.OTP_VERIFY);

        const result = await verifyOtp({
          linkId: link.id,
          tenantId: link.tenantId,
          otp: data.otp,
          ip,
          userAgent,
        });

        return NextResponse.json({ verified: result.verified });
      }

      case "get_package": {
        const link = await validateToken(token);

        if (link.otpRequired && link.otpHash) {
          // Sprint 9.2: Return 404 instead of 403 — no info leakage
          throw new ApiError(404, "Not found");
        }

        if (!link.packageId) {
          throw new ApiError(404, "Not found");
        }

        const pkg = await prisma.deliveryPackage.findFirst({
          where: { id: link.packageId, tenantId: link.tenantId },
        });

        if (!pkg) {
          throw new ApiError(404, "Not found");
        }

        const manifest = pkg.manifestJson as any;

        return NextResponse.json({
          packageId: pkg.id,
          generatedAt: pkg.generatedAt,
          checksum: pkg.checksumSha256,
          files: manifest?.files ?? [],
          downloadsRemaining: link.maxDownloads - link.usedDownloads,
        });
      }

      case "download": {
        const link = await validateToken(token);

        if (link.otpRequired && link.otpHash) {
          throw new ApiError(404, "Not found");
        }

        const fileId = body.fileId as string;
        const fileSource = body.fileSource as string;

        if (!fileId || !fileSource) {
          throw new ApiError(400, "fileId and fileSource are required");
        }

        // Sprint 9.2: Validate fileSource strictly
        if (fileSource !== "response" && fileSource !== "evidence") {
          throw new ApiError(400, "Invalid fileSource");
        }

        // Consume download counter
        await consumeDownload(link.id, link.tenantId, link.caseId, ip, userAgent, {
          type: "file",
          fileId,
          fileSource,
        });

        // Sprint 9.2: Only return metadata, never storage keys
        if (fileSource === "response") {
          const doc = await prisma.responseDocument.findFirst({
            where: { id: fileId, tenantId: link.tenantId, caseId: link.caseId },
            select: {
              id: true,
              version: true,
              language: true,
              fullHtml: true,
            },
          });
          if (!doc) throw new ApiError(404, "Not found");

          return NextResponse.json({
            success: true,
            file: {
              id: doc.id,
              type: "response",
              htmlAvailable: !!doc.fullHtml,
            },
          });
        } else {
          const doc = await prisma.document.findFirst({
            where: { id: fileId, tenantId: link.tenantId, caseId: link.caseId, deletedAt: null },
            select: {
              id: true,
              filename: true,
              contentType: true,
              size: true,
            },
          });
          if (!doc) throw new ApiError(404, "Not found");

          return NextResponse.json({
            success: true,
            file: {
              id: doc.id,
              type: "evidence",
              filename: doc.filename,
              contentType: doc.contentType,
              size: doc.size,
            },
          });
        }
      }

      default:
        throw new ApiError(400, `Unknown action: ${action}`);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
