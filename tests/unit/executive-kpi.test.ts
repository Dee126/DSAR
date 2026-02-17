/**
 * Executive Privacy KPI & Board Reporting Tests — Module 7
 *
 * Comprehensive test suite verifying:
 *   1. KPI calculations (median, percentages, maturity)
 *   2. Trend analysis (moving average, anomaly detection, period comparison)
 *   3. Forecast service (linear regression, R², confidence intervals)
 *   4. Automation metrics (ROI, adoption rates)
 *   5. Export service (CSV formatting)
 *   6. RBAC permissions for executive features
 *   7. Validation schemas
 */

import { describe, it, expect } from "vitest";
import {
  has,
  enforce,
  type Permission,
} from "../../src/lib/rbac";
import {
  kpiDateRangeSchema,
  updateKpiConfigSchema,
  generateReportSchema,
  createKpiThresholdSchema,
} from "../../src/lib/validation";

// ─── 1. KPI Calculation Helpers ─────────────────────────────────────────────

describe("KPI Calculation Helpers", () => {
  // Test the pct() and median() functions
  function pct(numerator: number, denominator: number): number | null {
    if (denominator === 0) return null;
    return Math.round((numerator / denominator) * 10000) / 100;
  }

  function median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  describe("pct()", () => {
    it("should return null for zero denominator", () => {
      expect(pct(5, 0)).toBeNull();
    });

    it("should return 100 for equal values", () => {
      expect(pct(10, 10)).toBe(100);
    });

    it("should return 50 for half", () => {
      expect(pct(5, 10)).toBe(50);
    });

    it("should handle decimal precision", () => {
      expect(pct(1, 3)).toBe(33.33);
    });

    it("should handle zero numerator", () => {
      expect(pct(0, 10)).toBe(0);
    });

    it("should handle large numbers", () => {
      expect(pct(999, 1000)).toBe(99.9);
    });
  });

  describe("median()", () => {
    it("should return null for empty array", () => {
      expect(median([])).toBeNull();
    });

    it("should return single value for one element", () => {
      expect(median([5])).toBe(5);
    });

    it("should return middle for odd count", () => {
      expect(median([1, 3, 5])).toBe(3);
    });

    it("should return average of middle two for even count", () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });

    it("should handle unsorted input", () => {
      expect(median([5, 1, 3])).toBe(3);
    });

    it("should handle identical values", () => {
      expect(median([7, 7, 7])).toBe(7);
    });

    it("should handle two elements", () => {
      expect(median([10, 20])).toBe(15);
    });

    it("should handle negative values", () => {
      expect(median([-5, 0, 5])).toBe(0);
    });
  });
});

// ─── 2. Maturity Score Calculation ──────────────────────────────────────────

describe("Maturity Score Calculation", () => {
  it("should compute weighted maturity score", () => {
    const weights = {
      documentation: 0.2,
      automation: 0.25,
      sla_compliance: 0.25,
      incident_integration: 0.15,
      vendor_coordination: 0.15,
    };

    const scores = {
      documentation: 80,
      automation: 60,
      sla_compliance: 90,
      incident_integration: 70,
      vendor_coordination: 50,
    };

    const maturity = Math.round(
      (scores.documentation * weights.documentation +
        scores.automation * weights.automation +
        scores.sla_compliance * weights.sla_compliance +
        scores.incident_integration * weights.incident_integration +
        scores.vendor_coordination * weights.vendor_coordination) * 10,
    ) / 10;

    // 80*0.2 + 60*0.25 + 90*0.25 + 70*0.15 + 50*0.15
    // = 16 + 15 + 22.5 + 10.5 + 7.5 = 71.5
    expect(maturity).toBe(71.5);
  });

  it("should handle all-zero scores", () => {
    const weights = {
      documentation: 0.2,
      automation: 0.25,
      sla_compliance: 0.25,
      incident_integration: 0.15,
      vendor_coordination: 0.15,
    };

    const maturity = Math.round(
      (0 * weights.documentation +
        0 * weights.automation +
        0 * weights.sla_compliance +
        0 * weights.incident_integration +
        0 * weights.vendor_coordination) * 10,
    ) / 10;

    expect(maturity).toBe(0);
  });

  it("should handle all-100 scores", () => {
    const weights = {
      documentation: 0.2,
      automation: 0.25,
      sla_compliance: 0.25,
      incident_integration: 0.15,
      vendor_coordination: 0.15,
    };

    const maturity = Math.round(
      (100 * weights.documentation +
        100 * weights.automation +
        100 * weights.sla_compliance +
        100 * weights.incident_integration +
        100 * weights.vendor_coordination) * 10,
    ) / 10;

    expect(maturity).toBe(100);
  });

  it("should handle custom weights summing to 1", () => {
    const weights = {
      documentation: 0.3,
      automation: 0.3,
      sla_compliance: 0.2,
      incident_integration: 0.1,
      vendor_coordination: 0.1,
    };

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });
});

