/**
 * Board Report Service — Generate executive board reports
 *
 * Produces structured JSON reports suitable for PDF rendering,
 * CSV export, and PPT-ready structured data.
 *
 * Multi-tenant safe: all queries scoped by tenantId.
 */

import { prisma } from "./prisma";
import { calculateKPIs } from "./kpi-service";
import { getKpiTrends } from "./trend-service";
import { forecastDsarVolume, slBreachProbability } from "./forecast-service";
import { computeAutomationMetrics, computeAutomationROI } from "./automation-metric-service";
import { getStorage } from "./storage";
import type { ReportFormat, ReportStatus } from "@prisma/client";

export interface BoardReportSection {
  title: string;
  type: "summary" | "kpi_table" | "chart_data" | "risk_matrix" | "recommendations";
  data: Record<string, unknown>;
}

export interface BoardReport {
  title: string;
  generatedAt: string;
  tenantId: string;
  period: { start: string; end: string };
  sections: BoardReportSection[];
}

/**
 * Generate a full board report for the given tenant.
 */
export async function generateBoardReport(
  tenantId: string,
  userId: string,
  options: {
    title?: string;
    format?: ReportFormat;
    sections?: string[];
    startDate?: Date;
    endDate?: Date;
  } = {},
): Promise<{ reportRunId: string; report: BoardReport }> {
  const format = options.format ?? "JSON";
  const title = options.title ?? `Privacy KPI Board Report - ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
  const now = new Date();
  const dateRangeStart = options.startDate ?? new Date(now.getFullYear(), now.getMonth() - 12, 1);
  const dateRangeEnd = options.endDate ?? now;

  // Get or create a default report definition
  let report = await prisma.executiveReport.findFirst({
    where: { tenantId, active: true },
  });
  if (!report) {
    report = await prisma.executiveReport.create({
      data: {
        tenantId,
        name: title,
        sections: options.sections ?? ["all"],
      },
    });
  }

  // Create report run record
  const reportRun = await prisma.executiveReportRun.create({
    data: {
      tenantId,
      reportId: report.id,
      format,
      status: "GENERATING" as ReportStatus,
      dateRangeStart,
      dateRangeEnd,
      createdByUserId: userId,
    },
  });

  try {
    const kpi = await calculateKPIs(tenantId, options.startDate, options.endDate);
    const trends = await getKpiTrends(tenantId, 12);
    const forecast = await forecastDsarVolume(tenantId, 3);
    const breachProb = await slBreachProbability(tenantId);
    const automation = await computeAutomationMetrics(tenantId);
    const roi = await computeAutomationROI(tenantId);

    const includedSections = options.sections ?? [
      "executive_summary",
      "dsar_metrics",
      "risk_compliance",
      "automation_efficiency",
      "governance_maturity",
      "forecasting",
      "recommendations",
    ];

    const sections: BoardReportSection[] = [];

    if (includedSections.includes("all") || includedSections.includes("executive_summary")) {
      sections.push({
        title: "Executive Summary",
        type: "summary",
        data: {
          totalDsars: kpi.totalDsars,
          openDsars: kpi.openDsars,
          closedDsars: kpi.closedDsars,
          avgTimeToCloseDays: kpi.avgTimeToCloseDays,
          overdueRatePct: kpi.overdueRatePct,
          maturityScore: kpi.maturityScore,
          estimatedCostPerDsar: kpi.estimatedCostPerDsar,
          totalTimeSavedMonthly: kpi.totalTimeSavedMonthly,
        },
      });
    }

    if (includedSections.includes("all") || includedSections.includes("dsar_metrics")) {
      sections.push({
        title: "DSAR Performance Metrics",
        type: "kpi_table",
        data: {
          totalDsars: kpi.totalDsars,
          openDsars: kpi.openDsars,
          closedDsars: kpi.closedDsars,
          avgTimeToCloseDays: kpi.avgTimeToCloseDays,
          medianTimeToCloseDays: kpi.medianTimeToCloseDays,
          extensionRatePct: kpi.extensionRatePct,
          overdueRatePct: kpi.overdueRatePct,
          dsarsByType: kpi.dsarsByType,
          dsarsLinkedToIncidentPct: kpi.dsarsLinkedToIncidentPct,
          trendData: trends.series.totalDsars?.points ?? [],
        },
      });
    }

    if (includedSections.includes("all") || includedSections.includes("risk_compliance")) {
      sections.push({
        title: "Risk & Compliance",
        type: "risk_matrix",
        data: {
          riskDistribution: kpi.riskDistribution,
          highRiskCasesCount: kpi.highRiskCasesCount,
          incidentLinkedHighRiskCount: kpi.incidentLinkedHighRiskCount,
          vendorOverdueCount: kpi.vendorOverdueCount,
          overdueRatePct: kpi.overdueRatePct,
          slBreachProbability: breachProb,
        },
      });
    }

    if (includedSections.includes("all") || includedSections.includes("automation_efficiency")) {
      sections.push({
        title: "Automation & Efficiency",
        type: "kpi_table",
        data: {
          automationMetrics: automation,
          roi,
          autoSuggestedSystemsPct: kpi.autoSuggestedSystemsPct,
          templateResponsePct: kpi.templateResponsePct,
          idvAutomationPct: kpi.idvAutomationPct,
          apiReadySystemsPct: kpi.apiReadySystemsPct,
          estimatedTimeSavedPerDsar: kpi.estimatedTimeSavedPerDsar,
          totalTimeSavedMonthly: kpi.totalTimeSavedMonthly,
        },
      });
    }

    if (includedSections.includes("all") || includedSections.includes("governance_maturity")) {
      sections.push({
        title: "Governance & Maturity",
        type: "kpi_table",
        data: {
          maturityScore: kpi.maturityScore,
          dpaOnFilePct: kpi.dpaOnFilePct,
          systemsCompleteMetaPct: kpi.systemsCompleteMetaPct,
          retentionDefinedPct: kpi.retentionDefinedPct,
          thirdCountryTransferRatio: kpi.thirdCountryTransferRatio,
        },
      });
    }

    if (includedSections.includes("all") || includedSections.includes("forecasting")) {
      sections.push({
        title: "Forecasting & Predictions",
        type: "chart_data",
        data: {
          dsarForecast: forecast,
          slBreachProbability: breachProb,
        },
      });
    }

    if (includedSections.includes("all") || includedSections.includes("recommendations")) {
      const recommendations = generateRecommendations(kpi, automation, breachProb);
      sections.push({
        title: "Recommendations",
        type: "recommendations",
        data: { items: recommendations },
      });
    }

    const boardReport: BoardReport = {
      title,
      generatedAt: new Date().toISOString(),
      tenantId,
      period: {
        start: dateRangeStart.toISOString(),
        end: dateRangeEnd.toISOString(),
      },
      sections,
    };

    // Store the report
    const content = formatReport(boardReport, format);
    const storage = getStorage();
    const extension = format === "CSV" ? "csv" : "json";
    const { storageKey, size } = await storage.upload(
      Buffer.from(content),
      `board-report-${Date.now()}.${extension}`,
      format === "CSV" ? "text/csv" : "application/json",
    );

    await prisma.executiveReportRun.update({
      where: { id: reportRun.id },
      data: {
        status: "COMPLETED" as ReportStatus,
        completedAt: new Date(),
        storageKey,
        fileSize: size,
      },
    });

    return { reportRunId: reportRun.id, report: boardReport };
  } catch (error) {
    await prisma.executiveReportRun.update({
      where: { id: reportRun.id },
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
 * Format report content based on format type.
 */
function formatReport(report: BoardReport, format: ReportFormat): string {
  if (format === "CSV") {
    return reportToCSV(report);
  }
  return JSON.stringify(report, null, 2);
}

/**
 * Convert report to CSV format.
 */
function reportToCSV(report: BoardReport): string {
  const lines: string[] = [];
  lines.push(`"${report.title}"`);
  lines.push(`"Generated","${report.generatedAt}"`);
  lines.push("");

  for (const section of report.sections) {
    lines.push(`"${section.title}"`);
    lines.push('"Metric","Value"');
    for (const [key, value] of Object.entries(section.data)) {
      if (typeof value === "object" && value !== null) {
        lines.push(`"${key}","${JSON.stringify(value).replace(/"/g, '""')}"`);
      } else {
        lines.push(`"${key}","${value ?? "N/A"}"`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate actionable recommendations based on KPI data.
 */
function generateRecommendations(
  kpi: Awaited<ReturnType<typeof calculateKPIs>>,
  automation: Awaited<ReturnType<typeof computeAutomationMetrics>>,
  breachProb: Awaited<ReturnType<typeof slBreachProbability>>,
): Array<{ priority: "high" | "medium" | "low"; category: string; recommendation: string }> {
  const items: Array<{ priority: "high" | "medium" | "low"; category: string; recommendation: string }> = [];

  if ((kpi.overdueRatePct ?? 0) > 10) {
    items.push({
      priority: "high",
      category: "SLA Compliance",
      recommendation: `Overdue rate is ${kpi.overdueRatePct}%. Consider adding resources or extending automation to reduce processing time.`,
    });
  }

  if (kpi.highRiskCasesCount > 5) {
    items.push({
      priority: "high",
      category: "Risk Management",
      recommendation: `${kpi.highRiskCasesCount} high-risk cases detected. Prioritize review and escalation procedures.`,
    });
  }

  if (kpi.vendorOverdueCount > 0) {
    items.push({
      priority: "high",
      category: "Vendor Coordination",
      recommendation: `${kpi.vendorOverdueCount} vendor requests are overdue. Escalate to vendor contacts immediately.`,
    });
  }

  if (automation.overallAutomationScore < 50) {
    items.push({
      priority: "medium",
      category: "Automation",
      recommendation: `Automation adoption is at ${automation.overallAutomationScore}%. Consider enabling auto-discovery and template responses to reduce manual effort.`,
    });
  }

  if ((kpi.dpaOnFilePct ?? 0) < 80) {
    items.push({
      priority: "medium",
      category: "Governance",
      recommendation: `Only ${kpi.dpaOnFilePct}% of vendors have DPA on file. Schedule DPA reviews with non-compliant vendors.`,
    });
  }

  if (breachProb.probability > 20) {
    items.push({
      priority: "high",
      category: "Forecasting",
      recommendation: `SLA breach probability for next month is ${breachProb.probability}% (${breachProb.trend}). Proactive measures recommended.`,
    });
  }

  if ((kpi.maturityScore ?? 0) < 60) {
    items.push({
      priority: "medium",
      category: "Maturity",
      recommendation: `Overall maturity score is ${kpi.maturityScore}/100. Focus on documentation and automation to improve.`,
    });
  }

  if ((kpi.retentionDefinedPct ?? 0) < 70) {
    items.push({
      priority: "low",
      category: "Governance",
      recommendation: `Only ${kpi.retentionDefinedPct}% of data categories have retention periods defined. Complete retention policy documentation.`,
    });
  }

  return items.sort((a, b) => {
    const prio = { high: 0, medium: 1, low: 2 };
    return prio[a.priority] - prio[b.priority];
  });
}

/**
 * List previous report runs for a tenant.
 */
export async function listReportRuns(
  tenantId: string,
  limit: number = 20,
) {
  return prisma.executiveReportRun.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
}

/**
 * Download a report run's stored file.
 */
export async function downloadReportRun(
  tenantId: string,
  runId: string,
): Promise<{ buffer: Buffer; filename: string; contentType: string } | null> {
  const run = await prisma.executiveReportRun.findFirst({
    where: { id: runId, tenantId },
    include: { report: true },
  });

  if (!run || !run.storageKey) return null;

  const storage = getStorage();
  const buffer = await storage.download(run.storageKey);
  const ext = run.format === "CSV" ? "csv" : "json";
  const contentType = run.format === "CSV" ? "text/csv" : "application/json";
  const safeName = (run.report?.name ?? "report").replace(/[^a-zA-Z0-9-_ ]/g, "");

  return {
    buffer,
    filename: `${safeName}.${ext}`,
    contentType,
  };
}
