/**
 * Export Service — Generate CSV/JSON/PDF exports of KPI data
 *
 * Handles data serialization and storage for executive exports.
 * Includes board export run tracking and audit logging.
 *
 * Multi-tenant safe: all queries scoped by tenantId.
 */

import { prisma } from "./prisma";
import { getStorage } from "./storage";
import { getKpiSnapshots } from "./kpi-service";
import { getKpiTrends } from "./trend-service";
import { getAutomationHistory } from "./automation-metric-service";
import type { ReportFormat, ReportStatus } from "@prisma/client";

export interface ExportOptions {
  format: ReportFormat;
  months?: number;
  includeForecasts?: boolean;
  includeTrends?: boolean;
  includeAutomation?: boolean;
}

/**
 * Export KPI snapshots as CSV.
 */
export function snapshotsToCSV(
  snapshots: Awaited<ReturnType<typeof getKpiSnapshots>>,
): string {
  if (snapshots.length === 0) return "No data available";

  const headers = [
    "Date", "Total DSARs", "Open DSARs", "Closed DSARs",
    "Avg Close Days", "Median Close Days", "Extension Rate %", "Overdue Rate %",
    "High Risk Cases", "Vendor Overdue", "Auto-Suggested %",
    "Template Response %", "IDV Automation %", "API Ready %",
    "DPA On File %", "Systems Complete %", "Retention Defined %",
    "Third Country %", "Cost Per DSAR", "Time Saved/DSAR (min)",
    "Total Time Saved (min)", "Maturity Score",
  ];

  const rows = snapshots.map((s) => [
    s.snapshotDate.toISOString().split("T")[0],
    s.totalDsars,
    s.openDsars,
    s.closedDsars,
    s.avgTimeToCloseDays ?? "",
    s.medianTimeToCloseDays ?? "",
    s.extensionRatePct ?? "",
    s.overdueRatePct ?? "",
    s.highRiskCasesCount ?? "",
    s.vendorOverdueCount ?? "",
    s.autoSuggestedSystemsPct ?? "",
    s.templateResponsePct ?? "",
    s.idvAutomationPct ?? "",
    s.apiReadySystemsPct ?? "",
    s.dpaOnFilePct ?? "",
    s.systemsCompleteMetaPct ?? "",
    s.retentionDefinedPct ?? "",
    s.thirdCountryTransferRatio ?? "",
    s.estimatedCostPerDsar ?? "",
    s.estimatedTimeSavedPerDsar ?? "",
    s.totalTimeSavedMonthly ?? "",
    s.maturityScore ?? "",
  ]);

  return [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
  ].join("\n");
}

/**
 * Export KPI data in the requested format and track the export run.
 */
export async function exportKpiData(
  tenantId: string,
  userId: string,
  options: ExportOptions,
): Promise<{ exportRunId: string; storageKey: string; fileSize: number }> {
  const months = options.months ?? 12;
  const now = new Date();
  const dateRangeEnd = now;
  const dateRangeStart = new Date(now.getFullYear(), now.getMonth() - months, 1);

  // Create export run record
  const exportRun = await prisma.boardExportRun.create({
    data: {
      tenantId,
      exportType: "quarterly_kpi",
      format: options.format,
      status: "GENERATING" as ReportStatus,
      dateRangeStart,
      dateRangeEnd,
      createdByUserId: userId,
      metadata: JSON.parse(JSON.stringify(options)),
    },
  });

  try {
    const snapshots = await getKpiSnapshots(tenantId, months);

    let content: string;
    let contentType: string;
    let extension: string;

    if (options.format === "CSV") {
      const parts: string[] = [];
      parts.push("=== KPI Snapshots ===");
      parts.push(snapshotsToCSV(snapshots));

      if (options.includeAutomation) {
        const automationHistory = await getAutomationHistory(tenantId, months);
        parts.push("\n=== Automation Metrics ===");
        parts.push(automationToCSV(automationHistory));
      }

      content = parts.join("\n");
      contentType = "text/csv";
      extension = "csv";
    } else {
      // JSON or PPT_JSON
      const data: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        tenantId,
        months,
        snapshots,
      };

      if (options.includeTrends) {
        data.trends = await getKpiTrends(tenantId, months);
      }

      if (options.includeAutomation) {
        data.automationHistory = await getAutomationHistory(tenantId, months);
      }

      content = JSON.stringify(data, null, 2);
      contentType = "application/json";
      extension = "json";
    }

    const storage = getStorage();
    const { storageKey, size } = await storage.upload(
      Buffer.from(content),
      `kpi-export-${Date.now()}.${extension}`,
      contentType,
    );

    await prisma.boardExportRun.update({
      where: { id: exportRun.id },
      data: {
        status: "COMPLETED" as ReportStatus,
        completedAt: new Date(),
        storageKey,
        fileSize: size,
      },
    });

    return { exportRunId: exportRun.id, storageKey, fileSize: size };
  } catch (error) {
    await prisma.boardExportRun.update({
      where: { id: exportRun.id },
      data: {
        status: "FAILED" as ReportStatus,
        completedAt: new Date(),
        errorMessage: String(error),
      },
    });
    throw error;
  }
}

/**
 * Convert automation history to CSV.
 */
function automationToCSV(
  history: Awaited<ReturnType<typeof getAutomationHistory>>,
): string {
  const headers = [
    "Month", "Auto-Suggested %", "Template Response %",
    "IDV Automation %", "API Ready %", "Vendor Auto-Gen %",
    "Overall Score",
  ];

  const rows = history.map((h) => [
    h.month.split("T")[0],
    h.autoSuggestedPct,
    h.templateResponsePct,
    h.idvAutomationPct,
    h.apiReadyPct,
    h.vendorAutoGeneratedPct,
    h.overallAutomationScore,
  ]);

  return [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
  ].join("\n");
}

/**
 * Download a previous export run.
 */
export async function downloadExport(
  tenantId: string,
  exportRunId: string,
): Promise<{ buffer: Buffer; filename: string; contentType: string } | null> {
  const run = await prisma.boardExportRun.findFirst({
    where: { id: exportRunId, tenantId },
  });

  if (!run || !run.storageKey) return null;

  const storage = getStorage();
  const buffer = await storage.download(run.storageKey);
  const ext = run.format === "CSV" ? "csv" : "json";
  const contentType = run.format === "CSV" ? "text/csv" : "application/json";

  return {
    buffer,
    filename: `kpi-export-${run.id}.${ext}`,
    contentType,
  };
}

/**
 * List export runs for a tenant.
 */
export async function listExportRuns(
  tenantId: string,
  limit: number = 20,
) {
  return prisma.boardExportRun.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
}
