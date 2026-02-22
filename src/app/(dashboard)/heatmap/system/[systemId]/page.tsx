"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface SystemInfo {
  id: string;
  name: string;
  description: string | null;
  criticality: string;
  containsSpecialCategories: boolean;
}

interface FindingRow {
  id: string;
  riskScore: number;
  severity: string;
  status: string;
  dataCategory: string;
  summary: string;
  confidence: number;
  containsSpecialCategory: boolean;
  dataAssetLocation: string | null;
  statusComment: string | null;
  mitigationDueDate: string | null;
  createdAt: string;
  statusChangedAt: string | null;
  run: {
    id: string;
    case: { id: string; caseNumber: string };
  };
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

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

function riskBadge(score: number) {
  if (score >= 70)
    return "bg-red-100 text-red-700 border border-red-200";
  if (score >= 40)
    return "bg-yellow-100 text-yellow-700 border border-yellow-200";
  return "bg-green-100 text-green-700 border border-green-200";
}

function severityBadge(severity: string) {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-100 text-red-700";
    case "WARNING":
      return "bg-yellow-100 text-yellow-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "ACCEPTED":
      return "bg-amber-100 text-amber-700";
    case "MITIGATED":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-indigo-100 text-indigo-700";
  }
}

type ColorFilter = "all" | "green" | "yellow" | "red";
type StatusFilter = "all" | "OPEN" | "ACCEPTED" | "MITIGATING" | "MITIGATED";
type SortField = "score" | "lastSeen";
type SortDir = "asc" | "desc";

/* ── Page ────────────────────────────────────────────────────────────── */

export default function SystemDrilldownPage() {
  const { systemId } = useParams<{ systemId: string }>();
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [colorFilter, setColorFilter] = useState<ColorFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Sort
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("systemId", systemId);
      if (colorFilter !== "all") params.set("color", colorFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("piiCategory", categoryFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      params.set("sort", sortField);
      params.set("dir", sortDir);

      const res = await fetch(`/api/heatmap/system?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSystem(data.system);
      setFindings(data.findings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [systemId, colorFilter, statusFilter, categoryFilter, dateFrom, dateTo, sortField, sortDir]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Unique categories from findings for the filter dropdown
  const allCategories = Array.from(
    new Set(findings.map((f) => f.dataCategory))
  ).sort();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/heatmap" className="hover:text-brand-600">
          Heatmap
        </Link>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="font-medium text-gray-900">
          {system?.name ?? "System"}
        </span>
      </nav>

      {/* System Header */}
      {system && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {system.name}
              </h1>
              {system.description && (
                <p className="mt-1 text-sm text-gray-500">
                  {system.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                {system.criticality}
              </span>
              {system.containsSpecialCategories && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                  Art. 9 Data
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-medium text-gray-600">
          Risk:
          <select
            className="ml-1.5 rounded-md border border-gray-300 px-2 py-1 text-xs"
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value as ColorFilter)}
          >
            <option value="all">All</option>
            <option value="red">Red (70-100)</option>
            <option value="yellow">Yellow (40-69)</option>
            <option value="green">Green (0-39)</option>
          </select>
        </label>

        <label className="text-xs font-medium text-gray-600">
          Status:
          <select
            className="ml-1.5 rounded-md border border-gray-300 px-2 py-1 text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All</option>
            <option value="OPEN">Open</option>
            <option value="MITIGATING">Mitigating</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="MITIGATED">Mitigated</option>
          </select>
        </label>

        <label className="text-xs font-medium text-gray-600">
          Category:
          <select
            className="ml-1.5 rounded-md border border-gray-300 px-2 py-1 text-xs"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat] ?? cat}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-gray-600">
          From:
          <input
            type="date"
            className="ml-1.5 rounded-md border border-gray-300 px-2 py-1 text-xs"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>

        <label className="text-xs font-medium text-gray-600">
          To:
          <input
            type="date"
            className="ml-1.5 rounded-md border border-gray-300 px-2 py-1 text-xs"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>

        <label className="text-xs font-medium text-gray-600">
          Sort:
          <select
            className="ml-1.5 rounded-md border border-gray-300 px-2 py-1 text-xs"
            value={`${sortField}-${sortDir}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split("-") as [SortField, SortDir];
              setSortField(field);
              setSortDir(dir);
            }}
          >
            <option value="score-desc">Score (high first)</option>
            <option value="score-asc">Score (low first)</option>
            <option value="lastSeen-desc">Newest first</option>
            <option value="lastSeen-asc">Oldest first</option>
          </select>
        </label>

        <span className="ml-auto text-xs text-gray-500">
          {findings.length} finding{findings.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      )}

      {/* Findings List */}
      {!loading && findings.length === 0 && (
        <div className="card py-12 text-center">
          <p className="text-sm text-gray-500">
            No findings match the current filters.
          </p>
        </div>
      )}

      {!loading && findings.length > 0 && (
        <div className="space-y-2">
          {findings.map((f) => (
            <Link
              key={f.id}
              href={`/heatmap/finding/${f.id}`}
              className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50"
            >
              {/* Risk Score */}
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${riskBadge(
                  f.riskScore
                )}`}
              >
                {f.riskScore}
              </span>

              {/* Summary */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {f.summary}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className={`rounded px-1.5 py-0.5 font-medium ${severityBadge(f.severity)}`}>
                    {f.severity}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 font-medium ${statusBadge(f.status)}`}>
                    {f.status}
                  </span>
                  <span className="text-gray-500">
                    {CATEGORY_LABELS[f.dataCategory] ?? f.dataCategory}
                  </span>
                  {f.containsSpecialCategory && (
                    <span className="font-medium text-red-600">Art. 9</span>
                  )}
                  {f.dataAssetLocation && (
                    <span className="truncate text-gray-400">
                      {f.dataAssetLocation}
                    </span>
                  )}
                </div>
              </div>

              {/* Case */}
              <div className="shrink-0 text-right text-xs text-gray-500">
                <p className="font-medium text-gray-700">
                  {f.run.case.caseNumber}
                </p>
                <p>{new Date(f.createdAt).toLocaleDateString()}</p>
              </div>

              <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
