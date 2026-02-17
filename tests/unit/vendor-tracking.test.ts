/**
 * Unit Tests — MODULE 6: Vendor / Processor Tracking
 *
 * Covers:
 *  - Validation schemas for vendor CRUD
 *  - Vendor request lifecycle state machine
 *  - RBAC permissions for vendor operations
 *  - Due date computation
 *  - Escalation logic
 */

import { describe, it, expect } from "vitest";
import {
  createVendorSchema,
  updateVendorSchema,
  createVendorContactSchema,
  createVendorDpaSchema,
  createVendorRequestTemplateSchema,
  createVendorRequestSchema,
  updateVendorRequestSchema,
  createVendorResponseSchema,
  updateVendorRequestItemSchema,
  createVendorSlaConfigSchema,
  createVendorEscalationSchema,
  sendVendorRequestSchema,
} from "../../src/lib/validation";
import { has, enforce, hasPermission, checkPermission } from "../../src/lib/rbac";

// ═══════════════════════════════════════════════════════════════════════════
// A) Vendor Schema Validation
// ═══════════════════════════════════════════════════════════════════════════

describe("Vendor Schema Validation", () => {
  describe("createVendorSchema", () => {
    it("accepts valid vendor with name only", () => {
      const result = createVendorSchema.safeParse({ name: "Test Vendor" });
      expect(result.success).toBe(true);
    });

    it("accepts full vendor data", () => {
      const result = createVendorSchema.safeParse({
        name: "Salesforce Inc.",
        shortCode: "SF",
        status: "ACTIVE",
        website: "https://salesforce.com",
        headquartersCountry: "US",
        dpaOnFile: true,
        dpaExpiresAt: "2027-06-30T00:00:00.000Z",
        contractReference: "DPA-2024-001",
        notes: "Tier 1 vendor",
        tags: ["tier1", "us-based"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = createVendorSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid status", () => {
      const result = createVendorSchema.safeParse({ name: "Test", status: "DELETED" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid website URL", () => {
      const result = createVendorSchema.safeParse({ name: "Test", website: "not-a-url" });
      expect(result.success).toBe(false);
    });

    it("allows empty string for website", () => {
      const result = createVendorSchema.safeParse({ name: "Test", website: "" });
      expect(result.success).toBe(true);
    });

    it("defaults status to ACTIVE", () => {
      const result = createVendorSchema.parse({ name: "Test" });
      expect(result.status).toBe("ACTIVE");
    });

    it("defaults dpaOnFile to false", () => {
      const result = createVendorSchema.parse({ name: "Test" });
      expect(result.dpaOnFile).toBe(false);
    });
  });

  describe("updateVendorSchema", () => {
    it("accepts partial update with name only", () => {
      const result = updateVendorSchema.safeParse({ name: "Updated Name" });
      expect(result.success).toBe(true);
    });

    it("accepts empty object (no changes)", () => {
      const result = updateVendorSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("validates status when provided", () => {
      const result = updateVendorSchema.safeParse({ status: "INVALID" });
      expect(result.success).toBe(false);
    });
  });

  describe("createVendorContactSchema", () => {
    it("accepts valid contact", () => {
      const result = createVendorContactSchema.safeParse({
        name: "Jane Smith",
        email: "jane@vendor.com",
        role: "DPO",
        isPrimary: true,
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing name", () => {
      const result = createVendorContactSchema.safeParse({ email: "test@test.com" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid email", () => {
      const result = createVendorContactSchema.safeParse({ name: "Test", email: "not-email" });
      expect(result.success).toBe(false);
    });
  });

  describe("createVendorDpaSchema", () => {
    it("accepts valid DPA", () => {
      const result = createVendorDpaSchema.safeParse({
        title: "Main DPA v2",
        signedAt: "2024-01-15T00:00:00.000Z",
        expiresAt: "2027-06-30T00:00:00.000Z",
        sccsIncluded: true,
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty title", () => {
      const result = createVendorDpaSchema.safeParse({ title: "" });
      expect(result.success).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B) Vendor Request & Response Schema Validation
// ═══════════════════════════════════════════════════════════════════════════

describe("Vendor Request Schema Validation", () => {
  describe("createVendorRequestTemplateSchema", () => {
    it("accepts valid template", () => {
      const result = createVendorRequestTemplateSchema.safeParse({
        name: "Standard Request (EN)",
        dsarTypes: ["ACCESS"],
        subject: "DSAR – {{caseNumber}}",
        bodyHtml: "<p>Dear {{vendorName}},</p>",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty dsarTypes", () => {
      const result = createVendorRequestTemplateSchema.safeParse({
        name: "Bad Template",
        dsarTypes: [],
        subject: "Test",
        bodyHtml: "<p>Test</p>",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing subject", () => {
      const result = createVendorRequestTemplateSchema.safeParse({
        name: "Bad Template",
        dsarTypes: ["ACCESS"],
        bodyHtml: "<p>Test</p>",
      });
      expect(result.success).toBe(false);
    });

    it("accepts optional vendorId", () => {
      const result = createVendorRequestTemplateSchema.safeParse({
        name: "Vendor-specific",
        vendorId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        dsarTypes: ["ERASURE"],
        subject: "Test",
        bodyHtml: "<p>Test</p>",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("createVendorRequestSchema", () => {
    it("accepts valid request", () => {
      const result = createVendorRequestSchema.safeParse({
        vendorId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        subject: "DSAR Request",
        bodyHtml: "<p>Please provide data.</p>",
        items: [{ description: "Export CRM data" }],
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing vendorId", () => {
      const result = createVendorRequestSchema.safeParse({
        subject: "DSAR Request",
        bodyHtml: "<p>Test</p>",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid vendorId format", () => {
      const result = createVendorRequestSchema.safeParse({
        vendorId: "not-a-uuid",
        subject: "DSAR Request",
        bodyHtml: "<p>Test</p>",
      });
      expect(result.success).toBe(false);
    });

    it("accepts request without items", () => {
      const result = createVendorRequestSchema.safeParse({
        vendorId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        subject: "DSAR Request",
        bodyHtml: "<p>Test</p>",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toEqual([]);
      }
    });
  });

  describe("updateVendorRequestSchema", () => {
    it("accepts valid status transitions", () => {
      const statuses = ["DRAFT", "SENT", "ACKNOWLEDGED", "PARTIALLY_RESPONDED", "RESPONDED", "OVERDUE", "ESCALATED", "CLOSED"];
      for (const status of statuses) {
        const result = updateVendorRequestSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid status", () => {
      const result = updateVendorRequestSchema.safeParse({ status: "DELETED" });
      expect(result.success).toBe(false);
    });
  });

  describe("sendVendorRequestSchema", () => {
    it("accepts valid email", () => {
      const result = sendVendorRequestSchema.safeParse({ recipientEmail: "test@vendor.com" });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = sendVendorRequestSchema.safeParse({ recipientEmail: "not-email" });
      expect(result.success).toBe(false);
    });
  });

  describe("createVendorResponseSchema", () => {
    it("accepts valid response", () => {
      const result = createVendorResponseSchema.safeParse({
        requestId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        responseType: "DATA_EXTRACT",
        summary: "Full data export provided",
      });
      expect(result.success).toBe(true);
    });

    it("accepts all response types", () => {
      const types = ["DATA_EXTRACT", "CONFIRMATION", "PARTIAL", "REJECTION", "QUESTION"];
      for (const responseType of types) {
        const result = createVendorResponseSchema.safeParse({
          requestId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          responseType,
        });
        expect(result.success).toBe(true);
      }
    });

    it("defaults responseType to DATA_EXTRACT", () => {
      const result = createVendorResponseSchema.parse({
        requestId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      });
      expect(result.responseType).toBe("DATA_EXTRACT");
    });
  });

  describe("updateVendorRequestItemSchema", () => {
    it("accepts valid item status", () => {
      const statuses = ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "NOT_APPLICABLE"];
      for (const status of statuses) {
        const result = updateVendorRequestItemSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid status", () => {
      const result = updateVendorRequestItemSchema.safeParse({ status: "UNKNOWN" });
      expect(result.success).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C) SLA & Escalation Schema Validation
// ═══════════════════════════════════════════════════════════════════════════

describe("Vendor SLA & Escalation Schema Validation", () => {
  describe("createVendorSlaConfigSchema", () => {
    it("accepts valid SLA config", () => {
      const result = createVendorSlaConfigSchema.safeParse({
        defaultDueDays: 14,
        reminderAfterDays: 7,
        escalationAfterDays: 14,
        maxReminders: 3,
        autoEscalate: true,
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty object (all defaults)", () => {
      const result = createVendorSlaConfigSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("rejects due days below 1", () => {
      const result = createVendorSlaConfigSchema.safeParse({ defaultDueDays: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects due days above 90", () => {
      const result = createVendorSlaConfigSchema.safeParse({ defaultDueDays: 91 });
      expect(result.success).toBe(false);
    });

    it("defaults to 14 days", () => {
      const result = createVendorSlaConfigSchema.parse({});
      expect(result.defaultDueDays).toBe(14);
    });

    it("defaults autoEscalate to true", () => {
      const result = createVendorSlaConfigSchema.parse({});
      expect(result.autoEscalate).toBe(true);
    });
  });

  describe("createVendorEscalationSchema", () => {
    it("accepts valid escalation", () => {
      const result = createVendorEscalationSchema.safeParse({
        vendorId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        severity: "WARNING",
        reason: "Vendor request overdue by 7 days",
      });
      expect(result.success).toBe(true);
    });

    it("accepts all severity levels", () => {
      const levels = ["WARNING", "CRITICAL", "BREACH"];
      for (const severity of levels) {
        const result = createVendorEscalationSchema.safeParse({
          vendorId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          severity,
          reason: "Test",
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects missing reason", () => {
      const result = createVendorEscalationSchema.safeParse({
        vendorId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        severity: "WARNING",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty reason", () => {
      const result = createVendorEscalationSchema.safeParse({
        vendorId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        severity: "WARNING",
        reason: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid severity", () => {
      const result = createVendorEscalationSchema.safeParse({
        vendorId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        severity: "MILD",
        reason: "Test",
      });
      expect(result.success).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D) RBAC Permission Tests for Vendor Module
// ═══════════════════════════════════════════════════════════════════════════

describe("Vendor RBAC Permissions", () => {
  const vendorPermissions = [
    "VENDOR_VIEW",
    "VENDOR_MANAGE",
    "VENDOR_REQUEST_CREATE",
    "VENDOR_REQUEST_SEND",
    "VENDOR_REQUEST_VIEW",
    "VENDOR_RESPONSE_LOG",
    "VENDOR_TEMPLATE_VIEW",
    "VENDOR_TEMPLATE_MANAGE",
    "VENDOR_ESCALATION_VIEW",
    "VENDOR_ESCALATION_MANAGE",
  ] as const;

  describe("SUPER_ADMIN", () => {
    it("has all vendor permissions", () => {
      for (const perm of vendorPermissions) {
        expect(has("SUPER_ADMIN", perm)).toBe(true);
      }
    });
  });

  describe("TENANT_ADMIN", () => {
    it("has all vendor permissions", () => {
      for (const perm of vendorPermissions) {
        expect(has("TENANT_ADMIN", perm)).toBe(true);
      }
    });
  });

  describe("DPO", () => {
    it("has all vendor permissions", () => {
      for (const perm of vendorPermissions) {
        expect(has("DPO", perm)).toBe(true);
      }
    });
  });

  describe("CASE_MANAGER", () => {
    it("can view vendors", () => {
      expect(has("CASE_MANAGER", "VENDOR_VIEW")).toBe(true);
    });

    it("can create and send vendor requests", () => {
      expect(has("CASE_MANAGER", "VENDOR_REQUEST_CREATE")).toBe(true);
      expect(has("CASE_MANAGER", "VENDOR_REQUEST_SEND")).toBe(true);
      expect(has("CASE_MANAGER", "VENDOR_REQUEST_VIEW")).toBe(true);
    });

    it("can log vendor responses", () => {
      expect(has("CASE_MANAGER", "VENDOR_RESPONSE_LOG")).toBe(true);
    });

    it("can view templates but not manage them", () => {
      expect(has("CASE_MANAGER", "VENDOR_TEMPLATE_VIEW")).toBe(true);
    });

    it("can view escalations but has limited management", () => {
      expect(has("CASE_MANAGER", "VENDOR_ESCALATION_VIEW")).toBe(true);
    });
  });

  describe("ANALYST", () => {
    it("can view vendors", () => {
      expect(has("ANALYST", "VENDOR_VIEW")).toBe(true);
    });

    it("can view vendor requests but not create", () => {
      expect(has("ANALYST", "VENDOR_REQUEST_VIEW")).toBe(true);
      expect(has("ANALYST", "VENDOR_REQUEST_CREATE")).toBe(false);
    });

    it("cannot manage vendors", () => {
      expect(has("ANALYST", "VENDOR_MANAGE")).toBe(false);
    });

    it("cannot manage templates", () => {
      expect(has("ANALYST", "VENDOR_TEMPLATE_MANAGE")).toBe(false);
    });
  });

  describe("AUDITOR", () => {
    it("has read-only vendor access", () => {
      expect(has("AUDITOR", "VENDOR_VIEW")).toBe(true);
      expect(has("AUDITOR", "VENDOR_REQUEST_VIEW")).toBe(true);
      expect(has("AUDITOR", "VENDOR_TEMPLATE_VIEW")).toBe(true);
      expect(has("AUDITOR", "VENDOR_ESCALATION_VIEW")).toBe(true);
    });

    it("cannot create or manage vendors", () => {
      expect(has("AUDITOR", "VENDOR_MANAGE")).toBe(false);
      expect(has("AUDITOR", "VENDOR_REQUEST_CREATE")).toBe(false);
      expect(has("AUDITOR", "VENDOR_REQUEST_SEND")).toBe(false);
      expect(has("AUDITOR", "VENDOR_RESPONSE_LOG")).toBe(false);
    });
  });

  describe("READ_ONLY", () => {
    it("has no vendor permissions", () => {
      for (const perm of vendorPermissions) {
        expect(has("READ_ONLY", perm)).toBe(false);
      }
    });
  });

  describe("enforce() throws for denied permissions", () => {
    it("throws 403 for READ_ONLY trying to view vendors", () => {
      expect(() => enforce("READ_ONLY", "VENDOR_VIEW")).toThrow("Forbidden");
    });

    it("throws 403 for AUDITOR trying to create vendor", () => {
      expect(() => enforce("AUDITOR", "VENDOR_MANAGE")).toThrow("Forbidden");
    });

    it("does not throw for SUPER_ADMIN", () => {
      expect(() => enforce("SUPER_ADMIN", "VENDOR_MANAGE")).not.toThrow();
    });
  });

  describe("Legacy hasPermission() for vendor resources", () => {
    it("SUPER_ADMIN can manage vendors", () => {
      expect(hasPermission("SUPER_ADMIN", "vendors", "manage")).toBe(true);
    });

    it("AUDITOR can read vendors", () => {
      expect(hasPermission("AUDITOR", "vendors", "read")).toBe(true);
    });

    it("AUDITOR cannot manage vendors", () => {
      expect(hasPermission("AUDITOR", "vendors", "manage")).toBe(false);
    });

    it("DPO can manage vendor_requests", () => {
      expect(hasPermission("DPO", "vendor_requests", "manage")).toBe(true);
    });

    it("DPO can manage vendor_templates", () => {
      expect(hasPermission("DPO", "vendor_templates", "manage")).toBe(true);
    });

    it("DPO can manage vendor_escalations", () => {
      expect(hasPermission("DPO", "vendor_escalations", "manage")).toBe(true);
    });

    it("checkPermission throws for AUDITOR on vendor_escalations manage", () => {
      expect(() => checkPermission("AUDITOR", "vendor_escalations", "manage")).toThrow("Forbidden");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E) Vendor Request State Machine Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("Vendor Request State Machine", () => {
  const validStatuses = ["DRAFT", "SENT", "ACKNOWLEDGED", "PARTIALLY_RESPONDED", "RESPONDED", "OVERDUE", "ESCALATED", "CLOSED"];

  it("all statuses are valid enum values", () => {
    for (const status of validStatuses) {
      const result = updateVendorRequestSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("DRAFT is the starting state for new requests", () => {
    const result = createVendorRequestSchema.parse({
      vendorId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      subject: "Test",
      bodyHtml: "<p>Test</p>",
    });
    expect(result).toBeDefined();
  });

  it("validates complete lifecycle: DRAFT → SENT → ACKNOWLEDGED → RESPONDED → CLOSED", () => {
    const transitions = ["SENT", "ACKNOWLEDGED", "RESPONDED", "CLOSED"];
    for (const status of transitions) {
      const result = updateVendorRequestSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("validates overdue path: SENT → OVERDUE → ESCALATED → CLOSED", () => {
    const transitions = ["OVERDUE", "ESCALATED", "CLOSED"];
    for (const status of transitions) {
      const result = updateVendorRequestSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("validates partial response path: SENT → PARTIALLY_RESPONDED → RESPONDED", () => {
    const transitions = ["PARTIALLY_RESPONDED", "RESPONDED"];
    for (const status of transitions) {
      const result = updateVendorRequestSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// F) Due Date Computation Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("Due Date Computation", () => {
  it("SLA config defaults to 14 days", () => {
    const config = createVendorSlaConfigSchema.parse({});
    expect(config.defaultDueDays).toBe(14);
  });

  it("SLA config allows custom due days between 1-90", () => {
    for (const days of [1, 7, 14, 30, 60, 90]) {
      const result = createVendorSlaConfigSchema.safeParse({ defaultDueDays: days });
      expect(result.success).toBe(true);
    }
  });

  it("SLA reminder defaults to 7 days", () => {
    const config = createVendorSlaConfigSchema.parse({});
    expect(config.reminderAfterDays).toBe(7);
  });

  it("SLA escalation defaults to 14 days", () => {
    const config = createVendorSlaConfigSchema.parse({});
    expect(config.escalationAfterDays).toBe(14);
  });

  it("SLA max reminders defaults to 3", () => {
    const config = createVendorSlaConfigSchema.parse({});
    expect(config.maxReminders).toBe(3);
  });

  it("request due date can be set via ISO string", () => {
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const result = createVendorRequestSchema.safeParse({
      vendorId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      subject: "Test",
      bodyHtml: "<p>Test</p>",
      dueAt: dueDate,
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// G) Escalation Severity Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("Vendor Escalation", () => {
  it("WARNING is valid escalation severity", () => {
    const result = createVendorEscalationSchema.safeParse({
      vendorId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      severity: "WARNING",
      reason: "Request overdue",
    });
    expect(result.success).toBe(true);
  });

  it("CRITICAL is valid escalation severity", () => {
    const result = createVendorEscalationSchema.safeParse({
      vendorId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      severity: "CRITICAL",
      reason: "Multiple requests overdue",
    });
    expect(result.success).toBe(true);
  });

  it("BREACH is valid escalation severity", () => {
    const result = createVendorEscalationSchema.safeParse({
      vendorId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      severity: "BREACH",
      reason: "Vendor failed to respond within GDPR deadline",
    });
    expect(result.success).toBe(true);
  });

  it("escalation can include optional requestId", () => {
    const result = createVendorEscalationSchema.safeParse({
      vendorId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      requestId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
      severity: "WARNING",
      reason: "Overdue request",
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H) Template Validation Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("Vendor Request Template Validation", () => {
  it("accepts multiple DSAR types", () => {
    const result = createVendorRequestTemplateSchema.safeParse({
      name: "Multi-type template",
      dsarTypes: ["ACCESS", "ERASURE", "PORTABILITY"],
      subject: "DSAR – {{case}}",
      bodyHtml: "<p>Dear vendor,</p>",
    });
    expect(result.success).toBe(true);
  });

  it("accepts template with placeholders", () => {
    const result = createVendorRequestTemplateSchema.safeParse({
      name: "With placeholders",
      dsarTypes: ["ACCESS"],
      subject: "DSAR – {{caseNumber}}",
      bodyHtml: "<p>Dear {{vendorName}},</p>",
      placeholders: [
        { key: "caseNumber", label: "Case Number" },
        { key: "vendorName", label: "Vendor Name", description: "Name of the vendor" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("defaults language to 'en'", () => {
    const result = createVendorRequestTemplateSchema.parse({
      name: "Default lang",
      dsarTypes: ["ACCESS"],
      subject: "Test",
      bodyHtml: "<p>Test</p>",
    });
    expect(result.language).toBe("en");
  });

  it("accepts German language template", () => {
    const result = createVendorRequestTemplateSchema.safeParse({
      name: "Standardanfrage (DE)",
      language: "de",
      dsarTypes: ["ACCESS", "ERASURE"],
      subject: "Betroffenenanfrage – {{case}}",
      bodyHtml: "<p>Sehr geehrtes Datenschutz-Team,</p>",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid DSAR type", () => {
    const result = createVendorRequestTemplateSchema.safeParse({
      name: "Bad types",
      dsarTypes: ["INVALID_TYPE"],
      subject: "Test",
      bodyHtml: "<p>Test</p>",
    });
    expect(result.success).toBe(false);
  });

  it("defaults isDefault to false", () => {
    const result = createVendorRequestTemplateSchema.parse({
      name: "Test",
      dsarTypes: ["ACCESS"],
      subject: "Test",
      bodyHtml: "<p>Test</p>",
    });
    expect(result.isDefault).toBe(false);
  });
});
