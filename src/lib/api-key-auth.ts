import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { ApiError } from "./errors";
import { logAudit, getClientInfo } from "./audit";

export type ApiKeyScope =
  | "cases:read"
  | "cases:write"
  | "systems:read"
  | "vendors:write"
  | "webhooks:write"
  | "connectors:run"
  | "documents:read"
  | "incidents:read"
  | "admin:all";

export interface ApiKeyUser {
  apiKeyId: string;
  tenantId: string;
  name: string;
  scopes: ApiKeyScope[];
  createdBy: string;
}

/**
 * Hash an API key using SHA-256 for storage/lookup.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Generate a new API key with a recognizable prefix.
 */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const random = Array.from({ length: 32 }, () =>
    Math.random().toString(36).charAt(2)
  ).join("");
  const key = `pp_live_${random}`;
  const prefix = key.substring(0, 16);
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

/**
 * Authenticate a request using the API key from Authorization header.
 * Returns the resolved API key user context.
 */
export async function authenticateApiKey(
  request: NextRequest
): Promise<ApiKeyUser> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing or invalid Authorization header. Expected: Bearer <api_key>");
  }

  const key = authHeader.slice(7).trim();
  if (!key) {
    throw new ApiError(401, "Empty API key");
  }

  const keyHash = hashApiKey(key);

  const apiKey = await prisma.apiKey.findFirst({
    where: { keyHash, revokedAt: null },
  });

  if (!apiKey) {
    throw new ApiError(401, "Invalid or revoked API key");
  }

  // Update last used timestamp (fire and forget)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  const scopes = (apiKey.scopesJson as string[]) || [];

  return {
    apiKeyId: apiKey.id,
    tenantId: apiKey.tenantId,
    name: apiKey.name,
    scopes: scopes as ApiKeyScope[],
    createdBy: apiKey.createdBy,
  };
}

/**
 * Enforce that the API key has the required scope.
 */
export function enforceScope(
  user: ApiKeyUser,
  requiredScope: ApiKeyScope
): void {
  if (user.scopes.includes("admin:all")) return;
  if (!user.scopes.includes(requiredScope)) {
    throw new ApiError(
      403,
      `Forbidden: API key missing required scope '${requiredScope}'`
    );
  }
}

/**
 * Log an API call in the audit log.
 */
export async function logApiCall(
  request: NextRequest,
  apiKeyUser: ApiKeyUser,
  entityType: string,
  entityId?: string
): Promise<void> {
  const { ip, userAgent } = getClientInfo(request);
  await logAudit({
    tenantId: apiKeyUser.tenantId,
    actorUserId: apiKeyUser.createdBy,
    action: "API_CALL",
    entityType,
    entityId,
    ip,
    userAgent,
    details: {
      apiKeyId: apiKeyUser.apiKeyId,
      apiKeyName: apiKeyUser.name,
      method: request.method,
      path: new URL(request.url).pathname,
    },
  });
}

// ─── Rate Limiting (In-Memory, Dev) ─────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 120; // 120 requests per minute per key

/**
 * Simple in-memory rate limiter per API key.
 * Returns remaining requests or throws 429.
 */
export function checkRateLimit(apiKeyId: string): { remaining: number } {
  const now = Date.now();
  const existing = rateLimitStore.get(apiKeyId);

  if (!existing || now > existing.resetAt) {
    rateLimitStore.set(apiKeyId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { remaining: RATE_LIMIT_MAX - 1 };
  }

  existing.count++;
  if (existing.count > RATE_LIMIT_MAX) {
    throw new ApiError(429, "Rate limit exceeded. Try again later.");
  }

  return { remaining: RATE_LIMIT_MAX - existing.count };
}

// Clean up stale entries periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    rateLimitStore.forEach((entry, key) => {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    });
  }, 60_000);
}
