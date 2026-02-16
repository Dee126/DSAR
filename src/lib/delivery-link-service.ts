import { randomBytes, createHash } from "crypto";
import { prisma } from "./prisma";
import { recordDeliveryEvent } from "./delivery-event-service";
import { ApiError } from "./errors";

/**
 * Generate a cryptographically random token (URL-safe base64).
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Hash a token with a salt using SHA-256.
 */
export function hashToken(token: string, salt: string): string {
  return createHash("sha256").update(token + salt).digest("hex");
}

/**
 * Mask an email address for display: jo***@example.com
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

interface CreateLinkInput {
  tenantId: string;
  caseId: string;
  createdByUserId: string;
  recipientEmail: string;
  packageId: string;
  expiresDays?: number;
  otpRequired?: boolean;
  maxDownloads?: number;
  language?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Creates a new delivery link with a hashed token.
 * Returns the raw token ONCE — it cannot be recovered later.
 */
export async function createDeliveryLink(input: CreateLinkInput) {
  // Load tenant delivery settings for defaults
  const settings = await prisma.deliverySettings.findUnique({
    where: { tenantId: input.tenantId },
  });

  const expiresDays = input.expiresDays ?? settings?.defaultExpiresDays ?? 7;
  const otpRequired = input.otpRequired ?? settings?.otpRequiredDefault ?? true;
  const maxDownloads = input.maxDownloads ?? settings?.maxDownloadsDefault ?? 3;
  const otpMaxAttempts = settings?.otpMaxAttempts ?? 5;

  const rawToken = generateToken();
  const salt = randomBytes(16).toString("hex");
  const tokenHash = hashToken(rawToken, salt);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresDays);

  const link = await prisma.deliveryLink.create({
    data: {
      tenantId: input.tenantId,
      caseId: input.caseId,
      createdByUserId: input.createdByUserId,
      tokenHash,
      tokenSalt: salt,
      expiresAt,
      maxDownloads,
      otpRequired,
      otpMaxAttempts,
      subjectContact: maskEmail(input.recipientEmail),
      recipientEmail: input.recipientEmail,
      language: input.language ?? "en",
      packageId: input.packageId,
    },
  });

  await recordDeliveryEvent({
    tenantId: input.tenantId,
    caseId: input.caseId,
    deliveryLinkId: link.id,
    eventType: "LINK_CREATED",
    ip: input.ip,
    userAgent: input.userAgent,
    actorUserId: input.createdByUserId,
    metadata: {
      expiresAt: expiresAt.toISOString(),
      otpRequired,
      maxDownloads,
    },
  });

  return { link, rawToken };
}

/**
 * Revoke a delivery link.
 */
export async function revokeDeliveryLink(
  tenantId: string,
  linkId: string,
  revokedByUserId: string,
  reason: string,
  ip?: string,
  userAgent?: string
) {
  const link = await prisma.deliveryLink.findFirst({
    where: { id: linkId, tenantId },
  });
  if (!link) throw new ApiError(404, "Delivery link not found");
  if (link.status !== "ACTIVE") throw new ApiError(400, "Link is not active");

  const updated = await prisma.deliveryLink.update({
    where: { id: linkId },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      revokedByUserId,
    },
  });

  await recordDeliveryEvent({
    tenantId,
    caseId: link.caseId,
    deliveryLinkId: linkId,
    eventType: "LINK_REVOKED",
    ip,
    userAgent,
    actorUserId: revokedByUserId,
    metadata: { reason },
  });

  return updated;
}

/**
 * Validate a raw token from the public portal.
 * Returns the link record if valid; throws ApiError otherwise.
 */
export async function validateToken(rawToken: string) {
  // We need to find the link by trying all active links — but since tokens
  // are salted per-link, we must iterate. For efficiency, we index on tokenHash
  // but each has a unique salt, so we need to fetch all ACTIVE links and check.
  //
  // Optimization: We store the first 8 chars of the hash as a prefix hint
  // in the token itself: token = prefix + rawSecret
  // Actually, simpler: just find all active links and try hashing.
  //
  // Better approach: Store the salt in the token URL:
  //   URL = /delivery/{salt}:{rawToken}
  // Then we can compute hash = sha256(rawToken + salt) and look up directly.
  //
  // For now, we search all active links since volume is small per tenant.
  // In production you'd use the salt-prefixed approach.

  const activeLinks = await prisma.deliveryLink.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
    },
    include: {
      package: true,
    },
  });

  for (const link of activeLinks) {
    const computed = hashToken(rawToken, link.tokenSalt);
    if (computed === link.tokenHash) {
      return link;
    }
  }

  throw new ApiError(404, "Invalid or expired link");
}

/**
 * Consume a download: increment counter and expire if max reached.
 */
export async function consumeDownload(
  linkId: string,
  tenantId: string,
  caseId: string,
  ip?: string,
  userAgent?: string,
  metadata?: Record<string, unknown>
) {
  const link = await prisma.deliveryLink.findFirst({
    where: { id: linkId, tenantId, status: "ACTIVE" },
  });
  if (!link) throw new ApiError(404, "Link not found or not active");

  if (link.usedDownloads >= link.maxDownloads) {
    // Auto-expire
    await prisma.deliveryLink.update({
      where: { id: linkId },
      data: { status: "EXPIRED" },
    });
    await recordDeliveryEvent({
      tenantId,
      caseId,
      deliveryLinkId: linkId,
      eventType: "LINK_EXPIRED",
      ip,
      userAgent,
      metadata: { reason: "max_downloads_reached" },
    });
    throw new ApiError(410, "Download limit reached");
  }

  const newCount = link.usedDownloads + 1;
  const shouldExpire = newCount >= link.maxDownloads;

  await prisma.deliveryLink.update({
    where: { id: linkId },
    data: {
      usedDownloads: newCount,
      ...(shouldExpire ? { status: "EXPIRED" } : {}),
    },
  });

  await recordDeliveryEvent({
    tenantId,
    caseId,
    deliveryLinkId: linkId,
    eventType: metadata?.type === "file" ? "FILE_DOWNLOADED" : "PACKAGE_DOWNLOADED",
    ip,
    userAgent,
    metadata: { downloadNumber: newCount, ...metadata },
  });

  return { usedDownloads: newCount, maxDownloads: link.maxDownloads };
}

/**
 * Get all delivery links for a case (internal view).
 */
export async function getDeliveryLinks(tenantId: string, caseId: string) {
  return prisma.deliveryLink.findMany({
    where: { tenantId, caseId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      revokedBy: { select: { id: true, name: true, email: true } },
      package: true,
      events: { orderBy: { timestamp: "desc" }, take: 10 },
    },
    orderBy: { createdAt: "desc" },
  });
}
