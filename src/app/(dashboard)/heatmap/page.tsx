"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useToast, ToastContainer } from "@/components/Toast";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface Counts {
  green: number;
  yellow: number;
  red: number;
  total: number;
}

interface StatusCounts {
  OPEN: number;
  ACCEPTED: number;
  MITIGATING: number;
  MITIGATED: number;
}

interface SystemTile {
  systemId: string;
  systemName: string;
  systemType: string;
  lastScanAt: string | null;
  counts: Counts;
  riskScore: number;
  description: string | null;
  criticality: string;
  containsSpecialCategories: boolean;
  statusCounts: StatusCounts;
  severityCounts: { INFO: number; WARNING: number; CRITICAL: number };
  specialCategoryCount: number;
  categoryBreakdown: Record<string, Counts>;
}

interface Summary {
  totalSystems: number;
  totalFindings: number;
  statusCounts: StatusCounts;
  categoryCounts: Record<string, number>;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function riskBg(score: number): string {
  if (score >= 70) return "bg-red-100 border-red-300";
  if (score >= 40) return "bg-yellow-50 border-yellow-300";
  return "bg-green-50 border-green-300";
}

function riskBadgeBg(score: number): string {
  if (score >= 70) return "bg-red-600";
  if (score >= 40) return "bg-yellow-500";
  return "bg-green-500";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
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
  const [systems, setSystems] = useState<SystemTile[]>([]);
  const [totals, setTotals] = useState<Counts | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { toasts, addToast } = useToast();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchHeatmap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/heatmap/overview");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSystems(data.systems);
      setTotals(data.totals);
      setSummary(data.summary);
      if (data._warnings) setWarnings(data._warnings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHeatmap();
  }, [fetchHeatmap]);

