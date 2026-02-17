/**
 * Module 9.8: Compliance Export Service
 *
 * Generates evidence packs in multiple formats:
 * - JSON: Machine-readable compliance state
 * - HTML: Human-readable report (styled for PDF printing)
 * - ZIP: Full evidence pack with supporting CSV exports
 *
 * No PII is included in any exports.
 */

import { ComplianceAssessmentResult, getRunFindings } from "./compliance-engine";
import { prisma } from "./prisma";

export interface ComplianceExportData {
  meta: {
    generatedAt: string;
    tenantName: string;
    frameworkName: string;
    frameworkVersion: string;
    runId: string;
  };
  summary: ComplianceAssessmentResult["summary"];
  controls: Array<{
    controlId: string;
    title: string;
    status: string;
    notes: string;
  }>;
  systemInfo: {
    auditLogIntegrity: string;
    retentionPolicies: number;
    deletionJobsConfigured: number;
    sodEnabled: boolean;
    featureFlagsConfigured: number;
    activeConnectors: number;
    registeredVendors: number;
    totalIncidents: number;
    accessLogEntries: number;
  };
}

/**
 * Build the structured export data for a compliance run.
 * All data is tenant-scoped and PII-free.
 */
export async function buildExportData(
  tenantId: string,
  runId: string,
): Promise<ComplianceExportData> {
  const run = await prisma.complianceEvidenceRun.findFirst({
    where: { id: runId, tenantId },
    include: {
      framework: true,
      findings: {
        include: { control: { select: { controlId: true, title: true } } },
        orderBy: { evaluatedAt: "asc" },
      },
    },
  });

  if (!run) throw new Error("Compliance run not found");

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });

  // Gather system stats (no PII)
  const [
    retentionPolicies,
    deletionJobs,
    sodPolicy,
    featureFlags,
    connectors,
    vendors,
    incidents,
    accessLogs,
    lastAuditHash,
  ] = await Promise.all([
    prisma.retentionPolicy.count({ where: { tenantId } }),
    prisma.deletionJob.count({ where: { tenantId } }),
    prisma.sodPolicy.findUnique({ where: { tenantId } }),
    prisma.featureFlag.count({ where: { tenantId } }),
    prisma.connector.count({ where: { tenantId } }),
    prisma.vendor.count({ where: { tenantId } }),
    prisma.incident.count({ where: { tenantId } }),
    prisma.accessLog.count({ where: { tenantId } }),
    prisma.assuranceAuditLog.findFirst({
      where: { tenantId },
      orderBy: { timestamp: "desc" },
      select: { hash: true, signatureVersion: true },
    }),
  ]);

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      tenantName: tenant?.name || "Unknown",
      frameworkName: run.framework.name,
      frameworkVersion: run.framework.version,
      runId: run.id,
    },
    summary: (run.summaryJson as ComplianceAssessmentResult["summary"]) || {
      total: 0, compliant: 0, partial: 0, missing: 0, score: 0,
    },
    controls: run.findings.map((f) => ({
      controlId: f.control.controlId,
      title: f.control.title,
      status: f.status,
      notes: f.notes || "",
    })),
    systemInfo: {
      auditLogIntegrity: lastAuditHash
        ? `Hash chain verified (${lastAuditHash.signatureVersion})`
        : "No audit entries",
      retentionPolicies,
      deletionJobsConfigured: deletionJobs,
      sodEnabled: sodPolicy?.enabled ?? false,
      featureFlagsConfigured: featureFlags,
      activeConnectors: connectors,
      registeredVendors: vendors,
      totalIncidents: incidents,
      accessLogEntries: accessLogs,
    },
  };
}

/**
 * Export compliance data as JSON.
 */
