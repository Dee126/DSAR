import { test, expect } from "@playwright/test";
import path from "path";

// This E2E test covers the full DSAR workflow:
// Login → Create Case → Transition Status → Upload Document → Export Evidence
// Prerequisites: The app must be running with a seeded database (npm run db:seed)

const TEST_USER = {
  email: "admin@acme-corp.com",
  password: "admin123456",
};

test.describe("DSAR Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);
  });

  test("complete DSAR workflow: create → transition → upload → export", async ({
    page,
  }) => {
    // Step 1: Verify dashboard loads
    await expect(page.locator("h1")).toContainText("Dashboard");

    // Step 2: Navigate to create case
    await page.click('a[href="/cases"]');
    await page.waitForURL(/\/cases/);
    await page.click('a[href="/cases/new"]');
    await page.waitForURL(/\/cases\/new/);

    // Step 3: Fill in case creation form
    await page.selectOption('select[name="type"]', "ACCESS");
    await page.selectOption('select[name="priority"]', "HIGH");
    await page.fill('input[name="channel"]', "Email");
    await page.fill('input[name="requesterType"]', "Data Subject");
    await page.fill('textarea[name="description"]', "E2E test: requesting access to all personal data");
    await page.fill('input[name="subjectName"]', "E2E Test Subject");
    await page.fill('input[name="subjectEmail"]', "e2e-test@example.com");

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to case detail
    await page.waitForURL(/\/cases\/[a-zA-Z0-9-]+/);

    // Verify case was created
    await expect(page.locator('[data-testid="case-status"]')).toContainText("New");
    await expect(page.locator('[data-testid="case-type"]')).toContainText("ACCESS");

    // Step 4: Transition status: NEW → IDENTITY_VERIFICATION
    await page.click('button[data-status="IDENTITY_VERIFICATION"]');
    await page.fill('textarea[name="reason"]', "Identity documents received via email");
    await page.click('button[data-testid="confirm-transition"]');
    await expect(page.locator('[data-testid="case-status"]')).toContainText(
      "Identity Verification"
    );

    // Step 5: Transition: IDENTITY_VERIFICATION → INTAKE_TRIAGE
    await page.click('button[data-status="INTAKE_TRIAGE"]');
    await page.fill('textarea[name="reason"]', "Identity confirmed, proceeding to triage");
    await page.click('button[data-testid="confirm-transition"]');
    await expect(page.locator('[data-testid="case-status"]')).toContainText(
      "Intake & Triage"
    );

    // Step 6: Upload a document
    const testFilePath = path.resolve(__dirname, "test-document.txt");
    // Create test file content inline via the file chooser
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-document.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("This is a test document for E2E testing of DSAR workflow."),
    });
    await page.click('button[data-testid="upload-document"]');

    // Verify document appears in the list
    await expect(page.locator('[data-testid="documents-list"]')).toContainText(
      "test-document.txt"
    );

    // Step 7: Export evidence
    const downloadPromise = page.waitForEvent("download");
    await page.click('button[data-testid="export-evidence"]');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.zip$/);
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    // Logout first
    await page.goto("/login");

    await page.fill('input[name="email"]', "wrong@example.com");
    await page.fill('input[name="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
  });

  test("dashboard shows case statistics", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator('[data-testid="stat-total"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-open"]')).toBeVisible();
  });
});
