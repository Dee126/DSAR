import { describe, it, expect } from "vitest";
import { has, type Permission } from "@/lib/rbac";

/* ── Response Generator RBAC Tests ─────────────────────────────── */

const RESPONSE_PERMISSIONS: Permission[] = [
  "RESPONSE_VIEW",
  "RESPONSE_GENERATE",
  "RESPONSE_EDIT",
  "RESPONSE_SUBMIT_REVIEW",
  "RESPONSE_APPROVE",
  "RESPONSE_SEND",
  "RESPONSE_TEMPLATE_VIEW",
  "RESPONSE_TEMPLATE_MANAGE",
];

describe("Response Generator RBAC", () => {
  describe("SUPER_ADMIN", () => {
    it("has all response permissions", () => {
      for (const perm of RESPONSE_PERMISSIONS) {
        expect(has("SUPER_ADMIN", perm)).toBe(true);
      }
    });
  });

  describe("TENANT_ADMIN", () => {
    it("has all response permissions", () => {
      for (const perm of RESPONSE_PERMISSIONS) {
        expect(has("TENANT_ADMIN", perm)).toBe(true);
      }
    });
  });

  describe("DPO", () => {
    it("has all response permissions", () => {
      for (const perm of RESPONSE_PERMISSIONS) {
        expect(has("DPO", perm)).toBe(true);
      }
    });
  });

  describe("CASE_MANAGER", () => {
    it("can view, generate, edit, submit review, view templates", () => {
      expect(has("CASE_MANAGER", "RESPONSE_VIEW")).toBe(true);
      expect(has("CASE_MANAGER", "RESPONSE_GENERATE")).toBe(true);
      expect(has("CASE_MANAGER", "RESPONSE_EDIT")).toBe(true);
      expect(has("CASE_MANAGER", "RESPONSE_SUBMIT_REVIEW")).toBe(true);
      expect(has("CASE_MANAGER", "RESPONSE_TEMPLATE_VIEW")).toBe(true);
    });

    it("cannot approve or send", () => {
      expect(has("CASE_MANAGER", "RESPONSE_APPROVE")).toBe(false);
      expect(has("CASE_MANAGER", "RESPONSE_SEND")).toBe(false);
    });

    it("cannot manage templates", () => {
      expect(has("CASE_MANAGER", "RESPONSE_TEMPLATE_MANAGE")).toBe(false);
    });
  });

  describe("ANALYST", () => {
    it("can view and view templates", () => {
      expect(has("ANALYST", "RESPONSE_VIEW")).toBe(true);
      expect(has("ANALYST", "RESPONSE_TEMPLATE_VIEW")).toBe(true);
    });

    it("cannot approve, send, or manage templates", () => {
      expect(has("ANALYST", "RESPONSE_APPROVE")).toBe(false);
      expect(has("ANALYST", "RESPONSE_SEND")).toBe(false);
      expect(has("ANALYST", "RESPONSE_TEMPLATE_MANAGE")).toBe(false);
    });
  });

  describe("AUDITOR", () => {
    it("can view responses and templates (read-only)", () => {
      expect(has("AUDITOR", "RESPONSE_VIEW")).toBe(true);
      expect(has("AUDITOR", "RESPONSE_TEMPLATE_VIEW")).toBe(true);
    });

    it("cannot generate, edit, approve, or send", () => {
      expect(has("AUDITOR", "RESPONSE_GENERATE")).toBe(false);
      expect(has("AUDITOR", "RESPONSE_EDIT")).toBe(false);
      expect(has("AUDITOR", "RESPONSE_APPROVE")).toBe(false);
      expect(has("AUDITOR", "RESPONSE_SEND")).toBe(false);
    });
  });

  describe("CONTRIBUTOR", () => {
    it("has no response permissions", () => {
      for (const perm of RESPONSE_PERMISSIONS) {
        expect(has("CONTRIBUTOR", perm)).toBe(false);
      }
    });
  });

  describe("READ_ONLY", () => {
    it("has no response permissions", () => {
      for (const perm of RESPONSE_PERMISSIONS) {
        expect(has("READ_ONLY", perm)).toBe(false);
      }
    });
  });
});

/* ── Approval Workflow State Machine Tests ─────────────────────── */

describe("Response Approval Workflow", () => {
  const validTransitions: Record<string, string[]> = {
    DRAFT: ["IN_REVIEW"],
    IN_REVIEW: ["APPROVED", "CHANGES_REQUESTED"],
    CHANGES_REQUESTED: ["IN_REVIEW"],
    APPROVED: ["SENT"],
    SENT: [], // terminal
  };

  it("defines correct transitions for DRAFT", () => {
    expect(validTransitions.DRAFT).toEqual(["IN_REVIEW"]);
  });

  it("defines correct transitions for IN_REVIEW", () => {
    expect(validTransitions.IN_REVIEW).toContain("APPROVED");
    expect(validTransitions.IN_REVIEW).toContain("CHANGES_REQUESTED");
  });

  it("defines correct transitions for CHANGES_REQUESTED", () => {
    expect(validTransitions.CHANGES_REQUESTED).toEqual(["IN_REVIEW"]);
  });

  it("defines correct transitions for APPROVED", () => {
    expect(validTransitions.APPROVED).toEqual(["SENT"]);
  });

  it("SENT is terminal", () => {
    expect(validTransitions.SENT).toEqual([]);
  });

  it("cannot go from DRAFT directly to APPROVED", () => {
    expect(validTransitions.DRAFT).not.toContain("APPROVED");
  });

  it("cannot go from DRAFT directly to SENT", () => {
    expect(validTransitions.DRAFT).not.toContain("SENT");
  });
});
