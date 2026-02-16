"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface SearchResult {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  snippet: string;
  metadata: Record<string, unknown>;
  tags: string[];
  updatedAt: string;
  deepLink: string;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: {
    entityType: Record<string, number>;
  };
}

interface SavedSearchItem {
  id: string;
  name: string;
  queryText: string;
  filtersJson: Record<string, unknown> | null;
  visibility: string;
  pinned: boolean;
  creator: { id: string; name: string };
}

const ENTITY_BADGES: Record<string, { label: string; color: string }> = {
  CASE: { label: "Case", color: "bg-blue-100 text-blue-700" },
  INCIDENT: { label: "Incident", color: "bg-red-100 text-red-700" },
  VENDOR_REQUEST: { label: "Vendor Req", color: "bg-purple-100 text-purple-700" },
  DOCUMENT: { label: "Document", color: "bg-green-100 text-green-700" },
  SYSTEM: { label: "System", color: "bg-orange-100 text-orange-700" },
  INTAKE: { label: "Intake", color: "bg-teal-100 text-teal-700" },
  RESPONSE: { label: "Response", color: "bg-indigo-100 text-indigo-700" },
  AUDIT: { label: "Audit", color: "bg-gray-100 text-gray-700" },
};

const SCOPES = ["ALL", "CASES", "INCIDENTS", "VENDORS", "DOCUMENTS", "SYSTEMS", "INTAKE", "RESPONSES", "AUDIT"];
const SORTS = [
  { value: "relevance", label: "Relevance" },
  { value: "updated_at", label: "Last Updated" },
  { value: "due_date", label: "Due Date" },
];
const STATUS_OPTIONS = ["NEW", "IDENTITY_VERIFICATION", "INTAKE_TRIAGE", "DATA_COLLECTION", "REVIEW_LEGAL", "RESPONSE_PREPARATION", "RESPONSE_SENT", "CLOSED", "REJECTED"];
const RISK_OPTIONS = ["green", "yellow", "red"];

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [scope, setScope] = useState(searchParams.get("scope") ?? "ALL");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "relevance");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [risk, setRisk] = useState(searchParams.get("risk") ?? "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") ?? "");

  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(searchParams.get("tab") ?? "search");
  const [savedSearches, setSavedSearches] = useState<SavedSearchItem[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saveVisibility, setSaveVisibility] = useState("PRIVATE");
  const [showSaveForm, setShowSaveForm] = useState(false);

  const doSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (scope !== "ALL") params.set("scope", scope);
      if (sort !== "relevance") params.set("sort", sort);
      if (status) params.set("status", status);
      if (risk) params.set("risk", risk);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(page));
      params.set("pageSize", "20");

      const res = await fetch(`/api/search?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [query, scope, sort, page, status, risk, dateFrom, dateTo]);

  // Fetch on mount / parameter change
  useEffect(() => {
    doSearch();
  }, [doSearch]);

  // Fetch saved searches
  useEffect(() => {
    if (tab === "saved") {
      fetch("/api/saved-searches")
        .then((r) => r.ok ? r.json() : [])
        .then((d) => setSavedSearches(d))
        .catch(() => {});
    }
  }, [tab]);

  async function handleSaveSearch() {
    if (!saveName.trim()) return;
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName,
          queryText: query,
          filtersJson: { scope, status, risk, dateFrom, dateTo },
          sortJson: { sort },
          visibility: saveVisibility,
        }),
      });
      if (res.ok) {
        setShowSaveForm(false);
        setSaveName("");
        // Refresh saved
        const r2 = await fetch("/api/saved-searches");
        if (r2.ok) setSavedSearches(await r2.json());
      }
    } catch {}
  }

  async function handleDeleteSaved(id: string) {
    await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
  }

  function applySavedSearch(s: SavedSearchItem) {
    setQuery(s.queryText);
    const f = (s.filtersJson ?? {}) as Record<string, string>;
    if (f.scope) setScope(f.scope);
    if (f.status) setStatus(f.status);
    if (f.risk) setRisk(f.risk);
    setTab("search");
    setPage(1);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Enterprise Search</h1>
      <p className="mt-1 text-sm text-gray-500">Search across all DSAR entities, documents, and audit events</p>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 border-b border-gray-200">
        {[
          { key: "search", label: "Search" },
          { key: "saved", label: "Saved Searches" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "search" && (
        <div className="mt-4 flex gap-6">
          {/* Left: Filters */}
          <div className="w-56 shrink-0 space-y-4">
            {/* Scope Tabs */}
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Scope</label>
              <div className="mt-1 flex flex-wrap gap-1">
                {SCOPES.map((s) => {
                  const count = data?.facets?.entityType?.[s === "ALL" ? "" : s.replace("VENDORS", "VENDOR_REQUEST").replace("RESPONSES", "RESPONSE")] ?? "";
                  return (
                    <button
                      key={s}
                      onClick={() => { setScope(s); setPage(1); }}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        scope === s
                          ? "bg-brand-100 text-brand-700"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                      {count ? ` (${count})` : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Status</label>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>

            {/* Risk Filter */}
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Risk</label>
              <div className="mt-1 flex gap-2">
                {RISK_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => { setRisk(risk === r ? "" : r); setPage(1); }}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      risk === r
                        ? r === "green" ? "bg-green-200 text-green-800" : r === "yellow" ? "bg-yellow-200 text-yellow-800" : "bg-red-200 text-red-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Date Range</label>
              <div className="mt-1 space-y-1">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value ? new Date(e.target.value).toISOString() : ""); setPage(1); }}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  placeholder="From"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value ? new Date(e.target.value).toISOString() : ""); setPage(1); }}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  placeholder="To"
                />
              </div>
            </div>

            {/* Clear Filters */}
            <button
              onClick={() => { setStatus(""); setRisk(""); setDateFrom(""); setDateTo(""); setScope("ALL"); setPage(1); }}
              className="text-xs text-brand-600 hover:text-brand-700"
            >
              Clear all filters
            </button>
          </div>

          {/* Right: Results */}
          <div className="flex-1 min-w-0">
            {/* Search bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); doSearch(); } }}
                  placeholder="Search..."
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value); setPage(1); }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button
                onClick={() => { setPage(1); doSearch(); }}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Search
              </button>
              <button
                onClick={() => setShowSaveForm(!showSaveForm)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                title="Save this search"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                </svg>
              </button>
            </div>

            {/* Save search form */}
            {showSaveForm && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Search name..."
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <select
                  value={saveVisibility}
                  onChange={(e) => setSaveVisibility(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="PRIVATE">Private</option>
                  <option value="TEAM">Team</option>
                  <option value="TENANT">Tenant</option>
                </select>
                <button
                  onClick={handleSaveSearch}
                  className="rounded bg-brand-600 px-3 py-1 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Save
                </button>
              </div>
            )}

            {/* Results meta */}
            {data && (
              <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
                <span>{data.total} results found</span>
                <span>Page {data.page} of {data.totalPages}</span>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="mt-8 flex justify-center">
                <svg className="h-6 w-6 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}

            {/* Result list */}
            {!loading && data && (
              <div className="mt-3 space-y-2">
                {data.results.length === 0 && (
                  <div className="py-12 text-center text-sm text-gray-500">
                    No results found. Try adjusting your search or filters.
                  </div>
                )}
                {data.results.map((r) => {
                  const badge = ENTITY_BADGES[r.entityType] ?? { label: r.entityType, color: "bg-gray-100 text-gray-600" };
                  return (
                    <div
                      key={r.id}
                      className="group rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${badge.color}`}>
                              {badge.label}
                            </span>
                            <Link
                              href={r.deepLink}
                              className="truncate text-sm font-semibold text-gray-900 hover:text-brand-600"
                            >
                              {r.title}
                            </Link>
                          </div>
                          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{r.snippet}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                            {r.metadata?.status && (
                              <span className="rounded bg-gray-100 px-1.5 py-0.5">{String(r.metadata.status)}</span>
                            )}
                            {r.metadata?.priority && (
                              <span className="rounded bg-gray-100 px-1.5 py-0.5">{String(r.metadata.priority)}</span>
                            )}
                            {r.metadata?.dueDate && (
                              <span>Due: {new Date(String(r.metadata.dueDate)).toLocaleDateString()}</span>
                            )}
                            {r.tags.length > 0 && r.tags.map((t) => (
                              <span key={t} className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-600">{t}</span>
                            ))}
                            <span>Updated: {new Date(r.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Quick actions */}
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Link
                            href={r.deepLink}
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="Open"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </Link>
                          {r.entityType === "CASE" && (
                            <Link
                              href={`${r.deepLink}?action=assign`}
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              title="Assign"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                              </svg>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {page} of {data.totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(data.totalPages, page + 1))}
                  disabled={page >= data.totalPages}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saved Searches Tab */}
      {tab === "saved" && (
        <div className="mt-4">
          {savedSearches.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No saved searches yet. Use the search tab to create one.
            </div>
          ) : (
            <div className="space-y-2">
              {savedSearches.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      {s.pinned && (
                        <svg className="h-4 w-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                        </svg>
                      )}
                      <span className="font-medium text-gray-900">{s.name}</span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{s.visibility}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {s.queryText ? `Query: "${s.queryText}"` : "No query text"}
                      {" "}&middot;{" "}Created by {s.creator.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => applySavedSearch(s)}
                      className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                    >
                      Run
                    </button>
                    <button
                      onClick={() => handleDeleteSaved(s.id)}
                      className="rounded border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
