/**
 * E2E Auth Helpers
 *
 * Login helpers for Playwright tests.
 * Uses credentials from seed data.
 */

import { Page, expect } from "@playwright/test";

export const TEST_USERS = {
  admin: {
    email: "admin@acme-corp.com",
    password: "admin123456",
    role: "TENANT_ADMIN",
    name: "Alice Admin",
  },
  dpo: {
    email: "dpo@acme-corp.com",
    password: "admin123456",
    role: "DPO",
    name: "David DPO",
  },
  caseManager: {
    email: "manager@acme-corp.com",
    password: "admin123456",
    role: "CASE_MANAGER",
    name: "Maria Manager",
  },
  contributor: {
    email: "contributor@acme-corp.com",
    password: "admin123456",
    role: "CONTRIBUTOR",
    name: "Charlie Contributor",
  },
  viewer: {
    email: "viewer@acme-corp.com",
    password: "admin123456",
    role: "READ_ONLY",
    name: "Vera Viewer",
  },
} as const;

export type TestUserKey = keyof typeof TEST_USERS;

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
 * Get an auth cookie by performing a CSR login via the API.
 * Returns cookies as a string for use in fetch headers.
 */
export async function getAuthCookies(
  baseURL: string,
  userKey: TestUserKey,
): Promise<string> {
  const user = TEST_USERS[userKey];

  // Get CSRF token first
  const csrfRes = await fetch(`${baseURL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookies = csrfRes.headers.get("set-cookie") || "";

  // Sign in
  const signInRes = await fetch(`${baseURL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookies,
    },
    body: new URLSearchParams({
      csrfToken,
      email: user.email,
      password: user.password,
    }),
    redirect: "manual",
  });

  const setCookies = signInRes.headers.get("set-cookie") || "";
  return [csrfCookies, setCookies].filter(Boolean).join("; ");
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
