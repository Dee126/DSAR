import { randomInt, createHash } from "crypto";
import { prisma } from "./prisma";
import { recordDeliveryEvent } from "./delivery-event-service";
import { ApiError } from "./errors";

/**
 * Generate a 6-digit numeric OTP.
 */
export function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

/**
 * Hash an OTP using SHA-256.
 */
export function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

interface SendOtpInput {
  linkId: string;
  tenantId: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Generate an OTP, store the hash on the delivery link,
 * and create an outbox-style communication log entry.
 * Returns the raw OTP (for demo/outbox display; in production, sent via email).
 */
export async function sendOtp(input: SendOtpInput) {
  const link = await prisma.deliveryLink.findFirst({
    where: { id: input.linkId, tenantId: input.tenantId, status: "ACTIVE" },
  });
  if (!link) throw new ApiError(404, "Link not found or not active");
  if (!link.otpRequired) throw new ApiError(400, "OTP not required for this link");

  // Check lockout
  if (link.otpLockedUntil && link.otpLockedUntil > new Date()) {
    const remainingMs = link.otpLockedUntil.getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    throw new ApiError(429, `OTP locked. Try again in ${remainingMin} minutes.`);
  }

  const rawOtp = generateOtp();
  const oHash = hashOtp(rawOtp);

  // Load settings for OTP expiry
  const settings = await prisma.deliverySettings.findUnique({
    where: { tenantId: input.tenantId },
  });
  const otpExpiryMinutes = settings?.otpExpiryMinutes ?? 15;

  const otpExpiresAt = new Date();
  otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + otpExpiryMinutes);

  await prisma.deliveryLink.update({
    where: { id: input.linkId },
    data: {
      otpHash: oHash,
      otpExpiresAt,
      otpLastSentAt: new Date(),
      otpAttempts: 0, // Reset attempts on new OTP
      otpLockedUntil: null,
    },
  });

  // Create outbox-style communication log (not real email sending)
  await prisma.communicationLog.create({
    data: {
      tenantId: input.tenantId,
      caseId: link.caseId,
      direction: "OUTBOUND",
      channel: "EMAIL",
      subject: "Your secure delivery verification code",
      body: `Your verification code is: ${rawOtp}\n\nThis code expires in ${otpExpiryMinutes} minutes.\n\n[OUTBOX ONLY — not actually sent]`,
    },
  });

  await recordDeliveryEvent({
    tenantId: input.tenantId,
    caseId: link.caseId,
    deliveryLinkId: input.linkId,
    eventType: "OTP_SENT",
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: { channel: "EMAIL", recipientMasked: link.subjectContact },
  });

  return { sent: true, expiresAt: otpExpiresAt, otp: rawOtp };
}

interface VerifyOtpInput {
  linkId: string;
  tenantId: string;
  otp: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Verify an OTP against the stored hash.
 * Implements rate limiting with lockout after max attempts.
 */
export async function verifyOtp(input: VerifyOtpInput) {
  const link = await prisma.deliveryLink.findFirst({
    where: { id: input.linkId, tenantId: input.tenantId, status: "ACTIVE" },
  });
  if (!link) throw new ApiError(404, "Link not found or not active");

  // Check lockout
  if (link.otpLockedUntil && link.otpLockedUntil > new Date()) {
    const remainingMs = link.otpLockedUntil.getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    throw new ApiError(429, `Too many attempts. Try again in ${remainingMin} minutes.`);
  }

  if (!link.otpHash || !link.otpExpiresAt) {
    throw new ApiError(400, "No OTP has been sent. Request a new code.");
  }

  // Check expiry
  if (link.otpExpiresAt < new Date()) {
    throw new ApiError(400, "OTP has expired. Request a new code.");
  }

  const computedHash = hashOtp(input.otp);
  const isValid = computedHash === link.otpHash;

  if (!isValid) {
    const newAttempts = link.otpAttempts + 1;

    // Load settings for lockout config
    const settings = await prisma.deliverySettings.findUnique({
      where: { tenantId: input.tenantId },
    });
    const maxAttempts = link.otpMaxAttempts;
    const lockoutMinutes = settings?.otpLockoutMinutes ?? 15;

    const shouldLock = newAttempts >= maxAttempts;
    const lockUntil = shouldLock
      ? new Date(Date.now() + lockoutMinutes * 60 * 1000)
      : null;

    await prisma.deliveryLink.update({
      where: { id: input.linkId },
      data: {
        otpAttempts: newAttempts,
        ...(shouldLock ? { otpLockedUntil: lockUntil } : {}),
      },
    });

    await recordDeliveryEvent({
      tenantId: input.tenantId,
      caseId: link.caseId,
      deliveryLinkId: input.linkId,
      eventType: "OTP_FAILED",
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: {
        attempt: newAttempts,
        locked: shouldLock,
      },
    });

    if (shouldLock) {
      throw new ApiError(429, `Too many failed attempts. Locked for ${lockoutMinutes} minutes.`);
    }

    throw new ApiError(400, `Invalid code. ${maxAttempts - newAttempts} attempts remaining.`);
  }

  // OTP valid — clear OTP state
  await prisma.deliveryLink.update({
    where: { id: input.linkId },
    data: {
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      otpLockedUntil: null,
    },
  });

  await recordDeliveryEvent({
    tenantId: input.tenantId,
    caseId: link.caseId,
    deliveryLinkId: input.linkId,
    eventType: "OTP_VERIFIED",
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return { verified: true };
}
