import { describe, it, expect } from "vitest";
import { maskEmail } from "@/lib/data-assembly";

/* ── maskEmail ─────────────────────────────────────────────────── */

describe("maskEmail", () => {
  it("masks standard email address", () => {
    expect(maskEmail("john.doe@example.com")).toBe("j***@example.com");
  });

  it("masks single-character local part", () => {
    expect(maskEmail("j@example.com")).toBe("j***@example.com");
  });

  it("returns empty string for empty input", () => {
    expect(maskEmail("")).toBe("");
  });

  it("returns input if no @ sign", () => {
    expect(maskEmail("not-an-email")).toBe("not-an-email");
  });

  it("preserves domain", () => {
    const result = maskEmail("admin@acme-corp.com");
    expect(result).toContain("@acme-corp.com");
    expect(result.startsWith("a***")).toBe(true);
  });

  it("handles long local parts", () => {
    const result = maskEmail("verylongemailaddress@example.org");
    expect(result).toBe("v***@example.org");
  });
});
