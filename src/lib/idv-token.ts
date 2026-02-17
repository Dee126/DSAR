/**
 * IDV Portal Token Service — generates and validates signed tokens
 * for the subject-facing verification portal.
 *
 * Tokens are HMAC-SHA256 signed with NEXTAUTH_SECRET and contain:
 *   - requestId
 *   - tenantId
 *   - expiresAt (ISO string)
 *
 * Format: base64url(payload).base64url(signature)
 */

import { createHmac } from "crypto";

const SECRET = () => process.env.NEXTAUTH_SECRET ?? "idv-fallback-secret-dev-only";

interface TokenPayload {
  requestId: string;
  tenantId: string;
  expiresAt: string; // ISO 8601
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET()).update(payload).digest("base64url");
}

/**
 * Generate a signed portal token.
 */
export function generatePortalToken(
  requestId: string,
  tenantId: string,
  expiresAt: Date,
): string {
  const payload: TokenPayload = {
    requestId,
    tenantId,
    expiresAt: expiresAt.toISOString(),
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

/**
 * Validate and decode a portal token.
 * Returns null if invalid, expired, or tampered.
 */
export function validatePortalToken(
  token: string,
): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;
  const expectedSig = sign(encoded);
  if (sig !== expectedSig) return null;

  try {
    const payload: TokenPayload = JSON.parse(base64UrlDecode(encoded));
    if (!payload.requestId || !payload.tenantId || !payload.expiresAt) return null;

    const expiresAt = new Date(payload.expiresAt);
    if (isNaN(expiresAt.getTime())) return null;
    if (expiresAt < new Date()) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Calculate token expiry date from now.
 */
export function tokenExpiryFromDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
