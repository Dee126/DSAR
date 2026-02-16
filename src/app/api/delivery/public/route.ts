import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ApiError } from "@/lib/errors";
import { validateToken, consumeDownload } from "@/lib/delivery-link-service";
import { sendOtp, verifyOtp } from "@/lib/delivery-otp-service";
import { recordDeliveryEvent } from "@/lib/delivery-event-service";
import { verifyDeliveryOtpSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

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
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as string;
    const token = body.token as string;
    const { ip, userAgent } = getPublicClientInfo(request);

    if (!token) {
      throw new ApiError(400, "Token is required");
    }

    switch (action) {
      case "validate": {
        // Validate token and return link info (minimal, no internal details)
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
            ? false // OTP not yet sent/verified
            : !link.otpHash, // if otpHash is null, it was verified (cleared on success)
          language: link.language,
          subjectContact: link.subjectContact,
          expiresAt: link.expiresAt,
          maxDownloads: link.maxDownloads,
          usedDownloads: link.usedDownloads,
        });
      }

      case "send_otp": {
        const link = await validateToken(token);

        const result = await sendOtp({
          linkId: link.id,
          tenantId: link.tenantId,
          ip,
          userAgent,
        });

        return NextResponse.json({
          success: true,
          expiresAt: result.expiresAt,
          contactMasked: link.subjectContact,
          // In dev, return OTP for testing
          otp: process.env.NODE_ENV !== "production" ? result.otp : undefined,
        });
      }

      case "verify_otp": {
        const link = await validateToken(token);
        const data = verifyDeliveryOtpSchema.parse(body);

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
        // Return the package manifest (list of downloadable files)
        const link = await validateToken(token);

        // If OTP is required and not yet verified, deny access
        if (link.otpRequired && link.otpHash) {
          throw new ApiError(403, "OTP verification required");
        }

        // Fetch package details
        if (!link.packageId) {
          throw new ApiError(404, "No package associated with this link");
        }

        const pkg = await prisma.deliveryPackage.findFirst({
          where: { id: link.packageId, tenantId: link.tenantId },
        });

        if (!pkg) {
          throw new ApiError(404, "Package not found");
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
        // Consume a download and return file info
        const link = await validateToken(token);

        if (link.otpRequired && link.otpHash) {
          throw new ApiError(403, "OTP verification required");
        }

        const fileId = body.fileId as string;
        const fileSource = body.fileSource as string; // "response" or "evidence"

        if (!fileId || !fileSource) {
          throw new ApiError(400, "fileId and fileSource are required");
        }

        // Consume download counter
        await consumeDownload(link.id, link.tenantId, link.caseId, ip, userAgent, {
          type: "file",
          fileId,
          fileSource,
        });

        // Get the actual file info based on source
        if (fileSource === "response") {
          const doc = await prisma.responseDocument.findFirst({
            where: { id: fileId, tenantId: link.tenantId, caseId: link.caseId },
            select: {
              id: true,
              version: true,
              language: true,
              fullHtml: true,
              storageKeyPdf: true,
              storageKeyDocx: true,
            },
          });
          if (!doc) throw new ApiError(404, "Document not found");

          return NextResponse.json({
            success: true,
            file: {
              id: doc.id,
              type: "response",
              storageKeyPdf: doc.storageKeyPdf,
              storageKeyDocx: doc.storageKeyDocx,
              htmlAvailable: !!doc.fullHtml,
            },
          });
        } else if (fileSource === "evidence") {
          const doc = await prisma.document.findFirst({
            where: { id: fileId, tenantId: link.tenantId, caseId: link.caseId, deletedAt: null },
            select: {
              id: true,
              filename: true,
              contentType: true,
              storageKey: true,
              size: true,
            },
          });
          if (!doc) throw new ApiError(404, "Document not found");

          return NextResponse.json({
            success: true,
            file: {
              id: doc.id,
              type: "evidence",
              filename: doc.filename,
              contentType: doc.contentType,
              storageKey: doc.storageKey,
              size: doc.size,
            },
          });
        }

        throw new ApiError(400, "Invalid fileSource");
      }

      default:
        throw new ApiError(400, `Unknown action: ${action}`);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
