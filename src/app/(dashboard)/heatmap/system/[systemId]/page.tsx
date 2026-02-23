"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface SystemInfo {
  id: string;
  name: string;
  type: string;
  description: string | null;
  criticality: string;
  containsSpecialCategories: boolean;
}

interface Counts {
  green: number;
  yellow: number;
  red: number;
  total: number;
}

interface FindingRow {
  id: string;
  title: string;
  piiCategory: string;
  sensitivityScore: number;
  status: string;
  createdAt: string;
  snippetPreview: string | null;
  // Extra fields
  riskScore: number;
  severity: string;
  dataCategory: string;
  confidence: number;
  containsSpecialCategory: boolean;
  dataAssetLocation: string | null;
  statusComment: string | null;
  mitigationDueDate: string | null;
  statusChangedAt: string | null;
  run: {
    id: string;
    case: { id: string; caseNumber: string };
  };
}

interface Pagination {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
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
    case "MITIGATING":
      return "bg-blue-100 text-blue-700";
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
  const [counts, setCounts] = useState<Counts | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [colorFilter, setColorFilter] = useState<ColorFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [minScore, setMinScore] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Sort
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("systemId", systemId);
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (colorFilter !== "all") params.set("color", colorFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("piiCategory", categoryFilter);
      if (minScore) params.set("minScore", minScore);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      params.set("sort", sortField);
      params.set("dir", sortDir);

      const res = await fetch(`/api/heatmap/system?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSystem(data.system);
      setFindings(data.findings);
      setCounts(data.counts);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [systemId, colorFilter, statusFilter, categoryFilter, minScore, dateFrom, dateTo, sortField, sortDir, offset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [colorFilter, statusFilter, categoryFilter, minScore, dateFrom, dateTo, sortField, sortDir]);

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
              {system.type && system.type !== "NONE" && (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                  {system.type}
                </span>
              )}
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

      {/* Counts Summary */}
      {counts && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-600">{counts.green}</p>
            <p className="text-xs text-gray-500">Green (&lt;40)</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-yellow-600">{counts.yellow}</p>
            <p className="text-xs text-gray-500">Yellow (40-69)</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-red-600">{counts.red}</p>
            <p className="text-xs text-gray-500">Red (70+)</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">{counts.total}</p>
            <p className="text-xs text-gray-500">Total</p>
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
          Min Score:
          <input
            type="number"
            min="0"
            max="100"
            className="ml-1.5 w-16 rounded-md border border-gray-300 px-2 py-1 text-xs"
            placeholder="0"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
          />
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
          {pagination ? `${pagination.total} total` : ""} &middot;{" "}
          {findings.length} shown
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

      {/* Empty state */}
      {!loading && findings.length === 0 && (
        <div className="card py-12 text-center">
          <svg
            className="mx-auto h-10 w-10 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-500">
            No findings match the current filters.
          </p>
        </div>
      )}

      {/* Findings Table */}
      {!loading && findings.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-medium text-gray-500">
                <th className="pb-2 pr-3">Score</th>
                <th className="pb-2 pr-3">Title</th>
                <th className="pb-2 pr-3">Category</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Severity</th>
                <th className="pb-2 pr-3">Created</th>
                <th className="pb-2">Case</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {findings.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  {/* Sensitivity Score */}
                  <td className="py-2.5 pr-3">
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${riskBadge(
                        f.sensitivityScore
                      )}`}
                    >
                      {f.sensitivityScore}
                    </span>
                  </td>

                  {/* Title + snippet */}
                  <td className="max-w-xs py-2.5 pr-3">
                    <Link
                      href={`/heatmap/finding/${f.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-brand-600"
                    >
                      {f.title}
                    </Link>
                    {f.snippetPreview && (
                      <p className="mt-0.5 truncate text-xs text-gray-400">
                        {f.snippetPreview}
                      </p>
                    )}
                    {f.containsSpecialCategory && (
                      <span className="mt-0.5 inline-block text-[10px] font-medium text-red-600">
                        Art. 9
                      </span>
                    )}
                  </td>

                  {/* Category */}
                  <td className="py-2.5 pr-3 text-xs text-gray-600">
                    {CATEGORY_LABELS[f.piiCategory] ?? f.piiCategory}
                  </td>

                  {/* Status */}
                  <td className="py-2.5 pr-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${statusBadge(
                        f.status
                      )}`}
                    >
                      {f.status}
                    </span>
                  </td>

                  {/* Severity */}
                  <td className="py-2.5 pr-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${severityBadge(
                        f.severity
                      )}`}
                    >
                      {f.severity}
                    </span>
                  </td>

                  {/* Created */}
                  <td className="py-2.5 pr-3 text-xs text-gray-500">
                    {new Date(f.createdAt).toLocaleDateString()}
                  </td>

                  {/* Case */}
                  <td className="py-2.5 text-xs">
                    <Link
                      href={`/cases/${f.run.case.id}`}
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      {f.run.case.caseNumber}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total > limit && (
        <div className="flex items-center justify-between">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500">
            {offset + 1}&ndash;{Math.min(offset + limit, pagination.total)} of{" "}
            {pagination.total}
          </span>
          <button
            disabled={!pagination.hasMore}
            onClick={() => setOffset(offset + limit)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
