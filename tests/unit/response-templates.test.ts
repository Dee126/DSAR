import { describe, it, expect } from "vitest";
import {
  renderPlaceholders,
  evaluateConditionals,
  type TemplateConditional,
} from "@/lib/response-templates";

/* ── renderPlaceholders ────────────────────────────────────────── */

describe("renderPlaceholders", () => {
  it("replaces simple placeholders", () => {
    const result = renderPlaceholders(
      "Dear {{subject.name}}, your case {{case.number}} was received.",
      { "subject.name": "John Doe", "case.number": "DSAR-2026-001" },
    );
    expect(result).toBe("Dear John Doe, your case DSAR-2026-001 was received.");
  });

  it("preserves unmatched placeholders", () => {
    const result = renderPlaceholders(
      "Hello {{subject.name}}, your score is {{unknown_field}}.",
      { "subject.name": "Jane" },
    );
    expect(result).toBe("Hello Jane, your score is {{unknown_field}}.");
  });

  it("handles empty values", () => {
    const result = renderPlaceholders(
      "Name: {{subject.name}}",
      { "subject.name": "" },
    );
    expect(result).toBe("Name: ");
  });

  it("handles no placeholders", () => {
    const result = renderPlaceholders(
      "<p>No placeholders here.</p>",
      { "subject.name": "Test" },
    );
    expect(result).toBe("<p>No placeholders here.</p>");
  });

  it("handles multiple occurrences of same placeholder", () => {
    const result = renderPlaceholders(
      "{{name}} and {{name}} again",
      { name: "Alice" },
    );
    expect(result).toBe("Alice and Alice again");
  });

  it("trims whitespace in placeholder keys", () => {
    const result = renderPlaceholders(
      "{{ subject.name }}",
      { "subject.name": "Bob" },
    );
    expect(result).toBe("Bob");
  });

  it("handles HTML content around placeholders", () => {
    const result = renderPlaceholders(
      "<p>Dear <strong>{{subject.name}}</strong>,</p>",
      { "subject.name": "Carol" },
    );
    expect(result).toBe("<p>Dear <strong>Carol</strong>,</p>");
  });
});

/* ── evaluateConditionals ──────────────────────────────────────── */

describe("evaluateConditionals", () => {
  it("hides sections when show=true but condition is falsy", () => {
    const conditionals: TemplateConditional[] = [
      { condition: "extensionUsed", sectionKey: "extension", show: true },
    ];
    const hidden = evaluateConditionals(conditionals, { extensionUsed: false });
    expect(hidden.has("extension")).toBe(true);
  });

  it("shows sections when show=true and condition is truthy", () => {
    const conditionals: TemplateConditional[] = [
      { condition: "extensionUsed", sectionKey: "extension", show: true },
    ];
    const hidden = evaluateConditionals(conditionals, { extensionUsed: true });
    expect(hidden.has("extension")).toBe(false);
  });

  it("hides sections when show=false and condition is truthy", () => {
    const conditionals: TemplateConditional[] = [
      { condition: "hasNoData", sectionKey: "data_copy", show: false },
    ];
    const hidden = evaluateConditionals(conditionals, { hasNoData: true });
    expect(hidden.has("data_copy")).toBe(true);
  });

  it("shows sections when show=false and condition is falsy", () => {
    const conditionals: TemplateConditional[] = [
      { condition: "hasNoData", sectionKey: "data_copy", show: false },
    ];
    const hidden = evaluateConditionals(conditionals, { hasNoData: false });
    expect(hidden.has("data_copy")).toBe(false);
  });

  it("handles empty conditionals", () => {
    const hidden = evaluateConditionals([], { extensionUsed: true });
    expect(hidden.size).toBe(0);
  });

  it("handles multiple conditionals", () => {
    const conditionals: TemplateConditional[] = [
      { condition: "extensionUsed", sectionKey: "extension", show: true },
      { condition: "specialCategoryData", sectionKey: "special_notice", show: true },
      { condition: "hasExemptions", sectionKey: "exemptions", show: true },
    ];
    const hidden = evaluateConditionals(conditionals, {
      extensionUsed: false,
      specialCategoryData: true,
      hasExemptions: false,
    });
    expect(hidden.has("extension")).toBe(true);
    expect(hidden.has("special_notice")).toBe(false);
    expect(hidden.has("exemptions")).toBe(true);
  });
});
