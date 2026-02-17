/**
 * E2E Auth Helpers
 *
 * Login helpers for Playwright tests.
 * Uses credentials from seed data.
 */

import { Page, expect } from "@playwright/test";

// Tenant 1: Acme Corp (primary test tenant)
export const TEST_USERS = {
  admin: {
    email: "admin@acme-corp.com",
    password: "admin123456",
    role: "TENANT_ADMIN",
    name: "Alice Admin",
    tenant: "acme-corp",
  },
  dpo: {
    email: "dpo@acme-corp.com",
    password: "admin123456",
    role: "DPO",
    name: "David DPO",
    tenant: "acme-corp",
  },
  caseManager: {
    email: "manager@acme-corp.com",
    password: "admin123456",
    role: "CASE_MANAGER",
    name: "Maria Manager",
    tenant: "acme-corp",
  },
  contributor: {
    email: "contributor@acme-corp.com",
    password: "admin123456",
    role: "CONTRIBUTOR",
    name: "Charlie Contributor",
    tenant: "acme-corp",
  },
  viewer: {
    email: "viewer@acme-corp.com",
    password: "admin123456",
    role: "READ_ONLY",
    name: "Vera Viewer",
    tenant: "acme-corp",
  },
} as const;

// Tenant 2: Beta Industries (for cross-tenant isolation tests)
export const TENANT2_USERS = {
  admin: {
    email: "admin@beta-industries.com",
    password: "beta123456",
    role: "TENANT_ADMIN",
    name: "Bob Beta-Admin",
    tenant: "beta-industries",
  },
  viewer: {
    email: "viewer@beta-industries.com",
    password: "beta123456",
    role: "READ_ONLY",
    name: "Vicky Beta-Viewer",
    tenant: "beta-industries",
  },
} as const;

export type TestUserKey = keyof typeof TEST_USERS;
export type Tenant2UserKey = keyof typeof TENANT2_USERS;

/**
 * Log in as a test user via the login page.
 * Waits for redirect to /dashboard before returning.
 */
export async function loginAs(page: Page, userKey: TestUserKey): Promise<void> {
  const user = TEST_USERS[userKey];
  await page.goto("/login");
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  // Wait for successful redirect — dashboard or any authenticated page
  await page.waitForURL(/\/(dashboard|cases|settings|intake)/, { timeout: 15000 });
}

/**
 * Internal: perform API-based login and return cookies.
 */
async function apiLogin(
  baseURL: string,
  email: string,
  password: string,
): Promise<string> {
  const csrfRes = await fetch(`${baseURL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookies = csrfRes.headers.get("set-cookie") || "";

  const signInRes = await fetch(`${baseURL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookies,
    },
    body: new URLSearchParams({ csrfToken, email, password }),
    redirect: "manual",
  });

  const setCookies = signInRes.headers.get("set-cookie") || "";
  return [csrfCookies, setCookies].filter(Boolean).join("; ");
}

/**
 * Get auth cookies for a Tenant 1 (Acme Corp) user.
 */
export async function getAuthCookies(
  baseURL: string,
  userKey: TestUserKey,
): Promise<string> {
  const user = TEST_USERS[userKey];
  return apiLogin(baseURL, user.email, user.password);
}

/**
 * Get auth cookies for a Tenant 2 (Beta Industries) user.
 */
export async function getAuthCookiesTenant2(
  baseURL: string,
  userKey: Tenant2UserKey,
): Promise<string> {
  const user = TENANT2_USERS[userKey];
  return apiLogin(baseURL, user.email, user.password);
}

/**
 * Make an authenticated API request.
 */
export async function authFetch(
  baseURL: string,
  cookies: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${baseURL}${path}`, {
    ...options,
    headers: {
      ...((options.headers as Record<string, string>) || {}),
      Cookie: cookies,
      "Content-Type": "application/json",
    },
  });
}