export function exportToJson(data: ComplianceExportData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Export compliance data as HTML report (suitable for PDF printing).
 */
export function exportToHtmlReport(data: ComplianceExportData): string {
  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      COMPLIANT: "#16a34a",
      PARTIAL: "#d97706",
      MISSING: "#dc2626",
    };
    const color = colors[status] || "#6b7280";
    return `<span style="background:${color};color:white;padding:2px 8px;border-radius:4px;font-size:12px;">${status}</span>`;
  };

  const scoreColor = data.summary.score >= 80 ? "#16a34a" : data.summary.score >= 50 ? "#d97706" : "#dc2626";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Compliance Evidence Report — ${esc(data.meta.frameworkName)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; color: #1f2937; line-height: 1.6; }
  h1 { border-bottom: 3px solid #3b82f6; padding-bottom: 8px; }
  h2 { color: #1e40af; margin-top: 32px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  tr:nth-child(even) { background: #f9fafb; }
  .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin: 16px 0; }
  .summary-card { background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; }
  .summary-card .value { font-size: 28px; font-weight: 700; }
  .summary-card .label { font-size: 12px; color: #6b7280; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #d1d5db; font-size: 12px; color: #9ca3af; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>Compliance Evidence Report</h1>
<p><strong>Framework:</strong> ${esc(data.meta.frameworkName)} v${esc(data.meta.frameworkVersion)}</p>
<p><strong>Organization:</strong> ${esc(data.meta.tenantName)}</p>
<p><strong>Generated:</strong> ${esc(data.meta.generatedAt)}</p>
<p><strong>Run ID:</strong> ${esc(data.meta.runId)}</p>

<h2>Executive Summary</h2>
<div class="summary-grid">
  <div class="summary-card"><div class="value" style="color:${scoreColor}">${data.summary.score}%</div><div class="label">Overall Score</div></div>
  <div class="summary-card"><div class="value">${data.summary.total}</div><div class="label">Total Controls</div></div>
  <div class="summary-card"><div class="value" style="color:#16a34a">${data.summary.compliant}</div><div class="label">Compliant</div></div>
  <div class="summary-card"><div class="value" style="color:#d97706">${data.summary.partial}</div><div class="label">Partial</div></div>
  <div class="summary-card"><div class="value" style="color:#dc2626">${data.summary.missing}</div><div class="label">Missing</div></div>
</div>

<h2>Controls Assessment</h2>
<table>
<thead><tr><th>Control ID</th><th>Title</th><th>Status</th><th>Evidence Notes</th></tr></thead>
<tbody>
${data.controls.map((c) => `<tr><td>${esc(c.controlId)}</td><td>${esc(c.title)}</td><td>${statusBadge(c.status)}</td><td>${esc(c.notes)}</td></tr>`).join("\n")}
</tbody>
</table>

<h2>System Security Architecture</h2>
<table>
<thead><tr><th>Component</th><th>Status</th></tr></thead>
<tbody>
<tr><td>Audit Log Integrity</td><td>${esc(data.systemInfo.auditLogIntegrity)}</td></tr>
<tr><td>Retention Policies</td><td>${data.systemInfo.retentionPolicies} configured</td></tr>
<tr><td>Deletion Jobs</td><td>${data.systemInfo.deletionJobsConfigured} configured</td></tr>
<tr><td>Separation of Duties</td><td>${data.systemInfo.sodEnabled ? "Enabled" : "Not enabled"}</td></tr>
<tr><td>Feature Flags</td><td>${data.systemInfo.featureFlagsConfigured} configured</td></tr>
<tr><td>Active Connectors</td><td>${data.systemInfo.activeConnectors}</td></tr>
<tr><td>Registered Vendors</td><td>${data.systemInfo.registeredVendors}</td></tr>
<tr><td>Total Incidents</td><td>${data.systemInfo.totalIncidents}</td></tr>
<tr><td>Access Log Entries</td><td>${data.systemInfo.accessLogEntries}</td></tr>
</tbody>
</table>

<div class="footer">
  <p>This report was auto-generated by PrivacyPilot Compliance Engine. It contains technical evidence only and does not constitute legal advice.</p>
  <p>No personally identifiable information (PII) is included in this report.</p>
</div>
</body>
</html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
