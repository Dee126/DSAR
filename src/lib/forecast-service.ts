/**
 * Forecast Service — Predictive analytics for DSAR metrics
 *
 * Uses linear regression on historical snapshots to forecast:
 * - DSAR volume for upcoming months
 * - SLA breach probability
 * - Incident surge impact multiplier
 *
 * Multi-tenant safe: all queries scoped by tenantId.
 */

import { prisma } from "./prisma";

export interface ForecastPoint {
  date: string;
  predicted: number;
  lower: number; // 80% confidence interval
  upper: number;
}

export interface ForecastResult {
  metric: string;
  historicalPoints: { date: string; value: number }[];
  forecast: ForecastPoint[];
  slope: number;
  intercept: number;
  r2: number;
  modelType: string;
}

/**
 * Simple linear regression: y = slope * x + intercept
 */
function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number; r2: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R² calculation
  const meanY = sumY / n;
  const ssTotal = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const ssResidual = ys.reduce((s, y, i) => s + (y - (slope * xs[i] + intercept)) ** 2, 0);
  const r2 = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal;

  return { slope, intercept, r2 };
}

/**
 * Forecast a KPI metric N months into the future using linear regression.
 */
export async function forecastMetric(
  tenantId: string,
  metric: string,
  forecastMonths: number = 3,
  lookbackMonths: number = 12,
): Promise<ForecastResult> {
  const since = new Date();
  since.setMonth(since.getMonth() - lookbackMonths);

  const snapshots = await prisma.privacyKpiSnapshot.findMany({
    where: {
      tenantId,
      period: "MONTHLY",
      snapshotDate: { gte: since },
    },
    orderBy: { snapshotDate: "asc" },
  });

  const historicalPoints = snapshots.map((s) => ({
    date: s.snapshotDate.toISOString(),
    value: ((s as Record<string, unknown>)[metric] as number) ?? 0,
  }));

  // Use month indices as x values (0, 1, 2, ...)
  const xs = historicalPoints.map((_, i) => i);
  const ys = historicalPoints.map((p) => p.value);

  const { slope, intercept, r2 } = linearRegression(xs, ys);

  // Standard error for confidence interval
  const residuals = ys.map((y, i) => y - (slope * xs[i] + intercept));
  const se = Math.sqrt(
    residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, residuals.length - 2),
  );

  // Generate forecast points
  const forecast: ForecastPoint[] = [];
  const lastDate = snapshots.length > 0
    ? new Date(snapshots[snapshots.length - 1].snapshotDate)
    : new Date();

  for (let i = 1; i <= forecastMonths; i++) {
    const futureX = xs.length - 1 + i;
    const predicted = Math.max(0, Math.round((slope * futureX + intercept) * 10) / 10);
    const margin = 1.28 * se * Math.sqrt(1 + 1 / Math.max(1, xs.length)); // 80% CI
    const forecastDate = new Date(lastDate);
    forecastDate.setMonth(forecastDate.getMonth() + i);

    forecast.push({
      date: forecastDate.toISOString(),
      predicted,
      lower: Math.max(0, Math.round((predicted - margin) * 10) / 10),
      upper: Math.round((predicted + margin) * 10) / 10,
    });
  }

  // Store/update model parameters
  await prisma.forecastModel.upsert({
    where: {
      tenantId_modelType: { tenantId, modelType: `linear_${metric}` },
    },
    update: {
      parameters: { slope, intercept, r2, se, lookbackMonths, metric },
      lastTrainedAt: new Date(),
    },
    create: {
      tenantId,
      modelType: `linear_${metric}`,
      parameters: { slope, intercept, r2, se, lookbackMonths, metric },
      lastTrainedAt: new Date(),
    },
  });

  return {
    metric,
    historicalPoints,
    forecast,
    slope: Math.round(slope * 1000) / 1000,
    intercept: Math.round(intercept * 100) / 100,
    r2: Math.round(r2 * 1000) / 1000,
    modelType: "linear_regression",
  };
}

/**
 * Forecast DSAR volume (convenience wrapper).
 */
export async function forecastDsarVolume(
  tenantId: string,
  forecastMonths: number = 3,
): Promise<ForecastResult> {
  return forecastMetric(tenantId, "totalDsars", forecastMonths);
}

/**
 * Calculate SLA breach probability for next month.
 */
export async function slBreachProbability(
  tenantId: string,
): Promise<{
  probability: number;
  basedOnMonths: number;
  trend: "improving" | "worsening" | "stable";
}> {
  const forecast = await forecastMetric(tenantId, "overdueRatePct", 1, 6);
  const predicted = forecast.forecast[0]?.predicted ?? 0;
  const probability = Math.min(100, Math.max(0, predicted));

  const points = forecast.historicalPoints;
  let trend: "improving" | "worsening" | "stable" = "stable";
  if (points.length >= 2) {
    const last = points[points.length - 1].value;
    const prev = points[points.length - 2].value;
    if (last < prev - 2) trend = "improving";
    else if (last > prev + 2) trend = "worsening";
  }

  return {
    probability: Math.round(probability * 10) / 10,
    basedOnMonths: points.length,
    trend,
  };
}

/**
 * Estimate incident surge multiplier on DSAR volume.
 */
export async function incidentSurgeMultiplier(
  tenantId: string,
): Promise<{
  multiplier: number;
  averageIncidentLinkedDsars: number;
  totalIncidents: number;
}> {
  const since = new Date();
  since.setMonth(since.getMonth() - 12);

  const snapshots = await prisma.privacyKpiSnapshot.findMany({
    where: {
      tenantId,
      period: "MONTHLY",
      snapshotDate: { gte: since },
    },
    orderBy: { snapshotDate: "asc" },
  });

  if (snapshots.length < 2) {
    return { multiplier: 1, averageIncidentLinkedDsars: 0, totalIncidents: 0 };
  }

  const dsarCounts = snapshots.map((s) => s.totalDsars);
  const avgDsar = dsarCounts.reduce((a, b) => a + b, 0) / dsarCounts.length;

  // Look for months with high-risk cases as incident surges
  const highRiskMonths = snapshots.filter((s) => s.highRiskCasesCount > 0);
  const incidentDsarAvg = highRiskMonths.length > 0
    ? highRiskMonths.reduce((s, h) => s + h.totalDsars, 0) / highRiskMonths.length
    : avgDsar;

  const multiplier = avgDsar > 0 ? incidentDsarAvg / avgDsar : 1;

  return {
    multiplier: Math.round(multiplier * 100) / 100,
    averageIncidentLinkedDsars: Math.round(incidentDsarAvg),
    totalIncidents: highRiskMonths.length,
  };
}