  const seedDemoData = async () => {
    setSeeding(true);
    setMenuOpen(false);
    try {
      const res = await fetch("/api/demo/seed-heatmap", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error(`Seed failed: HTTP ${res.status}`);
      const data = await res.json();
      await fetchHeatmap();
      addToast(
        "success",
        `Demo data seeded: ${data.seededSystems} systems, ${data.seededFindings} findings`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast("error", `Failed to seed demo data: ${msg}`);
    } finally {
      setSeeding(false);
    }
  };

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
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm font-medium text-red-600 hover:text-red-800"
        >
          Retry
        </button>
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
      <ToastContainer toasts={toasts} />

      {/* Warnings Banner */}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          {warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-800">{w}</p>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            DPO Risk Heatmap
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            System-level risk overview based on discovery findings. Click a system
            tile to drill into individual findings.
          </p>
        </div>
        {/* Dev-only: More menu with Demo actions */}
        {process.env.NODE_ENV === "development" && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              More
              <svg
                className="ml-1 -mr-0.5 inline-block h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Demo
                </div>
                <button
                  onClick={seedDemoData}
                  disabled={seeding}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <svg
                    className="h-4 w-4 text-indigo-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375"
                    />
                  </svg>
                  {seeding ? "Seeding\u2026" : "Seed Demo Data"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary Charts */}
      {totals && totals.total > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Risk Distribution Donut */}
          <div className="card flex flex-col items-center gap-4">
            <h3 className="text-sm font-semibold text-gray-700">
              Risk Distribution
            </h3>
            <DonutChart
              segments={[
                { value: totals.green, color: "#22c55e", label: "Green" },
                { value: totals.yellow, color: "#eab308", label: "Yellow" },
                { value: totals.red, color: "#ef4444", label: "Red" },
              ]}
            />
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                {totals.green} Green
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                {totals.yellow} Yellow
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                {totals.red} Red
              </span>
            </div>
          </div>

          {/* Status Donut */}
          {summary && (
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
          )}

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
      {totals && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">
              {systems.length}
            </p>
            <p className="text-xs text-gray-500">Systems Scanned</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">{totals.total}</p>
            <p className="text-xs text-gray-500">Total Findings</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-red-600">{totals.red}</p>
            <p className="text-xs text-gray-500">High Risk</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-600">
              {summary?.statusCounts.MITIGATED ?? 0}
            </p>
            <p className="text-xs text-gray-500">Mitigated</p>
          </div>
        </div>
      )}

      {/* Heatmap Grid: Systems × Data Categories */}
      {systems.length > 0 && (() => {
        // Collect all categories present across all systems
        const allCategories = Array.from(
          new Set(systems.flatMap((s) => Object.keys(s.categoryBreakdown)))
        ).sort();

        return (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Systems &times; Data Categories
            </h2>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-700">
                      System
                    </th>
                    {allCategories.map((cat) => (
                      <th
                        key={cat}
                        className="px-2 py-2 text-center font-medium text-gray-600"
                      >
                        {CATEGORY_LABELS[cat] ?? cat}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center font-semibold text-gray-700">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {systems
                    .sort((a, b) => b.riskScore - a.riskScore)
                    .map((sys) => (
                      <tr key={sys.systemId} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                          <Link href={`/heatmap/system/${sys.systemId}`} className="hover:underline">
                            {sys.systemName}
                          </Link>
                        </td>
                        {allCategories.map((cat) => {
                          const cell = sys.categoryBreakdown[cat];
                          if (!cell || cell.total === 0) {
                            return (
                              <td key={cat} className="px-2 py-2 text-center text-gray-300">
                                &mdash;
                              </td>
                            );
                          }
                          // Color based on proportion of red findings in this cell
                          const redRatio = cell.red / cell.total;
                          const yellowRatio = cell.yellow / cell.total;
                          const bg =
                            redRatio >= 0.5
                              ? "bg-red-100 text-red-800"
                              : redRatio > 0 || yellowRatio >= 0.5
                                ? "bg-yellow-50 text-yellow-800"
                                : "bg-green-50 text-green-800";
                          return (
                            <td key={cat} className={`px-2 py-2 text-center font-medium ${bg}`}>
                              {cell.total}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-bold text-gray-900">
                          {sys.counts.total}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* System Tiles */}
      {systems.length === 0 ? (
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
            Systems ({systems.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {systems
              .sort((a, b) => b.riskScore - a.riskScore)
              .map((tile) => (
                <Link
                  key={tile.systemId}
                  href={`/heatmap/system/${tile.systemId}`}
                  className={`relative rounded-lg border-2 p-4 transition-shadow hover:shadow-md ${riskBg(
                    tile.riskScore
                  )}`}
                >
                  {/* Risk Score Badge */}
                  <div
                    className={`absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${riskBadgeBg(
                      tile.riskScore
                    )}`}
                  >
                    {tile.riskScore}
                  </div>

                  {/* System name + type */}
                  <h3 className="pr-8 text-sm font-semibold text-gray-900">
                    {tile.systemName}
                  </h3>
                  <div className="mt-0.5 flex items-center gap-2">
                    {tile.systemType && tile.systemType !== "NONE" && (
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                        {tile.systemType}
                      </span>
                    )}
                    {tile.description && (
                      <p className="truncate text-xs text-gray-500">
                        {tile.description}
                      </p>
                    )}
                  </div>

                  {/* Risk band mini-bar */}
                  <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-gray-200">
                    {tile.counts.green > 0 && (
                      <div
                        className="bg-green-500"
                        style={{
                          width: `${
                            (tile.counts.green / tile.counts.total) * 100
                          }%`,
                        }}
                        title={`${tile.counts.green} green`}
                      />
                    )}
                    {tile.counts.yellow > 0 && (
                      <div
                        className="bg-yellow-500"
                        style={{
                          width: `${
                            (tile.counts.yellow / tile.counts.total) * 100
                          }%`,
                        }}
                        title={`${tile.counts.yellow} yellow`}
                      />
                    )}
                    {tile.counts.red > 0 && (
                      <div
                        className="bg-red-500"
                        style={{
                          width: `${
                            (tile.counts.red / tile.counts.total) * 100
                          }%`,
                        }}
                        title={`${tile.counts.red} red`}
                      />
                    )}
                  </div>

                  {/* Colored chips for green/yellow/red counts */}
                  <div className="mt-2 flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      {tile.counts.green}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-yellow-500" />
                      {tile.counts.yellow}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      {tile.counts.red}
                    </span>
                    <span className="ml-auto text-gray-500">
                      {tile.counts.total} finding
                      {tile.counts.total !== 1 ? "s" : ""}
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

                  {/* Last scan timestamp (relative) */}
                  <p className="mt-2 text-[10px] text-gray-400">
                    Last scan:{" "}
                    {tile.lastScanAt ? relativeTime(tile.lastScanAt) : "Never"}
                  </p>
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
