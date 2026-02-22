"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface RiskBands {
  green: number;
  yellow: number;
  red: number;
}

interface StatusCounts {
  OPEN: number;
  ACCEPTED: number;
  MITIGATING: number;
  MITIGATED: number;
}

interface Tile {
  systemId: string;
  systemName: string;
  description: string | null;
  criticality: string;
  containsSpecialCategories: boolean;
  totalFindings: number;
  riskBands: RiskBands;
  overallRiskScore: number;
  statusCounts: StatusCounts;
  severityCounts: { INFO: number; WARNING: number; CRITICAL: number };
  specialCategoryCount: number;
  lastScanAt: string | null;
}

interface Summary {
  totalSystems: number;
  totalFindings: number;
  riskBands: RiskBands;
  statusCounts: StatusCounts;
  categoryCounts: Record<string, number>;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function riskColor(score: number): string {
  if (score >= 70) return "red";
  if (score >= 40) return "yellow";
  return "green";
}

function riskBg(score: number): string {
  if (score >= 70) return "bg-red-100 border-red-300";
  if (score >= 40) return "bg-yellow-50 border-yellow-300";
  return "bg-green-50 border-green-300";
}

function riskText(score: number): string {
  if (score >= 70) return "text-red-700";
  if (score >= 40) return "text-yellow-700";
  return "text-green-700";
}

function riskBadgeBg(score: number): string {
  if (score >= 70) return "bg-red-600";
  if (score >= 40) return "bg-yellow-500";
  return "bg-green-500";
}

const CATEGORY_LABELS: Record<string, string> = {
  IDENTIFICATION: "Identification",
  CONTACT: "Contact",
  CONTRACT: "Contract",
  PAYMENT: "Payment",
  COMMUNICATION: "Communication",
  HR: "HR",
  CREDITWORTHINESS: "Credit",
  ONLINE_TECHNICAL: "Online/Technical",
  HEALTH: "Health (Art.9)",
  RELIGION: "Religion (Art.9)",
  UNION: "Union (Art.9)",
  POLITICAL_OPINION: "Political (Art.9)",
  OTHER_SPECIAL_CATEGORY: "Special Cat. (Art.9)",
  OTHER: "Other",
};

/* ── Simple Bar Chart (pure CSS) ─────────────────────────────────────── */

function HorizontalBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 truncate text-gray-600">{label}</span>
      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right font-medium text-gray-700">{value}</span>
    </div>
  );
}

/* ── Donut Chart (SVG) ───────────────────────────────────────────────── */

