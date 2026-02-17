/**
 * Trend Service — Historical trend analysis and anomaly detection
 *
 * Provides month-over-month grouping, moving averages, and Z-score
 * based anomaly flagging for all KPI metrics.
 *
 * Multi-tenant safe: all queries scoped by tenantId.
 */

import { prisma } from "./prisma";
import type { KpiSnapshotPeriod } from "@prisma/client";

export interface TrendPoint {
  date: string; // ISO date
  value: number;
}

export interface TrendSeries {
  metric: string;
  points: TrendPoint[];
  movingAverage: TrendPoint[];
  anomalies: TrendPoint[];
  changeFromPrevious: number | null;
  changeFromPreviousPct: number | null;
}

export interface TrendSummary {
  series: Record<string, TrendSeries>;
  periodStart: string;
  periodEnd: string;
}

/**
 * Compute a simple moving average over the given window size.
 */
function movingAverage(points: TrendPoint[], window: number): TrendPoint[] {
  if (points.length < window) return [];
  const result: TrendPoint[] = [];
  for (let i = window - 1; i < points.length; i++) {
    const slice = points.slice(i - window + 1, i + 1);
    const avg = slice.reduce((s, p) => s + p.value, 0) / window;
    result.push({ date: points[i].date, value: Math.round(avg * 100) / 100 });
  }
  return result;
}

/**
 * Detect anomalies using Z-score (> 2 standard deviations from mean).
 */
function detectAnomalies(points: TrendPoint[], threshold = 2): TrendPoint[] {
  if (points.length < 3) return [];
  const values = points.map((p) => p.value);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length,
  );
  if (stdDev === 0) return [];
  return points.filter((p) => Math.abs((p.value - mean) / stdDev) > threshold);
}

function buildSeries(metric: string, points: TrendPoint[]): TrendSeries {
  const ma = movingAverage(points, 3);
  const anomalies = detectAnomalies(points);
  const len = points.length;
  const changeFromPrevious =
    len >= 2 ? points[len - 1].value - points[len - 2].value : null;
  const changeFromPreviousPct =
    len >= 2 && points[len - 2].value !== 0
      ? Math.round(
          ((points[len - 1].value - points[len - 2].value) /
            points[len - 2].value) *
            10000,
        ) / 100
      : null;
  return { metric, points, movingAverage: ma, anomalies, changeFromPrevious, changeFromPreviousPct };
}

/**
 * Get trend data for all major KPI metrics over the given period.
 */
export async function getKpiTrends(
  tenantId: string,
  months: number = 12,
  period: KpiSnapshotPeriod = "MONTHLY",
): Promise<TrendSummary> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const snapshots = await prisma.privacyKpiSnapshot.findMany({
    where: {
      tenantId,
      period,
      snapshotDate: { gte: since },
    },
    orderBy: { snapshotDate: "asc" },
  });

  const metrics = [
    "totalDsars",
    "openDsars",
    "closedDsars",
    "avgTimeToCloseDays",
    "overdueRatePct",
    "extensionRatePct",
    "highRiskCasesCount",
    "vendorOverdueCount",
    "autoSuggestedSystemsPct",
    "templateResponsePct",
    "apiReadySystemsPct",
    "dpaOnFilePct",
    "systemsCompleteMetaPct",
    "retentionDefinedPct",
    "maturityScore",
    "estimatedCostPerDsar",
    "totalTimeSavedMonthly",
  ] as const;

  const series: Record<string, TrendSeries> = {};

  for (const metric of metrics) {
    const points: TrendPoint[] = snapshots
      .map((s) => ({
        date: s.snapshotDate.toISOString(),
        value: (s[metric] as number) ?? 0,
      }));
    series[metric] = buildSeries(metric, points);
  }

  return {
    series,
    periodStart: since.toISOString(),
    periodEnd: new Date().toISOString(),
  };
}

/**
 * Get maturity score trends by domain over time.
 */
export async function getMaturityTrends(
  tenantId: string,
  months: number = 12,
): Promise<Record<string, TrendSeries>> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const scores = await prisma.maturityScore.findMany({
    where: {
      tenantId,
      month: { gte: since },
    },
    orderBy: { month: "asc" },
  });

  const byDomain: Record<string, TrendPoint[]> = {};
  for (const s of scores) {
    const key = s.domain;
    if (!byDomain[key]) byDomain[key] = [];
    byDomain[key].push({
      date: s.month.toISOString(),
      value: s.score,
    });
  }

  const result: Record<string, TrendSeries> = {};
  for (const [domain, points] of Object.entries(byDomain)) {
    result[domain] = buildSeries(domain, points);
  }

  return result;
}

/**
 * Compare two time periods for a given metric.
 */
export async function comparePeriods(
  tenantId: string,
  metric: string,
  period1Start: Date,
  period1End: Date,
  period2Start: Date,
  period2End: Date,
): Promise<{
  period1Avg: number | null;
  period2Avg: number | null;
  change: number | null;
  changePct: number | null;
}> {
  const [snap1, snap2] = await Promise.all([
    prisma.privacyKpiSnapshot.findMany({
      where: {
        tenantId,
        snapshotDate: { gte: period1Start, lte: period1End },
      },
    }),
    prisma.privacyKpiSnapshot.findMany({
      where: {
        tenantId,
        snapshotDate: { gte: period2Start, lte: period2End },
      },
    }),
  ]);

  function avg(snaps: typeof snap1): number | null {
    if (snaps.length === 0) return null;
    const vals = snaps.map((s) => (s as Record<string, unknown>)[metric]).filter((v): v is number => typeof v === "number");
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  }

  const p1 = avg(snap1);
  const p2 = avg(snap2);
  const change = p1 !== null && p2 !== null ? Math.round((p2 - p1) * 100) / 100 : null;
  const changePct =
    p1 !== null && p2 !== null && p1 !== 0
      ? Math.round(((p2 - p1) / p1) * 10000) / 100
      : null;

  return { period1Avg: p1, period2Avg: p2, change, changePct };
}
