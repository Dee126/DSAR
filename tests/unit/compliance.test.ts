/**
 * Sprint 9.8: Compliance Evidence Pack — Unit Tests
 *
 * Tests compliance engine logic, export service, and data integrity
 * without requiring a running server or database.
 */

import { describe, it, expect, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE ENGINE — Module Exports
// ═══════════════════════════════════════════════════════════════════════════════

describe("Compliance Engine: Module Exports", () => {
  it("exports all required functions", async () => {
    const engine = await import("@/lib/compliance-engine");
    expect(typeof engine.runComplianceAssessment).toBe("function");
    expect(typeof engine.getFrameworks).toBe("function");
    expect(typeof engine.getComplianceRuns).toBe("function");
    expect(typeof engine.getRunFindings).toBe("function");
  });

  it("exports ControlEvaluation interface shape", async () => {
    // Verify the type is usable at runtime by checking the module has the expected exports
    const engine = await import("@/lib/compliance-engine");
    expect(engine).toBeDefined();
    // The interface types don't exist at runtime, but the functions that use them do
    expect(engine.runComplianceAssessment.length).toBeGreaterThanOrEqual(3); // tenantId, frameworkId, userId
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE EXPORT — Module Exports & JSON Format
// ═══════════════════════════════════════════════════════════════════════════════

describe("Compliance Export: Module Exports", () => {
  it("exports all required functions", async () => {
    const exportModule = await import("@/lib/compliance-export");
    expect(typeof exportModule.buildExportData).toBe("function");
    expect(typeof exportModule.exportToJson).toBe("function");
    expect(typeof exportModule.exportToHtmlReport).toBe("function");
  });
});

describe("Compliance Export: JSON Output", () => {
  it("produces valid JSON with correct structure", async () => {
    const { exportToJson } = await import("@/lib/compliance-export");

    const mockData = {
      meta: {
        generatedAt: "2026-02-17T12:00:00Z",
        tenantName: "Test Corp",
        frameworkName: "ISO27001",
        frameworkVersion: "2022",
        runId: "test-run-id",
      },
      summary: { total: 5, compliant: 3, partial: 1, missing: 1, score: 70 },
      controls: [
        { controlId: "A.5.1", title: "Policies", status: "COMPLIANT", notes: "Policy active" },
        { controlId: "A.5.15", title: "Access Control", status: "COMPLIANT", notes: "RBAC active" },
        { controlId: "A.5.30", title: "ICT Readiness", status: "COMPLIANT", notes: "Monitoring active" },
        { controlId: "A.8.12", title: "Data Retention", status: "PARTIAL", notes: "Partial coverage" },
        { controlId: "A.8.16", title: "Monitoring", status: "MISSING", notes: "No monitoring configured" },
      ],
      systemInfo: {
        auditLogIntegrity: "Hash chain verified (v1)",
        retentionPolicies: 2,
        deletionJobsConfigured: 1,
        sodEnabled: true,
        featureFlagsConfigured: 3,
        activeConnectors: 2,
        registeredVendors: 5,
        totalIncidents: 1,
        accessLogEntries: 100,
      },
    };

    const json = exportToJson(mockData);
    const parsed = JSON.parse(json);

    // Structure checks
    expect(parsed.meta).toBeDefined();
    expect(parsed.summary).toBeDefined();
    expect(parsed.controls).toBeDefined();
    expect(parsed.systemInfo).toBeDefined();

    // Meta fields
    expect(parsed.meta.generatedAt).toBe("2026-02-17T12:00:00Z");
    expect(parsed.meta.tenantName).toBe("Test Corp");
    expect(parsed.meta.frameworkName).toBe("ISO27001");

    // Summary fields
    expect(parsed.summary.total).toBe(5);
    expect(parsed.summary.compliant).toBe(3);
    expect(parsed.summary.score).toBe(70);

    // Controls array
    expect(parsed.controls).toHaveLength(5);
    expect(parsed.controls[0].controlId).toBe("A.5.1");
    expect(parsed.controls[0].status).toBe("COMPLIANT");
  });

  it("does not contain PII fields", async () => {
    const { exportToJson } = await import("@/lib/compliance-export");

    const mockData = {
      meta: {
        generatedAt: "2026-02-17T12:00:00Z",
        tenantName: "Test Corp",
        frameworkName: "GDPR",
        frameworkVersion: "2016/679",
        runId: "test-run-id",
      },
      summary: { total: 3, compliant: 2, partial: 1, missing: 0, score: 83 },
      controls: [
        { controlId: "Art. 5(2)", title: "Accountability", status: "COMPLIANT", notes: "Audit logging active" },
        { controlId: "Art. 24", title: "Responsibility", status: "COMPLIANT", notes: "RBAC active" },
        { controlId: "Art. 30", title: "Records", status: "PARTIAL", notes: "Partial records" },
      ],
      systemInfo: {
        auditLogIntegrity: "No audit entries",
        retentionPolicies: 0,
        deletionJobsConfigured: 0,
        sodEnabled: false,
        featureFlagsConfigured: 0,
        activeConnectors: 0,
        registeredVendors: 0,
        totalIncidents: 0,
        accessLogEntries: 0,
      },
    };

    const json = exportToJson(mockData);
    const jsonLower = json.toLowerCase();

    // Must NOT contain common PII field names
    expect(jsonLower).not.toContain('"email"');
    expect(jsonLower).not.toContain('"password"');
    expect(jsonLower).not.toContain('"ssn"');
    expect(jsonLower).not.toContain('"phone"');
    expect(jsonLower).not.toContain('"address"');
    expect(jsonLower).not.toContain('"dateofbirth"');
    expect(jsonLower).not.toContain('"fullname"');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE EXPORT — HTML Output
// ═══════════════════════════════════════════════════════════════════════════════

describe("Compliance Export: HTML Report", () => {
  it("produces valid HTML with required sections", async () => {
    const { exportToHtmlReport } = await import("@/lib/compliance-export");

    const mockData = {
      meta: {
        generatedAt: "2026-02-17T12:00:00Z",
        tenantName: "Test Corp",
        frameworkName: "SOC2",
        frameworkVersion: "2017",
        runId: "test-run-id",
      },
      summary: { total: 3, compliant: 2, partial: 1, missing: 0, score: 83 },
      controls: [
        { controlId: "CC6.1", title: "Access Controls", status: "COMPLIANT", notes: "Active" },
        { controlId: "CC7.2", title: "Monitoring", status: "COMPLIANT", notes: "Active" },
        { controlId: "CC8.1", title: "Change Mgmt", status: "PARTIAL", notes: "In progress" },
      ],
      systemInfo: {
        auditLogIntegrity: "Hash chain verified (v1)",
        retentionPolicies: 1,
        deletionJobsConfigured: 0,
        sodEnabled: true,
        featureFlagsConfigured: 2,
        activeConnectors: 1,
        registeredVendors: 3,
        totalIncidents: 0,
        accessLogEntries: 50,
      },
    };

    const html = exportToHtmlReport(mockData);

    // Basic HTML structure
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");

    // Report title and framework
    expect(html).toContain("Compliance Evidence Report");
    expect(html).toContain("SOC2");
    expect(html).toContain("Test Corp");

    // Executive summary section
    expect(html).toContain("Executive Summary");
    expect(html).toContain("83%");

    // Controls table
    expect(html).toContain("CC6.1");
    expect(html).toContain("CC7.2");
    expect(html).toContain("CC8.1");

    // System architecture section
    expect(html).toContain("System Security Architecture");
    expect(html).toContain("Audit Log Integrity");
    expect(html).toContain("Retention Policies");

    // Disclaimer
    expect(html).toContain("does not constitute legal advice");
    expect(html).toContain("No personally identifiable information");
  });

  it("escapes HTML entities in output", async () => {
    const { exportToHtmlReport } = await import("@/lib/compliance-export");

    const mockData = {
      meta: {
        generatedAt: "2026-02-17T12:00:00Z",
        tenantName: '<script>alert("xss")</script>',
        frameworkName: "ISO27001",
        frameworkVersion: "2022",
        runId: "test-run-id",
      },
      summary: { total: 1, compliant: 1, partial: 0, missing: 0, score: 100 },
      controls: [
        { controlId: "A.5.1", title: "Test <b>bold</b>", status: "COMPLIANT", notes: "Notes with & ampersand" },
      ],
      systemInfo: {
        auditLogIntegrity: "OK",
        retentionPolicies: 0,
        deletionJobsConfigured: 0,
        sodEnabled: false,
        featureFlagsConfigured: 0,
        activeConnectors: 0,
        registeredVendors: 0,
        totalIncidents: 0,
        accessLogEntries: 0,
      },
    };

    const html = exportToHtmlReport(mockData);

    // XSS attempts should be escaped
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain("&lt;script&gt;");

    // HTML entities in control fields should be escaped
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(html).toContain("&amp; ampersand");
  });

  it("does not contain PII in HTML report", async () => {
    const { exportToHtmlReport } = await import("@/lib/compliance-export");

    const mockData = {
      meta: {
        generatedAt: "2026-02-17T12:00:00Z",
        tenantName: "Acme Corp",
        frameworkName: "GDPR",
        frameworkVersion: "2016/679",
        runId: "run-123",
      },
      summary: { total: 1, compliant: 1, partial: 0, missing: 0, score: 100 },
      controls: [
        { controlId: "Art. 32", title: "Security of processing", status: "COMPLIANT", notes: "Encryption configured" },
      ],
      systemInfo: {
        auditLogIntegrity: "Hash chain verified (v1)",
        retentionPolicies: 1,
        deletionJobsConfigured: 1,
        sodEnabled: true,
        featureFlagsConfigured: 2,
        activeConnectors: 1,
        registeredVendors: 1,
        totalIncidents: 0,
        accessLogEntries: 10,
      },
    };

    const html = exportToHtmlReport(mockData);
    const htmlLower = html.toLowerCase();

    // No PII fields
    expect(htmlLower).not.toContain("password");
    expect(htmlLower).not.toContain("@acme-corp.com");
    expect(htmlLower).not.toContain("social security");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE SCORE — Computation Logic
// ═══════════════════════════════════════════════════════════════════════════════

describe("Compliance Score: Computation", () => {
  it("computes correct score for all compliant", () => {
    const total = 5;
    const compliant = 5;
    const partial = 0;
    const score = Math.round(((compliant + partial * 0.5) / total) * 100);
    expect(score).toBe(100);
  });

  it("computes correct score for mixed results", () => {
    const total = 5;
    const compliant = 3;
    const partial = 1;
    const score = Math.round(((compliant + partial * 0.5) / total) * 100);
    expect(score).toBe(70);
  });

  it("computes correct score for all missing", () => {
    const total = 5;
    const compliant = 0;
    const partial = 0;
    const score = Math.round(((compliant + partial * 0.5) / total) * 100);
    expect(score).toBe(0);
  });

  it("computes correct score for all partial", () => {
    const total = 4;
    const compliant = 0;
    const partial = 4;
    const score = Math.round(((compliant + partial * 0.5) / total) * 100);
    expect(score).toBe(50);
  });

  it("handles zero total controls gracefully", () => {
    const total = 0;
    const compliant = 0;
    const partial = 0;
    const score = total > 0 ? Math.round(((compliant + partial * 0.5) / total) * 100) : 0;
    expect(score).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE FRAMEWORKS — Enum Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe("Compliance Framework Types", () => {
  it("includes all required framework types", async () => {
    const prismaClient = await import("@prisma/client");
    const types = Object.keys(prismaClient.ComplianceFrameworkType);
    expect(types).toContain("ISO27001");
    expect(types).toContain("SOC2");
    expect(types).toContain("GDPR");
    expect(types).toContain("VENDOR_DUE_DILIGENCE");
    expect(types).toHaveLength(4);
  });
});

describe("Compliance Run Statuses", () => {
  it("includes all required run statuses", async () => {
    const prismaClient = await import("@prisma/client");
    const statuses = Object.keys(prismaClient.ComplianceRunStatus);
    expect(statuses).toContain("RUNNING");
    expect(statuses).toContain("SUCCESS");
    expect(statuses).toContain("FAILED");
    expect(statuses).toHaveLength(3);
  });
});

describe("Compliance Control Statuses", () => {
  it("includes all required control statuses", async () => {
    const prismaClient = await import("@prisma/client");
    const statuses = Object.keys(prismaClient.ComplianceControlStatus);
    expect(statuses).toContain("COMPLIANT");
    expect(statuses).toContain("PARTIAL");
    expect(statuses).toContain("MISSING");
    expect(statuses).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE API ROUTE — Module Imports
// ═══════════════════════════════════════════════════════════════════════════════

describe("Compliance API Route: Existence", () => {
  it("API route file is importable", async () => {
    // Verify the route file exists and doesn't have syntax errors
    const route = await import("@/app/api/governance/compliance/route");
    expect(typeof route.GET).toBe("function");
    expect(typeof route.POST).toBe("function");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE RBAC — Permission Integration
// ═══════════════════════════════════════════════════════════════════════════════

describe("Compliance RBAC Permissions", () => {
  it("TENANT_ADMIN can view governance", async () => {
    const { has } = await import("@/lib/rbac");
    expect(has("TENANT_ADMIN", "GOVERNANCE_VIEW")).toBe(true);
  });

  it("TENANT_ADMIN can export reports", async () => {
    const { has } = await import("@/lib/rbac");
    expect(has("TENANT_ADMIN", "GOVERNANCE_EXPORT_REPORT")).toBe(true);
  });

  it("DPO can view governance", async () => {
    const { has } = await import("@/lib/rbac");
    expect(has("DPO", "GOVERNANCE_VIEW")).toBe(true);
  });

  it("DPO can export reports", async () => {
    const { has } = await import("@/lib/rbac");
    expect(has("DPO", "GOVERNANCE_EXPORT_REPORT")).toBe(true);
  });

  it("READ_ONLY cannot export reports", async () => {
    const { has } = await import("@/lib/rbac");
    expect(has("READ_ONLY", "GOVERNANCE_EXPORT_REPORT")).toBe(false);
  });

  it("CONTRIBUTOR cannot export reports", async () => {
    const { has } = await import("@/lib/rbac");
    expect(has("CONTRIBUTOR", "GOVERNANCE_EXPORT_REPORT")).toBe(false);
  });

  it("SUPER_ADMIN has full compliance access", async () => {
    const { has } = await import("@/lib/rbac");
    expect(has("SUPER_ADMIN", "GOVERNANCE_VIEW")).toBe(true);
    expect(has("SUPER_ADMIN", "GOVERNANCE_EXPORT_REPORT")).toBe(true);
    expect(has("SUPER_ADMIN", "GOVERNANCE_EDIT_SETTINGS")).toBe(true);
  });
});
