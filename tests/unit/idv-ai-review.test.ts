import { describe, it, expect } from "vitest";
import {
  MockIdvReviewProvider,
  type IdvReviewInput,
} from "@/lib/idv-ai-review";

const provider = new MockIdvReviewProvider();

function baseInput(overrides: Partial<IdvReviewInput> = {}): IdvReviewInput {
  return {
    artifacts: [
      { artifactType: "ID_FRONT", filename: "id_front.jpg", mimeType: "image/jpeg", sizeBytes: 200_000 },
      { artifactType: "ID_BACK", filename: "id_back.jpg", mimeType: "image/jpeg", sizeBytes: 180_000 },
    ],
    subjectInfo: {
      fullName: "Max Mustermann",
      email: "max@example.com",
      address: "Friedrichstr. 100, Berlin 10117",
      phone: "+49123456789",
    },
    ...overrides,
  };
}

describe("MockIdvReviewProvider", () => {
  it("returns a valid risk assessment structure", async () => {
    const result = await provider.analyze(baseInput());
    expect(result).toHaveProperty("riskScore");
    expect(result).toHaveProperty("flags");
    expect(result).toHaveProperty("extractedFields");
    expect(result).toHaveProperty("mismatches");
    expect(result).toHaveProperty("provider");
    expect(result.provider).toBe("mock");
  });

  it("risk score is between 0 and 100", async () => {
    const result = await provider.analyze(baseInput());
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);
  });

  it("flags missing primary ID", async () => {
    const result = await provider.analyze(baseInput({
      artifacts: [
        { artifactType: "UTILITY_BILL", filename: "bill.pdf", mimeType: "application/pdf", sizeBytes: 100_000 },
      ],
    }));
    expect(result.flags.some((f) => f.flag === "MISSING_PRIMARY_ID")).toBe(true);
    expect(result.riskScore).toBeGreaterThan(30);
  });

  it("flags missing ID back when front is provided without back", async () => {
    const result = await provider.analyze(baseInput({
      artifacts: [
        { artifactType: "ID_FRONT", filename: "front.jpg", mimeType: "image/jpeg", sizeBytes: 200_000 },
      ],
    }));
    expect(result.flags.some((f) => f.flag === "MISSING_ID_BACK")).toBe(true);
  });

  it("does not flag missing ID back when passport is provided", async () => {
    const result = await provider.analyze(baseInput({
      artifacts: [
        { artifactType: "PASSPORT", filename: "passport.jpg", mimeType: "image/jpeg", sizeBytes: 200_000 },
      ],
    }));
    expect(result.flags.some((f) => f.flag === "MISSING_ID_BACK")).toBe(false);
    expect(result.flags.some((f) => f.flag === "MISSING_PRIMARY_ID")).toBe(false);
  });

  it("flags low quality documents (small file size)", async () => {
    const result = await provider.analyze(baseInput({
      artifacts: [
        { artifactType: "ID_FRONT", filename: "tiny.jpg", mimeType: "image/jpeg", sizeBytes: 10_000 },
        { artifactType: "ID_BACK", filename: "tiny2.jpg", mimeType: "image/jpeg", sizeBytes: 15_000 },
      ],
    }));
    expect(result.flags.some((f) => f.flag === "LOW_QUALITY_DOCUMENT")).toBe(true);
  });

  it("flags unsupported file formats", async () => {
    const result = await provider.analyze(baseInput({
      artifacts: [
        { artifactType: "ID_FRONT", filename: "id.bmp", mimeType: "image/bmp", sizeBytes: 200_000 },
        { artifactType: "ID_BACK", filename: "id2.jpg", mimeType: "image/jpeg", sizeBytes: 200_000 },
      ],
    }));
    expect(result.flags.some((f) => f.flag === "UNSUPPORTED_FORMAT")).toBe(true);
  });

  it("extracts fields from primary ID", async () => {
    const result = await provider.analyze(baseInput());
    expect(result.extractedFields).toBeDefined();
    expect(result.extractedFields.name).toBeDefined();
    expect(result.extractedFields.documentType).toBeDefined();
    expect(result.extractedFields.issuingCountry).toBe("DE");
  });

  it("notes selfie collected flag when selfie is present", async () => {
    const result = await provider.analyze(baseInput({
      artifacts: [
        { artifactType: "ID_FRONT", filename: "id.jpg", mimeType: "image/jpeg", sizeBytes: 200_000 },
        { artifactType: "ID_BACK", filename: "id2.jpg", mimeType: "image/jpeg", sizeBytes: 200_000 },
        { artifactType: "SELFIE", filename: "selfie.jpg", mimeType: "image/jpeg", sizeBytes: 300_000 },
      ],
    }));
    expect(result.flags.some((f) => f.flag === "SELFIE_COLLECTED")).toBe(true);
  });

  it("returns lower risk for complete, good-quality documents", async () => {
    // Run multiple times and check average (mock has randomness)
    const scores: number[] = [];
    for (let i = 0; i < 20; i++) {
      const result = await provider.analyze(baseInput({
        artifacts: [
          { artifactType: "PASSPORT", filename: "passport.jpg", mimeType: "image/jpeg", sizeBytes: 500_000 },
        ],
      }));
      scores.push(result.riskScore);
    }
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    // Average should be reasonable — baseline 15, with occasional expired doc (+25) at 20% rate
    expect(avgScore).toBeLessThan(50);
  });

  it("returns higher risk when no primary ID is provided", async () => {
    const result = await provider.analyze(baseInput({
      artifacts: [
        { artifactType: "UTILITY_BILL", filename: "bill.pdf", mimeType: "application/pdf", sizeBytes: 100_000 },
      ],
    }));
    // Missing primary ID adds 30 to base 15, so at minimum 45
    expect(result.riskScore).toBeGreaterThanOrEqual(45);
  });

  it("flags array contains structured flag objects", async () => {
    const result = await provider.analyze(baseInput({
      artifacts: [],
    }));
    expect(result.flags.length).toBeGreaterThan(0);
    for (const flag of result.flags) {
      expect(flag).toHaveProperty("flag");
      expect(flag).toHaveProperty("severity");
      expect(flag).toHaveProperty("detail");
      expect(["low", "medium", "high", "critical"]).toContain(flag.severity);
    }
  });

  it("provider name is 'mock'", () => {
    expect(provider.name).toBe("mock");
  });
});