function DonutChart({
  segments,
  size = 120,
  thickness = 20,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-gray-400"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );
  }

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dash = circumference * pct;
          const gap = circumference - dash;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              className="transition-all duration-500"
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-gray-900">{total}</span>
        <span className="text-[10px] text-gray-500">findings</span>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function HeatmapPage() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHeatmap() {
      try {
        const res = await fetch("/api/heatmap/overview");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setTiles(data.tiles);
        setSummary(data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    fetchHeatmap();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-sm text-red-700">Failed to load heatmap: {error}</p>
      </div>
    );
  }

  const topCategories = summary
    ? Object.entries(summary.categoryCounts).slice(0, 8)
    : [];
  const maxCatCount = topCategories.length
    ? Math.max(...topCategories.map(([, v]) => v))
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
          DPO Risk Heatmap
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          System-level risk overview based on discovery findings. Click a system
          tile to drill into individual findings.
        </p>
      </div>

      {/* Summary Charts */}
      {summary && summary.totalFindings > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Risk Distribution Donut */}
          <div className="card flex flex-col items-center gap-4">
            <h3 className="text-sm font-semibold text-gray-700">
              Risk Distribution
            </h3>
            <DonutChart
              segments={[
                {
                  value: summary.riskBands.green,
                  color: "#22c55e",
                  label: "Green",
                },
                {
                  value: summary.riskBands.yellow,
                  color: "#eab308",
                  label: "Yellow",
                },
                {
                  value: summary.riskBands.red,
                  color: "#ef4444",
                  label: "Red",
                },
              ]}
            />
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                {summary.riskBands.green} Green
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                {summary.riskBands.yellow} Yellow
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                {summary.riskBands.red} Red
              </span>
            </div>
          </div>

          {/* Status Donut */}
          <div className="card flex flex-col items-center gap-4">
            <h3 className="text-sm font-semibold text-gray-700">
              Finding Status
            </h3>
            <DonutChart
              segments={[
                {
                  value: summary.statusCounts.OPEN,
                  color: "#6366f1",
                  label: "Open",
                },
                {
                  value: summary.statusCounts.ACCEPTED,
                  color: "#f59e0b",
                  label: "Accepted",
                },
                {
                  value: summary.statusCounts.MITIGATING,
                  color: "#3b82f6",
                  label: "Mitigating",
                },
                {
                  value: summary.statusCounts.MITIGATED,
                  color: "#10b981",
                  label: "Mitigated",
                },
              ]}
            />
            <div className="flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                {summary.statusCounts.OPEN} Open
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                {summary.statusCounts.ACCEPTED} Accepted
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                {summary.statusCounts.MITIGATING} Mitigating
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                {summary.statusCounts.MITIGATED} Mitigated
              </span>
            </div>
          </div>

          {/* Top Data Categories */}
          <div className="card">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              Top Data Categories
            </h3>
            <div className="space-y-2">
              {topCategories.map(([cat, count]) => (
                <HorizontalBar
                  key={cat}
                  label={CATEGORY_LABELS[cat] ?? cat}
                  value={count}
                  max={maxCatCount}
                  color={
                    cat.includes("HEALTH") ||
                    cat.includes("RELIGION") ||
                    cat.includes("UNION") ||
                    cat.includes("POLITICAL") ||
                    cat.includes("SPECIAL")
                      ? "bg-red-500"
                      : "bg-brand-500"
                  }
                />
              ))}
              {topCategories.length === 0 && (
                <p className="text-xs text-gray-400">No findings yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">
              {summary.totalSystems}
            </p>
            <p className="text-xs text-gray-500">Systems Scanned</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">
              {summary.totalFindings}
            </p>
            <p className="text-xs text-gray-500">Total Findings</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-red-600">
              {summary.riskBands.red}
            </p>
            <p className="text-xs text-gray-500">High Risk</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-600">
              {summary.statusCounts.MITIGATED}
            </p>
            <p className="text-xs text-gray-500">Mitigated</p>
          </div>
        </div>
      )}

      {/* System Tiles */}
      {tiles.length === 0 ? (
        <div className="card text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-500">
            No systems with findings yet. Run a Discovery Copilot scan to
            populate heatmap data.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Systems ({tiles.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tiles
              .sort((a, b) => b.overallRiskScore - a.overallRiskScore)
              .map((tile) => (
                <Link
                  key={tile.systemId}
                  href={`/heatmap/system/${tile.systemId}`}
                  className={`relative rounded-lg border-2 p-4 transition-shadow hover:shadow-md ${riskBg(
                    tile.overallRiskScore
                  )}`}
                >
                  {/* Risk Score Badge */}
                  <div
                    className={`absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${riskBadgeBg(
                      tile.overallRiskScore
                    )}`}
                  >
                    {tile.overallRiskScore}
                  </div>

                  {/* System name */}
                  <h3 className="pr-8 text-sm font-semibold text-gray-900">
                    {tile.systemName}
                  </h3>
                  {tile.description && (
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {tile.description}
                    </p>
                  )}

                  {/* Risk band mini-bar */}
                  <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-gray-200">
                    {tile.riskBands.green > 0 && (
                      <div
                        className="bg-green-500"
                        style={{
                          width: `${
                            (tile.riskBands.green / tile.totalFindings) * 100
                          }%`,
                        }}
                        title={`${tile.riskBands.green} green`}
                      />
                    )}
                    {tile.riskBands.yellow > 0 && (
                      <div
                        className="bg-yellow-500"
                        style={{
                          width: `${
                            (tile.riskBands.yellow / tile.totalFindings) * 100
                          }%`,
                        }}
                        title={`${tile.riskBands.yellow} yellow`}
                      />
                    )}
                    {tile.riskBands.red > 0 && (
                      <div
                        className="bg-red-500"
                        style={{
                          width: `${
                            (tile.riskBands.red / tile.totalFindings) * 100
                          }%`,
                        }}
                        title={`${tile.riskBands.red} red`}
                      />
                    )}
                  </div>

                  {/* Counts */}
                  <div className="mt-2 flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      {tile.riskBands.green}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-yellow-500" />
                      {tile.riskBands.yellow}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      {tile.riskBands.red}
                    </span>
                    <span className="ml-auto text-gray-500">
                      {tile.totalFindings} finding
                      {tile.totalFindings !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Special category flag */}
                  {tile.specialCategoryCount > 0 && (
                    <div className="mt-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                      Art. 9: {tile.specialCategoryCount} special category
                    </div>
                  )}

                  {/* Status row */}
                  <div className="mt-2 flex gap-2 text-[10px] text-gray-500">
                    {tile.statusCounts.OPEN > 0 && (
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700">
                        {tile.statusCounts.OPEN} open
                      </span>
                    )}
                    {tile.statusCounts.MITIGATING > 0 && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">
                        {tile.statusCounts.MITIGATING} mitigating
                      </span>
                    )}
                    {tile.statusCounts.ACCEPTED > 0 && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
                        {tile.statusCounts.ACCEPTED} accepted
                      </span>
                    )}
                    {tile.statusCounts.MITIGATED > 0 && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
                        {tile.statusCounts.MITIGATED} mitigated
                      </span>
                    )}
                  </div>

                  {/* Last scan timestamp */}
                  <p className="mt-2 text-[10px] text-gray-400">
                    Last scan:{" "}
                    {tile.lastScanAt
                      ? new Date(tile.lastScanAt).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )
                      : "Never"}
                  </p>
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
