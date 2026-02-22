/**
 * Test-mode authentication utilities.
 *
 * Uses HMAC-SHA256 signed httpOnly cookies (Web Crypto API)
 * so the same code works in both Edge (middleware) and Node.js runtimes.
 */

export const COOKIE_NAME = "pp-auth-token";
const TOKEN_EXPIRY_HOURS = 8;

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
}

interface TokenPayload extends AuthUser {
  iat: number;
  exp: number;
}

/* ── Base64url helpers ───────────────────────────────────────────────── */

function toBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode.apply(null, Array.from(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(padded + padding);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/* ── HMAC helpers (Web Crypto API) ───────────────────────────────────── */

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toBase64Url(new Uint8Array(sig));
}

/* ── Public API ──────────────────────────────────────────────────────── */

/** Create a signed token string from a user object. */
export async function createToken(user: AuthUser, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    ...user,
    iat: now,
    exp: now + TOKEN_EXPIRY_HOURS * 3600,
  };
  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

/** Verify a signed token and return the user payload, or null on failure. */
export async function verifyToken(token: string, secret: string): Promise<AuthUser | null> {
  const dot = token.indexOf(".");
  if (dot < 1) return null;

  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = await hmacSign(payloadB64, secret);
  if (sig !== expected) return null;

  try {
    const json = new TextDecoder().decode(fromBase64Url(payloadB64));
    const payload: TokenPayload = JSON.parse(json);

    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      id: payload.id,
      tenantId: payload.tenantId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

/** Build the test user profile from env vars (with seed-data defaults). */
export function getTestUser(): AuthUser {
  return {
    id: process.env.TEST_USER_ID || "00000000-0000-4000-8000-000000000010",
    tenantId: process.env.TEST_TENANT_ID || "00000000-0000-4000-8000-000000000001",
    email: process.env.TEST_USER_EMAIL || "",
    name: process.env.TEST_USER_NAME || "Test Admin",
    role: process.env.TEST_USER_ROLE || "TENANT_ADMIN",
  };
}

/** Check whether test-mode auth is active. */
export function isTestAuth(): boolean {
  return (process.env.NEXT_PUBLIC_AUTH_MODE || "test") === "test";
}