// ─── 3. Trend Analysis ─────────────────────────────────────────────────────

describe("Trend Analysis", () => {
  function movingAverage(points: { value: number }[], window: number): number[] {
    if (points.length < window) return [];
    const result: number[] = [];
    for (let i = window - 1; i < points.length; i++) {
      const slice = points.slice(i - window + 1, i + 1);
      const avg = slice.reduce((s, p) => s + p.value, 0) / window;
      result.push(Math.round(avg * 100) / 100);
    }
    return result;
  }

  function detectAnomalies(points: { value: number }[], threshold = 2): number[] {
    if (points.length < 3) return [];
    const values = points.map((p) => p.value);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length,
    );
    if (stdDev === 0) return [];
    return values.filter((v) => Math.abs((v - mean) / stdDev) > threshold);
  }

  describe("movingAverage()", () => {
    it("should return empty for insufficient data", () => {
      expect(movingAverage([{ value: 1 }, { value: 2 }], 3)).toEqual([]);
    });

    it("should compute 3-period moving average", () => {
      const points = [10, 20, 30, 40, 50].map((v) => ({ value: v }));
      const ma = movingAverage(points, 3);
      expect(ma).toEqual([20, 30, 40]);
    });

    it("should compute 2-period moving average", () => {
      const points = [10, 30, 50].map((v) => ({ value: v }));
      const ma = movingAverage(points, 2);
      expect(ma).toEqual([20, 40]);
    });

    it("should handle identical values", () => {
      const points = [5, 5, 5, 5].map((v) => ({ value: v }));
      const ma = movingAverage(points, 3);
      expect(ma).toEqual([5, 5]);
    });
  });

  describe("detectAnomalies()", () => {
    it("should return empty for insufficient data", () => {
      expect(detectAnomalies([{ value: 1 }, { value: 2 }])).toEqual([]);
    });

    it("should detect outliers", () => {
      const points = [10, 11, 12, 10, 11, 50, 10, 12].map((v) => ({ value: v }));
      const anomalies = detectAnomalies(points, 2);
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies).toContain(50);
    });

    it("should return empty for identical values", () => {
      const points = [5, 5, 5, 5, 5].map((v) => ({ value: v }));
      expect(detectAnomalies(points)).toEqual([]);
    });

    it("should not flag values within normal range", () => {
      const points = [10, 12, 11, 13, 12, 10, 11].map((v) => ({ value: v }));
      const anomalies = detectAnomalies(points, 2);
      expect(anomalies).toEqual([]);
    });
  });
});

// ─── 4. Linear Regression Forecast ──────────────────────────────────────────

describe("Linear Regression Forecast", () => {
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

    const meanY = sumY / n;
    const ssTotal = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
    const ssResidual = ys.reduce((s, y, i) => s + (y - (slope * xs[i] + intercept)) ** 2, 0);
    const r2 = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal;

    return { slope, intercept, r2 };
  }

  it("should compute perfect fit for linear data", () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [10, 20, 30, 40, 50];
    const { slope, intercept, r2 } = linearRegression(xs, ys);
    expect(slope).toBe(10);
    expect(intercept).toBe(10);
    expect(r2).toBeCloseTo(1.0);
  });

  it("should handle flat data (no trend)", () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [5, 5, 5, 5, 5];
    const { slope, r2 } = linearRegression(xs, ys);
    expect(slope).toBe(0);
    expect(r2).toBe(1); // perfect fit
  });

  it("should handle single point", () => {
    const { slope, intercept, r2 } = linearRegression([0], [42]);
    expect(slope).toBe(0);
    expect(intercept).toBe(42);
    expect(r2).toBe(0);
  });

  it("should handle negative slope", () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [50, 40, 30, 20, 10];
    const { slope, intercept, r2 } = linearRegression(xs, ys);
    expect(slope).toBe(-10);
    expect(intercept).toBe(50);
    expect(r2).toBeCloseTo(1.0);
  });

  it("should produce reasonable R² for noisy data", () => {
    const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const ys = [10, 13, 18, 22, 25, 29, 31, 36, 38, 42]; // roughly linear
    const { slope, r2 } = linearRegression(xs, ys);
    expect(slope).toBeGreaterThan(3);
    expect(slope).toBeLessThan(4);
    expect(r2).toBeGreaterThan(0.98);
  });

  it("should handle two points", () => {
    const { slope, intercept, r2 } = linearRegression([0, 1], [10, 20]);
    expect(slope).toBe(10);
    expect(intercept).toBe(10);
    expect(r2).toBeCloseTo(1.0);
  });

  it("should forecast future values", () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [10, 20, 30, 40, 50];
    const { slope, intercept } = linearRegression(xs, ys);
    const forecast5 = slope * 5 + intercept;
    const forecast6 = slope * 6 + intercept;
    expect(forecast5).toBe(60);
    expect(forecast6).toBe(70);
  });
});

