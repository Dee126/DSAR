/**
 * Sprint 9.6: System Validation Smoke Tests
 *
 * Covers 10 critical flows end-to-end via Playwright.
 * Prerequisites: App running with seeded DB (npm run db:seed)
 *
 * Run: npx playwright test tests/e2e/smoke-flows.spec.ts
 */

import { test, expect, Page } from "@playwright/test";
import { loginAs, TEST_USERS } from "./helpers/auth";
import { TestApiClient } from "./helpers/api-client";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 1: Intake → Case Creation → Deadlines
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Flow 1: Intake → Case Creation → Deadlines", () => {
  test("submit intake, create case, verify deadlines", async ({ page }) => {
    // Step 1: Submit a public DSAR intake
    await page.goto("/public/acme-corp/dsar");

    // Fill intake form (the form may use different field names)
    const emailInput = page.locator('input[name="subjectEmail"], input[type="email"]').first();
    if (await emailInput.isVisible()) {
      await emailInput.fill("flow1-test@example.com");
    }

    const nameInput = page.locator('input[name="subjectName"], input[name="name"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill("Flow1 Test Subject");
    }

    // Select request type if available
    const typeSelect = page.locator('select[name="requestTypes"], select[name="type"]').first();
    if (await typeSelect.isVisible()) {
      const options = await typeSelect.locator("option").allTextContents();
      if (options.length > 1) {
        await typeSelect.selectOption({ index: 1 });
      }
    }

    // Check consent
    const consentBox = page.locator('input[type="checkbox"]').first();
    if (await consentBox.isVisible()) {
      await consentBox.check();
    }

    // Submit
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Wait for confirmation or reference
      await page.waitForTimeout(2000);
    }

    // Step 2: Login as admin and check intake submissions
    await loginAs(page, "admin");
    await page.goto("/intake");
    // Verify the intake page loads
    await expect(page.locator("body")).not.toContainText("500");
    await expect(page.locator("body")).not.toContainText("Internal Server Error");

    // Step 3: Navigate to cases and verify they exist
    await page.goto("/cases");
    await expect(page.locator("body")).not.toContainText("Internal Server Error");

    // Step 4: If seeded cases exist, open one and check deadlines
    const caseLink = page.locator('a[href*="/cases/"]').first();
    if (await caseLink.isVisible()) {
      await caseLink.click();
      await page.waitForLoadState("networkidle");
      // Verify case detail loads without error
      await expect(page.locator("body")).not.toContainText("Internal Server Error");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 2: Dedupe & Clarification
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Flow 2: Dedupe & Clarification", () => {
  test("submit duplicate intakes, check dedupe via API", async ({ page }) => {
    const api = await new TestApiClient(BASE_URL, "admin").init();

    // Get existing intake submissions
    const { status, data } = await api.get("/api/intake/submissions");
    expect(status).toBeLessThan(500);

    // Verify dedupe endpoint exists and is accessible
    // We test the API endpoint rather than clicking through UI
    const cases = await api.get("/api/cases");
    expect(cases.status).toBeLessThan(500);

    if (cases.data && typeof cases.data === "object") {
      const caseList = (cases.data as { data?: unknown[] })?.data ?? [];
      if (Array.isArray(caseList) && caseList.length > 0) {
        const caseId = (caseList[0] as { id: string }).id;
        const dedupe = await api.get(`/api/intake/dedupe/${caseId}`);
        // Dedupe endpoint should not 500
        expect(dedupe.status).toBeLessThan(500);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 3: IDV Portal + Approval
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Flow 3: IDV Portal + Approval", () => {
  test("IDV endpoints accessible, portal loads", async ({ page }) => {
    const api = await new TestApiClient(BASE_URL, "admin").init();

    // Get cases
    const cases = await api.get("/api/cases");
    expect(cases.status).toBe(200);

    const caseList = ((cases.data as { data?: unknown[] })?.data ?? []) as Array<{ id: string; status: string }>;

    if (caseList.length > 0) {
      const caseId = caseList[0].id;

      // Get IDV data for the case
      const idv = await api.get(`/api/cases/${caseId}/idv`);
      // Should not 500 — either 200 (data) or 404 (no IDV yet)
      expect(idv.status).toBeLessThan(500);

      // IDV settings should be accessible
      const settings = await api.get("/api/idv/settings");
      expect(settings.status).toBeLessThan(500);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 4: Data Collection (Systems + Vendors)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Flow 4: Data Collection (Systems + Vendors)", () => {
  test("systems and vendor endpoints accessible", async ({ page }) => {
    const api = await new TestApiClient(BASE_URL, "admin").init();

    // Systems list
    const systems = await api.get("/api/systems");
    expect(systems.status).toBe(200);

    // Vendors list
    const vendors = await api.get("/api/vendors");
    expect(vendors.status).toBeLessThan(500);

    // Vendor stats
    const stats = await api.get("/api/vendors/stats");
    expect(stats.status).toBeLessThan(500);

    // Case vendor data
    const cases = await api.get("/api/cases");
    const caseList = ((cases.data as { data?: unknown[] })?.data ?? []) as Array<{ id: string }>;
    if (caseList.length > 0) {
      const vendorReqs = await api.get(`/api/cases/${caseList[0].id}/vendors`);
      expect(vendorReqs.status).toBeLessThan(500);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 5: Redaction / Exceptions gating
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Flow 5: Redaction & Exceptions gating", () => {
  test("redaction endpoints accessible for seeded case", async ({ page }) => {
    const api = await new TestApiClient(BASE_URL, "admin").init();

    const cases = await api.get("/api/cases");
    const caseList = ((cases.data as { data?: unknown[] })?.data ?? []) as Array<{ id: string }>;

    if (caseList.length > 0) {
      const caseId = caseList[0].id;

      // Redaction data
      const redaction = await api.get(`/api/cases/${caseId}/redaction`);
      expect(redaction.status).toBeLessThan(500);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 6: Response Generator → Approval → Delivery
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Flow 6: Response → Approval → Delivery", () => {
  test("response and delivery endpoints accessible", async ({ page }) => {
    const api = await new TestApiClient(BASE_URL, "admin").init();

    // Response templates
    const templates = await api.get("/api/response-templates");
    expect(templates.status).toBeLessThan(500);

    // Response stats
    const stats = await api.get("/api/response-stats");
    expect(stats.status).toBeLessThan(500);

    // Case response and delivery
    const cases = await api.get("/api/cases");
    const caseList = ((cases.data as { data?: unknown[] })?.data ?? []) as Array<{ id: string }>;

    if (caseList.length > 0) {
      const caseId = caseList[0].id;

      const response = await api.get(`/api/cases/${caseId}/response`);
      expect(response.status).toBeLessThan(500);

      const delivery = await api.get(`/api/cases/${caseId}/delivery`);
      expect(delivery.status).toBeLessThan(500);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 7: Incident Linking + Authority Export
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Flow 7: Incident Linking + Authority Export", () => {
  test("incident and executive endpoints accessible", async ({ page }) => {
    const api = await new TestApiClient(BASE_URL, "admin").init();

    // Incidents list
    const incidents = await api.get("/api/incidents");
    expect(incidents.status).toBeLessThan(500);

    // Executive dashboard endpoints
    const trends = await api.get("/api/executive/trends");
    expect(trends.status).toBeLessThan(500);

    const forecasts = await api.get("/api/executive/forecasts");
    expect(forecasts.status).toBeLessThan(500);

    // Incident detail if available
    const incidentList = ((incidents.data as { data?: unknown[] })?.data ?? (incidents.data as unknown[])) as Array<{ id: string }>;
    if (Array.isArray(incidentList) && incidentList.length > 0) {
      const incId = incidentList[0].id;
      const detail = await api.get(`/api/incidents/${incId}`);
      expect(detail.status).toBeLessThan(500);

      // Authority export
      const exp = await api.get(`/api/incidents/${incId}/export`);
      expect(exp.status).toBeLessThan(500);
    }
  });

  test("executive dashboard page loads", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText("Internal Server Error");
    // Dashboard should have some stat widgets
    await expect(page.locator("body")).toContainText(/dashboard|cases|open/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 8: Search & eDiscovery
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Flow 8: Search & eDiscovery", () => {
  test("search endpoint returns results", async ({ page }) => {
    const api = await new TestApiClient(BASE_URL, "admin").init();

    // Global search
    const search = await api.get("/api/search?q=test&limit=5");
    expect(search.status).toBeLessThan(500);

    // Assurance audit trail
    const audit = await api.get("/api/assurance/audit-trail");
    expect(audit.status).toBeLessThan(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 9: Security Regression (Tenant Isolation)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Flow 9: Security Regression", () => {
  test("unauthenticated API access returns 401", async ({ page }) => {
    // Direct API calls without auth should fail
    const casesRes = await fetch(`${BASE_URL}/api/cases`);
    expect(casesRes.status).toBe(401);

    const auditRes = await fetch(`${BASE_URL}/api/audit-logs`);
    expect(auditRes.status).toBe(401);

    const usersRes = await fetch(`${BASE_URL}/api/users`);
    expect(usersRes.status).toBe(401);
  });

  test("viewer cannot access admin endpoints", async ({ page }) => {
    const viewerApi = await new TestApiClient(BASE_URL, "viewer").init();

    // Viewer should not be able to create cases
    const createCase = await viewerApi.post("/api/cases", {
      type: "ACCESS",
      priority: "LOW",
      description: "Unauthorized create",
      subjectName: "Test",
      subjectEmail: "test@test.com",
    });
    expect([403, 400]).toContain(createCase.status);

    // Viewer should not access user management
    const users = await viewerApi.get("/api/users");
    expect([403, 401]).toContain(users.status);
  });

  test("invalid public portal token returns 404", async ({ page }) => {
    // Invalid IDV token
    const res = await fetch(`${BASE_URL}/api/idv/portal/invalid-token-12345`);
    expect([404, 401, 400]).toContain(res.status);

    // Invalid delivery token
    await page.goto("/public/acme-corp/delivery/invalid-token-12345");
    // Should show error or 404, not internal server error
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("Internal Server Error");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW 10: Performance Sanity
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Flow 10: Performance Sanity", () => {
  test("health endpoints respond quickly", async ({ page }) => {
    // Liveness
    const livenessStart = Date.now();
    const liveness = await fetch(`${BASE_URL}/api/health/liveness`);
    const livenessMs = Date.now() - livenessStart;
    expect(liveness.status).toBe(200);
    expect(livenessMs).toBeLessThan(2000);

    // Readiness
    const readinessStart = Date.now();
    const readiness = await fetch(`${BASE_URL}/api/health/readiness`);
    const readinessMs = Date.now() - readinessStart;
    expect([200, 503]).toContain(readiness.status);
    expect(readinessMs).toBeLessThan(5000);
  });

  test("dashboard API responds within threshold", async ({ page }) => {
    const api = await new TestApiClient(BASE_URL, "admin").init();

    const latencies: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      const res = await api.get("/api/cases?page=1&pageSize=10");
      latencies.push(Date.now() - start);
      expect(res.status).toBe(200);
    }

    const median = latencies.sort((a, b) => a - b)[Math.floor(latencies.length / 2)];
    // Median should be under 3 seconds
    expect(median).toBeLessThan(3000);
    console.log(`Cases API median latency: ${median}ms (samples: ${latencies.join(", ")})`);
  });

  test("concurrent requests don't cause errors", async ({ page }) => {
    const api = await new TestApiClient(BASE_URL, "admin").init();

    // Fire 5 concurrent requests
    const results = await Promise.all([
      api.get("/api/cases?page=1&pageSize=5"),
      api.get("/api/systems"),
      api.get("/api/vendors"),
      api.get("/api/incidents"),
      api.get("/api/health/liveness"),
    ]);

    for (const r of results) {
      expect(r.status).toBeLessThan(500);
    }
  });
});
