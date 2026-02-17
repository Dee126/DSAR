/**
 * E2E API Client
 *
 * Typed helper for making authenticated API calls during E2E tests.
 * Wraps fetch with auth cookies and JSON handling.
 */

import { getAuthCookies, TestUserKey } from "./auth";

export class TestApiClient {
  private cookies: string = "";

  constructor(
    private baseURL: string,
    private userKey: TestUserKey = "admin",
  ) {}

  async init(): Promise<this> {
    this.cookies = await getAuthCookies(this.baseURL, this.userKey);
    return this;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; data: unknown }> {
    const res = await fetch(`${this.baseURL}${path}`, {
      method,
      headers: {
        Cookie: this.cookies,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let data: unknown = null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await res.json();
    }

    return { status: res.status, data };
  }

  async get(path: string) {
    return this.request("GET", path);
  }

  async post(path: string, body?: unknown) {
    return this.request("POST", path, body);
  }

  async put(path: string, body?: unknown) {
    return this.request("PUT", path, body);
  }

  async patch(path: string, body?: unknown) {
    return this.request("PATCH", path, body);
  }

  async delete(path: string) {
    return this.request("DELETE", path);
  }
}
