import { describe, it, expect } from "vitest";
import {
  calculateConfidenceScore,
  buildConfidenceInput,
  type ConfidenceInput,
} from "@/lib/confidence";

describe("Confidence Score Model", () => {
  describe("calculateConfidenceScore", () => {
    it("should return base score of 50 when no factors are present", () => {
      const input: ConfidenceInput = {
        hasOwner: false,
        dataCategoryCount: 0,
        hasLocation: false,
        hasRetention: false,
        hasAutomationProfile: false,
      };
      expect(calculateConfidenceScore(input)).toBe(50);
    });

    it("should add 10 for owner", () => {
      const input: ConfidenceInput = {
        hasOwner: true,
        dataCategoryCount: 0,
        hasLocation: false,
        hasRetention: false,
        hasAutomationProfile: false,
      };
      expect(calculateConfidenceScore(input)).toBe(60);
    });

    it("should add 10 for data categories", () => {
      const input: ConfidenceInput = {
        hasOwner: false,
        dataCategoryCount: 3,
        hasLocation: false,
        hasRetention: false,
        hasAutomationProfile: false,
      };
      expect(calculateConfidenceScore(input)).toBe(60);
    });

    it("should add 10 for location", () => {
      const input: ConfidenceInput = {
        hasOwner: false,
        dataCategoryCount: 0,
        hasLocation: true,
        hasRetention: false,
        hasAutomationProfile: false,
      };
      expect(calculateConfidenceScore(input)).toBe(60);
    });

    it("should add 10 for retention", () => {
      const input: ConfidenceInput = {
        hasOwner: false,
        dataCategoryCount: 0,
        hasLocation: false,
        hasRetention: true,
        hasAutomationProfile: false,
      };
      expect(calculateConfidenceScore(input)).toBe(60);
    });

    it("should add 10 for automation profile", () => {
      const input: ConfidenceInput = {
        hasOwner: false,
        dataCategoryCount: 0,
        hasLocation: false,
        hasRetention: false,
        hasAutomationProfile: true,
      };
      expect(calculateConfidenceScore(input)).toBe(60);
    });

    it("should return 100 when all factors are present", () => {
      const input: ConfidenceInput = {
        hasOwner: true,
        dataCategoryCount: 5,
        hasLocation: true,
        hasRetention: true,
        hasAutomationProfile: true,
      };
      expect(calculateConfidenceScore(input)).toBe(100);
    });

    it("should cap at 100 (no overflow)", () => {
      const input: ConfidenceInput = {
        hasOwner: true,
        dataCategoryCount: 100,
        hasLocation: true,
        hasRetention: true,
        hasAutomationProfile: true,
      };
      expect(calculateConfidenceScore(input)).toBe(100);
    });

    it("should handle partial factors correctly (owner + location = 70)", () => {
      const input: ConfidenceInput = {
        hasOwner: true,
        dataCategoryCount: 0,
        hasLocation: true,
        hasRetention: false,
        hasAutomationProfile: false,
      };
      expect(calculateConfidenceScore(input)).toBe(70);
    });

    it("should handle three factors correctly (80)", () => {
      const input: ConfidenceInput = {
        hasOwner: true,
        dataCategoryCount: 2,
        hasLocation: true,
        hasRetention: false,
        hasAutomationProfile: false,
      };
      expect(calculateConfidenceScore(input)).toBe(80);
    });
  });

  describe("buildConfidenceInput", () => {
    it("should return all-false for empty system", () => {
      const input = buildConfidenceInput({});
      expect(input).toEqual({
        hasOwner: false,
        dataCategoryCount: 0,
        hasLocation: false,
        hasRetention: false,
        hasAutomationProfile: false,
      });
    });

    it("should detect owner", () => {
      const input = buildConfidenceInput({ ownerUserId: "user-1" });
      expect(input.hasOwner).toBe(true);
    });

    it("should not detect null owner", () => {
      const input = buildConfidenceInput({ ownerUserId: null });
      expect(input.hasOwner).toBe(false);
    });

    it("should count data categories", () => {
      const input = buildConfidenceInput({
        dataCategories: [
          { retentionPeriod: null, retentionDays: null },
          { retentionPeriod: null, retentionDays: null },
        ],
      });
      expect(input.dataCategoryCount).toBe(2);
    });

    it("should detect primary residency location", () => {
      const input = buildConfidenceInput({ dataResidencyPrimary: "EU" });
      expect(input.hasLocation).toBe(true);
    });

    it("should detect processing regions as location", () => {
      const input = buildConfidenceInput({ processingRegions: ["us-east-1", "eu-west-1"] });
      expect(input.hasLocation).toBe(true);
    });

    it("should not detect empty processing regions as location", () => {
      const input = buildConfidenceInput({ processingRegions: [] });
      expect(input.hasLocation).toBe(false);
    });

    it("should detect retention from retentionPeriod", () => {
      const input = buildConfidenceInput({
        dataCategories: [{ retentionPeriod: "3 years", retentionDays: null }],
      });
      expect(input.hasRetention).toBe(true);
    });

    it("should detect retention from retentionDays", () => {
      const input = buildConfidenceInput({
        dataCategories: [{ retentionPeriod: null, retentionDays: 365 }],
      });
      expect(input.hasRetention).toBe(true);
    });

    it("should not detect retention when none set", () => {
      const input = buildConfidenceInput({
        dataCategories: [{ retentionPeriod: null, retentionDays: null }],
      });
      expect(input.hasRetention).toBe(false);
    });

    it("should detect non-MANUAL automation readiness", () => {
      const input = buildConfidenceInput({ automationReadiness: "API_READY" });
      expect(input.hasAutomationProfile).toBe(true);
    });

    it("should detect non-NONE connector type", () => {
      const input = buildConfidenceInput({ connectorType: "REST_API" });
      expect(input.hasAutomationProfile).toBe(true);
    });

    it("should not detect MANUAL readiness as automation", () => {
      const input = buildConfidenceInput({
        automationReadiness: "MANUAL",
        connectorType: "NONE",
      });
      expect(input.hasAutomationProfile).toBe(false);
    });

    it("should compute full confidence from a rich system", () => {
      const input = buildConfidenceInput({
        ownerUserId: "user-1",
        dataResidencyPrimary: "EU",
        processingRegions: ["eu-west-1"],
        automationReadiness: "FULLY_AUTOMATED",
        connectorType: "REST_API",
        dataCategories: [
          { retentionPeriod: "5 years", retentionDays: 1825 },
          { retentionPeriod: null, retentionDays: null },
        ],
      });
      expect(input.hasOwner).toBe(true);
      expect(input.dataCategoryCount).toBe(2);
      expect(input.hasLocation).toBe(true);
      expect(input.hasRetention).toBe(true);
      expect(input.hasAutomationProfile).toBe(true);
      expect(calculateConfidenceScore(input)).toBe(100);
    });
  });
});
