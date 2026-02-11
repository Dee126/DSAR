import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  getAllowedTransitions,
  STATUS_LABELS,
} from "@/lib/state-machine";

describe("DSAR State Machine", () => {
  describe("isValidTransition", () => {
    it("should allow NEW → IDENTITY_VERIFICATION", () => {
      expect(isValidTransition("NEW", "IDENTITY_VERIFICATION")).toBe(true);
    });

    it("should allow NEW → INTAKE_TRIAGE", () => {
      expect(isValidTransition("NEW", "INTAKE_TRIAGE")).toBe(true);
    });

    it("should allow NEW → REJECTED", () => {
      expect(isValidTransition("NEW", "REJECTED")).toBe(true);
    });

    it("should NOT allow NEW → DATA_COLLECTION (must go through triage)", () => {
      expect(isValidTransition("NEW", "DATA_COLLECTION")).toBe(false);
    });

    it("should NOT allow NEW → CLOSED directly", () => {
      expect(isValidTransition("NEW", "CLOSED")).toBe(false);
    });

    it("should allow IDENTITY_VERIFICATION → INTAKE_TRIAGE", () => {
      expect(isValidTransition("IDENTITY_VERIFICATION", "INTAKE_TRIAGE")).toBe(
        true
      );
    });

    it("should allow IDENTITY_VERIFICATION → REJECTED", () => {
      expect(isValidTransition("IDENTITY_VERIFICATION", "REJECTED")).toBe(true);
    });

    it("should allow INTAKE_TRIAGE → DATA_COLLECTION", () => {
      expect(isValidTransition("INTAKE_TRIAGE", "DATA_COLLECTION")).toBe(true);
    });

    it("should allow DATA_COLLECTION → REVIEW_LEGAL", () => {
      expect(isValidTransition("DATA_COLLECTION", "REVIEW_LEGAL")).toBe(true);
    });

    it("should allow REVIEW_LEGAL → DATA_COLLECTION (send back)", () => {
      expect(isValidTransition("REVIEW_LEGAL", "DATA_COLLECTION")).toBe(true);
    });

    it("should allow REVIEW_LEGAL → RESPONSE_PREPARATION", () => {
      expect(isValidTransition("REVIEW_LEGAL", "RESPONSE_PREPARATION")).toBe(
        true
      );
    });

    it("should allow RESPONSE_PREPARATION → RESPONSE_SENT", () => {
      expect(isValidTransition("RESPONSE_PREPARATION", "RESPONSE_SENT")).toBe(
        true
      );
    });

    it("should allow RESPONSE_SENT → CLOSED", () => {
      expect(isValidTransition("RESPONSE_SENT", "CLOSED")).toBe(true);
    });

    it("should allow REJECTED → CLOSED", () => {
      expect(isValidTransition("REJECTED", "CLOSED")).toBe(true);
    });

    it("should NOT allow CLOSED → any state (terminal)", () => {
      expect(isValidTransition("CLOSED", "NEW")).toBe(false);
      expect(isValidTransition("CLOSED", "IDENTITY_VERIFICATION")).toBe(false);
      expect(isValidTransition("CLOSED", "DATA_COLLECTION")).toBe(false);
    });

    it("should NOT allow backward transitions except REVIEW_LEGAL → DATA_COLLECTION", () => {
      expect(isValidTransition("DATA_COLLECTION", "INTAKE_TRIAGE")).toBe(false);
      expect(isValidTransition("RESPONSE_SENT", "REVIEW_LEGAL")).toBe(false);
      expect(isValidTransition("RESPONSE_PREPARATION", "DATA_COLLECTION")).toBe(
        false
      );
    });
  });

  describe("getAllowedTransitions", () => {
    it("should return correct transitions for NEW", () => {
      const allowed = getAllowedTransitions("NEW");
      expect(allowed).toContain("IDENTITY_VERIFICATION");
      expect(allowed).toContain("INTAKE_TRIAGE");
      expect(allowed).toContain("REJECTED");
      expect(allowed).toHaveLength(3);
    });

    it("should return empty array for CLOSED (terminal)", () => {
      const allowed = getAllowedTransitions("CLOSED");
      expect(allowed).toHaveLength(0);
    });

    it("should return CLOSED for REJECTED", () => {
      const allowed = getAllowedTransitions("REJECTED");
      expect(allowed).toEqual(["CLOSED"]);
    });

    it("should include DATA_COLLECTION in REVIEW_LEGAL transitions (send-back)", () => {
      const allowed = getAllowedTransitions("REVIEW_LEGAL");
      expect(allowed).toContain("DATA_COLLECTION");
      expect(allowed).toContain("RESPONSE_PREPARATION");
    });
  });

  describe("STATUS_LABELS", () => {
    it("should have a label for every status", () => {
      const statuses = [
        "NEW",
        "IDENTITY_VERIFICATION",
        "INTAKE_TRIAGE",
        "DATA_COLLECTION",
        "REVIEW_LEGAL",
        "RESPONSE_PREPARATION",
        "RESPONSE_SENT",
        "CLOSED",
        "REJECTED",
      ];
      for (const status of statuses) {
        expect(STATUS_LABELS[status as keyof typeof STATUS_LABELS]).toBeDefined();
        expect(
          STATUS_LABELS[status as keyof typeof STATUS_LABELS].length
        ).toBeGreaterThan(0);
      }
    });
  });

  describe("full workflow path", () => {
    it("should support the happy path: NEW → ... → CLOSED", () => {
      const happyPath = [
        "NEW",
        "IDENTITY_VERIFICATION",
        "INTAKE_TRIAGE",
        "DATA_COLLECTION",
        "REVIEW_LEGAL",
        "RESPONSE_PREPARATION",
        "RESPONSE_SENT",
        "CLOSED",
      ] as const;

      for (let i = 0; i < happyPath.length - 1; i++) {
        expect(
          isValidTransition(happyPath[i], happyPath[i + 1]),
          `${happyPath[i]} → ${happyPath[i + 1]} should be valid`
        ).toBe(true);
      }
    });

    it("should support the rejection path: NEW → REJECTED → CLOSED", () => {
      expect(isValidTransition("NEW", "REJECTED")).toBe(true);
      expect(isValidTransition("REJECTED", "CLOSED")).toBe(true);
    });
  });
});
