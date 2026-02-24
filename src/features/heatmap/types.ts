/* ── Heatmap Overview Types ─────────────────────────────────────────────── */

export interface HeatmapCounts {
  green: number;
  yellow: number;
  red: number;
  total: number;
}

export interface HeatmapStatusCounts {
  OPEN: number;
  ACCEPTED: number;
  MITIGATING: number;
  MITIGATED: number;
}

export interface HeatmapSeverityCounts {
  INFO: number;
  WARNING: number;
  CRITICAL: number;
}

export interface HeatmapAiSummary {
  analyzedFindings: number;
  pendingHumanDecisions: number;
  highRiskRecommendations: number;
}

export interface HeatmapSystemRow {
  systemId: string;
  systemName: string;
  systemType: string;
  lastScanAt: string | null;
  counts: HeatmapCounts;
  riskScore: number;
  description: string | null;
  criticality: string;
  containsSpecialCategories: boolean;
  statusCounts: HeatmapStatusCounts;
  severityCounts: HeatmapSeverityCounts;
  specialCategoryCount: number;
  categoryBreakdown: Record<string, HeatmapCounts>;
  ai: HeatmapAiSummary;
}

export interface HeatmapSummary {
  totalSystems: number;
  totalFindings: number;
  statusCounts: HeatmapStatusCounts;
  categoryCounts: Record<string, number>;
}

export interface HeatmapOverviewResponse {
  systems: HeatmapSystemRow[];
  systemsCount: number;
  totals: HeatmapCounts;
  summary: HeatmapSummary;
  debug?: Record<string, unknown>;
  _warnings?: string[];
}

/* ── Filter / Sort ─────────────────────────────────────────────────────── */

export type HeatmapSortKey = "risk-desc" | "risk-asc" | "name-asc" | "name-desc" | "findings-desc";

export interface HeatmapFilters {
  search: string;
  criticality: string; // "ALL" | actual value
  systemType: string;  // "ALL" | actual value
  onlySpecialCategories: boolean;
  onlyHighRisk: boolean;
}
