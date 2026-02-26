/**
 * Auth-mode toggle for local development.
 *
 * AUTH_MODE env var controls how API routes authenticate requests:
 *   - "none"     → bypass auth entirely, use DEMO_TENANT_ID (default in local)
 *   - "testauth" → use HMAC-signed cookie auth (test-auth.ts)
 *   - "nextauth" → use full NextAuth / DB-backed sessions
 *
 * Usage in API routes:
 *   import { getRequestUser, getTenantIdForRequest } from "@/lib/auth-mode";
 *
 *   const user     = await getRequestUser();        // full user object
 *   const tenantId = await getTenantIdForRequest();  // just the tenant ID
 */

import { UserRole } from "@prisma/client";
import { ApiError } from "./errors";
import { requireAuth } from "./auth";

export type AuthMode = "none" | "testauth" | "nextauth";

let loggedOnce = false;

export function getAuthMode(): AuthMode {
  const raw = process.env.AUTH_MODE;
  if (raw === "testauth" || raw === "nextauth") return raw;
  return "none";
}

/**
 * Returns the authenticated user for the current request.
 *
 * - AUTH_MODE=none  → returns a synthetic demo user scoped to DEMO_TENANT_ID.
 *                     Throws 500 if DEMO_TENANT_ID is not set.
 * - AUTH_MODE=testauth | nextauth → delegates to requireAuth().
 */
export async function getRequestUser() {
  const mode = getAuthMode();

  if (mode === "none") {
    const tenantId = process.env.DEMO_TENANT_ID;
    if (!tenantId) {
      throw new ApiError(
        500,
        "AUTH_MODE=none requires DEMO_TENANT_ID environment variable to be set.",
      );
    }

    if (!loggedOnce) {
      console.log("[auth-mode] AUTH_MODE=none — using DEMO_TENANT_ID:", tenantId);
      loggedOnce = true;
    }

    return {
      id: "demo-user",
      email: "demo@privacypilot.local",
      name: "Demo User",
      role: "TENANT_ADMIN" as UserRole,
      tenantId,
    };
  }

  // testauth and nextauth both go through the existing requireAuth() which
  // already handles the NEXT_PUBLIC_AUTH_MODE=test vs supabase split.
  return requireAuth();
}

/**
 * Convenience: returns only the tenantId for the current request.
 * Same AUTH_MODE semantics as getRequestUser().
 */
export async function getTenantIdForRequest(): Promise<string> {
  const user = await getRequestUser();
  return user.tenantId;
}