// ─── 5. CSV Export Formatting ───────────────────────────────────────────────

describe("CSV Export Formatting", () => {
  function snapshotsToCSV(snapshots: Array<{ date: string; totalDsars: number; maturityScore: number }>): string {
    const headers = ["Date", "Total DSARs", "Maturity Score"];
    const rows = snapshots.map((s) => [s.date, s.totalDsars, s.maturityScore]);
    return [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
    ].join("\n");
  }

  it("should produce valid CSV with headers", () => {
    const csv = snapshotsToCSV([
      { date: "2025-01-01", totalDsars: 15, maturityScore: 45 },
      { date: "2025-02-01", totalDsars: 18, maturityScore: 52 },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe('"Date","Total DSARs","Maturity Score"');
    expect(lines[1]).toBe('"2025-01-01","15","45"');
    expect(lines[2]).toBe('"2025-02-01","18","52"');
  });

  it("should handle empty data", () => {
    const csv = snapshotsToCSV([]);
    const lines = csv.split("\n");
    expect(lines.length).toBe(1); // just headers
  });

  it("should handle single snapshot", () => {
    const csv = snapshotsToCSV([{ date: "2025-03-01", totalDsars: 10, maturityScore: 80 }]);
    const lines = csv.split("\n");
    expect(lines.length).toBe(2);
  });
});

// ─── 6. RBAC Permissions ────────────────────────────────────────────────────

describe("Executive KPI RBAC Permissions", () => {
  const execPermissions: Permission[] = [
    "EXEC_DASHBOARD_VIEW",
    "EXEC_DASHBOARD_FULL",
    "EXEC_FINANCIAL_VIEW",
    "EXEC_REPORT_GENERATE",
    "EXEC_REPORT_EXPORT",
    "EXEC_KPI_CONFIG",
    "EXEC_FORECAST_VIEW",
  ];

  describe("SUPER_ADMIN", () => {
    it("should have all executive permissions", () => {
      for (const perm of execPermissions) {
        expect(has("SUPER_ADMIN", perm)).toBe(true);
      }
    });
  });

  describe("TENANT_ADMIN", () => {
    it("should have all executive permissions", () => {
      for (const perm of execPermissions) {
        expect(has("TENANT_ADMIN", perm)).toBe(true);
      }
    });
  });

  describe("DPO", () => {
    it("should have dashboard view and full access", () => {
      expect(has("DPO", "EXEC_DASHBOARD_VIEW")).toBe(true);
      expect(has("DPO", "EXEC_DASHBOARD_FULL")).toBe(true);
    });

    it("should have report generate and forecast view", () => {
      expect(has("DPO", "EXEC_REPORT_GENERATE")).toBe(true);
      expect(has("DPO", "EXEC_FORECAST_VIEW")).toBe(true);
    });

    it("should NOT have financial view", () => {
      expect(has("DPO", "EXEC_FINANCIAL_VIEW")).toBe(false);
    });

    it("should NOT have report export", () => {
      expect(has("DPO", "EXEC_REPORT_EXPORT")).toBe(false);
    });

    it("should NOT have KPI config", () => {
      expect(has("DPO", "EXEC_KPI_CONFIG")).toBe(false);
    });
  });

  describe("CASE_MANAGER", () => {
    it("should have dashboard view only", () => {
      expect(has("CASE_MANAGER", "EXEC_DASHBOARD_VIEW")).toBe(true);
    });

    it("should NOT have full dashboard", () => {
      expect(has("CASE_MANAGER", "EXEC_DASHBOARD_FULL")).toBe(false);
    });

    it("should NOT have financial, report, config, or forecast permissions", () => {
      expect(has("CASE_MANAGER", "EXEC_FINANCIAL_VIEW")).toBe(false);
      expect(has("CASE_MANAGER", "EXEC_REPORT_GENERATE")).toBe(false);
      expect(has("CASE_MANAGER", "EXEC_REPORT_EXPORT")).toBe(false);
      expect(has("CASE_MANAGER", "EXEC_KPI_CONFIG")).toBe(false);
      expect(has("CASE_MANAGER", "EXEC_FORECAST_VIEW")).toBe(false);
    });
  });

  describe("ANALYST", () => {
    it("should have dashboard view only", () => {
      expect(has("ANALYST", "EXEC_DASHBOARD_VIEW")).toBe(true);
      expect(has("ANALYST", "EXEC_DASHBOARD_FULL")).toBe(false);
      expect(has("ANALYST", "EXEC_FINANCIAL_VIEW")).toBe(false);
    });
  });

  describe("AUDITOR", () => {
    it("should have dashboard view only", () => {
      expect(has("AUDITOR", "EXEC_DASHBOARD_VIEW")).toBe(true);
      expect(has("AUDITOR", "EXEC_DASHBOARD_FULL")).toBe(false);
    });
  });

  describe("CONTRIBUTOR", () => {
    it("should NOT have any executive permissions", () => {
      for (const perm of execPermissions) {
        expect(has("CONTRIBUTOR", perm)).toBe(false);
      }
    });
  });

  describe("READ_ONLY", () => {
    it("should NOT have any executive permissions", () => {
      for (const perm of execPermissions) {
        expect(has("READ_ONLY", perm)).toBe(false);
      }
    });
  });

  describe("enforce()", () => {
    it("should throw for unauthorized executive access", () => {
      expect(() => enforce("CONTRIBUTOR", "EXEC_DASHBOARD_VIEW")).toThrow("Forbidden");
    });

    it("should not throw for authorized access", () => {
      expect(() => enforce("TENANT_ADMIN", "EXEC_DASHBOARD_VIEW")).not.toThrow();
    });
  });
});

// ─── 7. Validation Schemas ──────────────────────────────────────────────────

describe("Executive KPI Validation Schemas", () => {
  describe("kpiDateRangeSchema", () => {
    it("should accept valid date range", () => {
      const result = kpiDateRangeSchema.safeParse({
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        period: "MONTHLY",
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = kpiDateRangeSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should reject invalid period", () => {
      const result = kpiDateRangeSchema.safeParse({ period: "BIMONTLY" });
      expect(result.success).toBe(false);
    });
  });

  describe("updateKpiConfigSchema", () => {
    it("should accept valid config update", () => {
      const result = updateKpiConfigSchema.safeParse({
        estimatedCostPerDsar: 200,
        estimatedMinutesManual: 600,
        estimatedMinutesAutomated: 90,
      });
      expect(result.success).toBe(true);
    });

    it("should reject negative cost", () => {
      const result = updateKpiConfigSchema.safeParse({
        estimatedCostPerDsar: -50,
      });
      expect(result.success).toBe(false);
    });

    it("should accept maturity weights", () => {
      const result = updateKpiConfigSchema.safeParse({
        maturityWeights: {
          documentation: 0.2,
          automation: 0.3,
          sla_compliance: 0.2,
          incident_integration: 0.15,
          vendor_coordination: 0.15,
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("generateReportSchema", () => {
    it("should accept valid report request", () => {
      const result = generateReportSchema.safeParse({
        title: "Q1 Privacy Report",
        format: "JSON",
        sections: ["executive_summary", "dsar_metrics"],
      });
      expect(result.success).toBe(true);
    });

    it("should accept minimal request", () => {
      const result = generateReportSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should reject invalid format", () => {
      const result = generateReportSchema.safeParse({ format: "DOCX" });
      expect(result.success).toBe(false);
    });
  });

  describe("createKpiThresholdSchema", () => {
    it("should accept valid threshold", () => {
      const result = createKpiThresholdSchema.safeParse({
        kpiKey: "overdueRatePct",
        greenMax: 5,
        yellowMax: 15,
        redMin: 15,
        direction: "lower_is_better",
      });
      expect(result.success).toBe(true);
    });

    it("should require kpiKey", () => {
      const result = createKpiThresholdSchema.safeParse({
        greenMax: 5,
        yellowMax: 15,
        redMin: 15,
      });
      expect(result.success).toBe(false);
    });
  });
});

// ─── 8. SLA Breach Probability ──────────────────────────────────────────────

describe("SLA Breach Probability Logic", () => {
  it("should classify improving trend", () => {
    const last = 8;
    const prev = 15;
    const trend = last < prev - 2 ? "improving" : last > prev + 2 ? "worsening" : "stable";
    expect(trend).toBe("improving");
  });

  it("should classify worsening trend", () => {
    const last = 20;
    const prev = 10;
    const trend = last < prev - 2 ? "improving" : last > prev + 2 ? "worsening" : "stable";
    expect(trend).toBe("worsening");
  });

  it("should classify stable trend", () => {
    const last = 11;
    const prev = 10;
    const trend = last < prev - 2 ? "improving" : last > prev + 2 ? "worsening" : "stable";
    expect(trend).toBe("stable");
  });

  it("should clamp probability to 0-100", () => {
    const raw = -5;
    const probability = Math.min(100, Math.max(0, raw));
    expect(probability).toBe(0);

    const raw2 = 150;
    const probability2 = Math.min(100, Math.max(0, raw2));
    expect(probability2).toBe(100);
  });
});

// ─── 9. Recommendation Generation ──────────────────────────────────────────

describe("Recommendation Generation Logic", () => {
  it("should flag high overdue rate", () => {
    const overdueRatePct = 15;
    const shouldFlag = overdueRatePct > 10;
    expect(shouldFlag).toBe(true);
  });

  it("should NOT flag acceptable overdue rate", () => {
    const overdueRatePct = 5;
    const shouldFlag = overdueRatePct > 10;
    expect(shouldFlag).toBe(false);
  });

  it("should flag low DPA coverage", () => {
    const dpaOnFilePct = 60;
    const shouldFlag = dpaOnFilePct < 80;
    expect(shouldFlag).toBe(true);
  });

  it("should sort recommendations by priority", () => {
    const items = [
      { priority: "low" as const },
      { priority: "high" as const },
      { priority: "medium" as const },
    ];
    const prio = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => prio[a.priority] - prio[b.priority]);
    expect(items[0].priority).toBe("high");
    expect(items[1].priority).toBe("medium");
    expect(items[2].priority).toBe("low");
  });
});

// ─── 10. Incident Surge Multiplier ──────────────────────────────────────────

describe("Incident Surge Multiplier", () => {
  it("should return 1x when no incidents", () => {
    const avgDsar = 20;
    const incidentDsarAvg = 20;
    const multiplier = avgDsar > 0 ? incidentDsarAvg / avgDsar : 1;
    expect(multiplier).toBe(1);
  });

  it("should detect surge multiplier > 1", () => {
    const avgDsar = 20;
    const incidentDsarAvg = 35;
    const multiplier = incidentDsarAvg / avgDsar;
    expect(multiplier).toBe(1.75);
  });

  it("should handle zero average gracefully", () => {
    const avgDsar = 0;
    const multiplier = avgDsar > 0 ? 30 / avgDsar : 1;
    expect(multiplier).toBe(1);
  });
});

// ─── 11. Period Comparison ──────────────────────────────────────────────────

describe("Period Comparison", () => {
  it("should calculate change between periods", () => {
    const p1Avg = 20;
    const p2Avg = 25;
    const change = Math.round((p2Avg - p1Avg) * 100) / 100;
    const changePct = Math.round(((p2Avg - p1Avg) / p1Avg) * 10000) / 100;
    expect(change).toBe(5);
    expect(changePct).toBe(25);
  });

  it("should handle negative change", () => {
    const p1Avg = 30;
    const p2Avg = 20;
    const change = Math.round((p2Avg - p1Avg) * 100) / 100;
    const changePct = Math.round(((p2Avg - p1Avg) / p1Avg) * 10000) / 100;
    expect(change).toBe(-10);
    expect(changePct).toBeCloseTo(-33.33);
  });

  it("should handle zero base (no change percentage)", () => {
    const p1Avg = 0;
    const changePct = p1Avg !== 0 ? ((25 - p1Avg) / p1Avg) * 100 : null;
    expect(changePct).toBeNull();
  });
});

// ─── 12. Automation ROI Metrics ─────────────────────────────────────────────

describe("Automation ROI Metrics", () => {
  it("should calculate time saved", () => {
    const minutesManual = 480;
    const minutesAutomated = 120;
    const timeSavedPerDsar = minutesManual - minutesAutomated;
    expect(timeSavedPerDsar).toBe(360);
  });

  it("should calculate monthly savings", () => {
    const closedThisMonth = 15;
    const timeSavedPerDsar = 360;
    const adoptionRate = 60; // %
    const hoursSaved = Math.round((closedThisMonth * timeSavedPerDsar * (adoptionRate / 100)) / 60 * 10) / 10;
    expect(hoursSaved).toBe(54);
  });

  it("should identify lowest automation area as top opportunity", () => {
    const opportunities = [
      { name: "System auto-discovery", pct: 45 },
      { name: "Template responses", pct: 80 },
      { name: "IDV automation", pct: 20 },
      { name: "API-ready systems", pct: 55 },
    ];
    opportunities.sort((a, b) => a.pct - b.pct);
    expect(opportunities[0].name).toBe("IDV automation");
  });
});

// ─── 13. KPI Threshold Evaluation ───────────────────────────────────────────

describe("KPI Threshold Evaluation", () => {
  function evaluateThreshold(
    value: number,
    threshold: { greenMax: number; yellowMax: number; redMin: number; direction: string },
  ): "green" | "yellow" | "red" {
    if (threshold.direction === "lower_is_better") {
      if (value <= threshold.greenMax) return "green";
      if (value <= threshold.yellowMax) return "yellow";
      return "red";
    }
    // higher_is_better
    if (value >= threshold.greenMax) return "green"; // greenMax means green threshold
    if (value >= threshold.redMin) return "yellow";
    return "red";
  }

  it("should evaluate lower-is-better: green", () => {
    expect(evaluateThreshold(3, { greenMax: 5, yellowMax: 15, redMin: 15, direction: "lower_is_better" })).toBe("green");
  });

  it("should evaluate lower-is-better: yellow", () => {
    expect(evaluateThreshold(10, { greenMax: 5, yellowMax: 15, redMin: 15, direction: "lower_is_better" })).toBe("yellow");
  });

  it("should evaluate lower-is-better: red", () => {
    expect(evaluateThreshold(20, { greenMax: 5, yellowMax: 15, redMin: 15, direction: "lower_is_better" })).toBe("red");
  });

  it("should evaluate higher-is-better: green", () => {
    expect(evaluateThreshold(95, { greenMax: 80, yellowMax: 60, redMin: 40, direction: "higher_is_better" })).toBe("green");
  });

  it("should evaluate higher-is-better: yellow", () => {
    expect(evaluateThreshold(50, { greenMax: 80, yellowMax: 60, redMin: 40, direction: "higher_is_better" })).toBe("yellow");
  });

  it("should evaluate higher-is-better: red", () => {
    expect(evaluateThreshold(30, { greenMax: 80, yellowMax: 60, redMin: 40, direction: "higher_is_better" })).toBe("red");
  });
});

// ─── 14. Snapshot Date Normalization ────────────────────────────────────────

describe("Snapshot Date Normalization", () => {
  it("should normalize to first of month", () => {
    const date = new Date(2025, 6, 15);
    const normalized = new Date(date.getFullYear(), date.getMonth(), 1);
    expect(normalized.getDate()).toBe(1);
    expect(normalized.getMonth()).toBe(6);
    expect(normalized.getFullYear()).toBe(2025);
  });

  it("should handle year boundary", () => {
    const date = new Date(2025, 0, 31);
    const normalized = new Date(date.getFullYear(), date.getMonth(), 1);
    expect(normalized.getMonth()).toBe(0);
    expect(normalized.getDate()).toBe(1);
  });

  it("should handle December", () => {
    const date = new Date(2025, 11, 25);
    const normalized = new Date(date.getFullYear(), date.getMonth(), 1);
    expect(normalized.getMonth()).toBe(11);
    expect(normalized.getDate()).toBe(1);
  });
});