/* ── RBAC Permissions for IDV ──────────────────────────────────────── */

import { has } from "@/lib/rbac";

describe("IDV RBAC Permissions", () => {
  describe("IDV_VIEW", () => {
    it("SUPER_ADMIN can view IDV", () => expect(has("SUPER_ADMIN", "IDV_VIEW")).toBe(true));
    it("TENANT_ADMIN can view IDV", () => expect(has("TENANT_ADMIN", "IDV_VIEW")).toBe(true));
    it("DPO can view IDV", () => expect(has("DPO", "IDV_VIEW")).toBe(true));
    it("CASE_MANAGER can view IDV", () => expect(has("CASE_MANAGER", "IDV_VIEW")).toBe(true));
    it("ANALYST can view IDV", () => expect(has("ANALYST", "IDV_VIEW")).toBe(true));
    it("AUDITOR can view IDV", () => expect(has("AUDITOR", "IDV_VIEW")).toBe(true));
    it("READ_ONLY cannot view IDV", () => expect(has("READ_ONLY", "IDV_VIEW")).toBe(false));
  });

  describe("IDV_DECIDE", () => {
    it("DPO can decide", () => expect(has("DPO", "IDV_DECIDE")).toBe(true));
    it("TENANT_ADMIN can decide", () => expect(has("TENANT_ADMIN", "IDV_DECIDE")).toBe(true));
    it("SUPER_ADMIN can decide", () => expect(has("SUPER_ADMIN", "IDV_DECIDE")).toBe(true));
    it("CASE_MANAGER cannot decide", () => expect(has("CASE_MANAGER", "IDV_DECIDE")).toBe(false));
    it("ANALYST cannot decide", () => expect(has("ANALYST", "IDV_DECIDE")).toBe(false));
    it("AUDITOR cannot decide", () => expect(has("AUDITOR", "IDV_DECIDE")).toBe(false));
  });

  describe("IDV_MANAGE", () => {
    it("CASE_MANAGER can manage IDV", () => expect(has("CASE_MANAGER", "IDV_MANAGE")).toBe(true));
    it("DPO can manage IDV", () => expect(has("DPO", "IDV_MANAGE")).toBe(true));
    it("ANALYST cannot manage IDV", () => expect(has("ANALYST", "IDV_MANAGE")).toBe(false));
    it("AUDITOR cannot manage IDV", () => expect(has("AUDITOR", "IDV_MANAGE")).toBe(false));
  });

  describe("IDV_VIEW_ARTIFACTS", () => {
    it("DPO can view artifacts", () => expect(has("DPO", "IDV_VIEW_ARTIFACTS")).toBe(true));
    it("TENANT_ADMIN can view artifacts", () => expect(has("TENANT_ADMIN", "IDV_VIEW_ARTIFACTS")).toBe(true));
    it("CASE_MANAGER can view artifacts", () => expect(has("CASE_MANAGER", "IDV_VIEW_ARTIFACTS")).toBe(true));
    it("AUDITOR can view artifacts", () => expect(has("AUDITOR", "IDV_VIEW_ARTIFACTS")).toBe(true));
    it("ANALYST cannot view artifacts", () => expect(has("ANALYST", "IDV_VIEW_ARTIFACTS")).toBe(false));
    it("READ_ONLY cannot view artifacts", () => expect(has("READ_ONLY", "IDV_VIEW_ARTIFACTS")).toBe(false));
  });

  describe("IDV_SETTINGS_EDIT", () => {
    it("SUPER_ADMIN can edit settings", () => expect(has("SUPER_ADMIN", "IDV_SETTINGS_EDIT")).toBe(true));
    it("TENANT_ADMIN can edit settings", () => expect(has("TENANT_ADMIN", "IDV_SETTINGS_EDIT")).toBe(true));
    it("DPO can edit settings", () => expect(has("DPO", "IDV_SETTINGS_EDIT")).toBe(true));
    it("CASE_MANAGER cannot edit settings", () => expect(has("CASE_MANAGER", "IDV_SETTINGS_EDIT")).toBe(false));
    it("AUDITOR cannot edit settings", () => expect(has("AUDITOR", "IDV_SETTINGS_EDIT")).toBe(false));
  });
});
