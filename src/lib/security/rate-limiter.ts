/**
 * Rate Limiter — Configurable, multi-bucket rate limiting.
 *
 * Supports:
 * - IP-based rate limiting (for public portals)
 * - Tenant + IP rate limiting (for intake)
 * - Token-based rate limiting (for OTP attempts)
 * - Configurable windows, limits, and lockout durations
 *
 * In-memory implementation suitable for single-instance deployments.
 * For production multi-instance: replace with Redis-backed store.
 *
 * Sprint 9.2: Security Hardening
 */

import { createHash } from "crypto";
import { ApiError } from "../errors";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
  lockedUntil?: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  lockoutMs?: number;        // If set, lock after maxRequests exceeded
  lockoutThreshold?: number; // Number of windows that exceeded before lockout
}

// ─── Preset Configurations ──────────────────────────────────────────────────

export const RATE_LIMITS = {
  /** Public intake form: 5 submissions per minute per IP+tenant */
  INTAKE_SUBMIT: {
    windowMs: 60_000,
    maxRequests: 5,
  } satisfies RateLimitConfig,

  /** OTP send: 3 per 15 minutes per linkId */
  OTP_SEND: {
    windowMs: 15 * 60_000,
    maxRequests: 3,
  } satisfies RateLimitConfig,

  /** OTP verify: 5 attempts per 15 minutes per linkId, then lockout */
  OTP_VERIFY: {
    windowMs: 15 * 60_000,
    maxRequests: 5,
    lockoutMs: 30 * 60_000, // 30 min lockout
  } satisfies RateLimitConfig,

  /** IDV portal submission: 3 per hour per token */
  IDV_SUBMIT: {
    windowMs: 60 * 60_000,
    maxRequests: 3,
  } satisfies RateLimitConfig,

  /** API key: 120 per minute (existing) */
  API_KEY: {
    windowMs: 60_000,
    maxRequests: 120,
  } satisfies RateLimitConfig,

  /** Login attempts: 5 per 15 minutes per IP */
  LOGIN: {
    windowMs: 15 * 60_000,
    maxRequests: 10,
    lockoutMs: 30 * 60_000,
  } satisfies RateLimitConfig,

  /** General public endpoint: 30 per minute per IP */
  PUBLIC_GENERAL: {
    windowMs: 60_000,
    maxRequests: 30,
  } satisfies RateLimitConfig,
} as const;

// ─── Rate Limiter Store ─────────────────────────────────────────────────────

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(bucket: string): Map<string, RateLimitEntry> {
  let store = stores.get(bucket);
  if (!store) {
    store = new Map();
    stores.set(bucket, store);
  }
  return store;
}

/**
 * Hash an IP address for privacy-safe rate limiting.
 * We don't need the raw IP in the rate limit store.
 */
export function hashIpForRateLimit(ip: string): string {
  return createHash("sha256").update(ip + ":rate-limit-salt").digest("hex").slice(0, 16);
}

/**
 * Build a composite rate limit key from multiple parts.
 * Example: rateKey("intake", tenantId, ipHash) → "intake:tenant123:abcdef12"
 */
export function rateKey(...parts: string[]): string {
  return parts.filter(Boolean).join(":");
}

// ─── Core Rate Limit Check ──────────────────────────────────────────────────

/**
 * Check rate limit for a given key and configuration.
 * Returns remaining requests count.
 * Throws ApiError(429) if limit exceeded.
 */
export function checkRateLimit(
  bucket: string,
  key: string,
  config: RateLimitConfig,
): { remaining: number; resetAt: number } {
  const store = getStore(bucket);
  const now = Date.now();
  const existing = store.get(key);

  // Check lockout
  if (existing?.lockedUntil && now < existing.lockedUntil) {
    const remainingMs = existing.lockedUntil - now;
    const remainingMin = Math.ceil(remainingMs / 60_000);
    throw new ApiError(429, `Rate limited. Try again in ${remainingMin} minutes.`, undefined, "RATE_LIMIT_LOCKOUT");
  }

  // Reset window if expired
  if (!existing || now > existing.resetAt) {
    store.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return { remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  existing.count++;

  if (existing.count > config.maxRequests) {
    // Apply lockout if configured
    if (config.lockoutMs) {
      existing.lockedUntil = now + config.lockoutMs;
      store.set(key, existing);
      const lockoutMin = Math.ceil(config.lockoutMs / 60_000);
      throw new ApiError(429, `Rate limit exceeded. Locked for ${lockoutMin} minutes.`, undefined, "RATE_LIMIT_LOCKOUT");
    }
    throw new ApiError(429, "Rate limit exceeded. Try again later.", undefined, "RATE_LIMIT_EXCEEDED");
  }

  return { remaining: config.maxRequests - existing.count, resetAt: existing.resetAt };
}

/**
 * Convenience: apply rate limit and add headers to response.
 */
export function applyRateLimitHeaders(
  headers: Headers,
  result: { remaining: number; resetAt: number },
  config: RateLimitConfig,
): void {
  headers.set("X-RateLimit-Limit", String(config.maxRequests));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

/** Clean up expired entries across all stores. */
function cleanup() {
  const now = Date.now();
  stores.forEach((store) => {
    store.forEach((entry, key) => {
      const isExpired = now > entry.resetAt && (!entry.lockedUntil || now > entry.lockedUntil);
      if (isExpired) {
        store.delete(key);
      }
    });
  });
}

// Run cleanup every 2 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanup, 120_000);
}
