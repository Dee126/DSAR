"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

interface TimelineEvent {
  timestamp: string;
  eventType: string;
  category: string;
  title: string;
  description: string;
  actorName?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

interface EDiscoveryResponse {
  timeline: TimelineEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  categories: string[];
  eventTypes: string[];
}

interface CaseOption {
  id: string;
  caseNumber: string;
  type: string;
  status: string;
}

interface IncidentOption {
  id: string;
  reference: string;
  title: string;
  status: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  case: "bg-blue-100 text-blue-700 border-blue-200",
  transition: "bg-purple-100 text-purple-700 border-purple-200",
  task: "bg-yellow-100 text-yellow-700 border-yellow-200",
  document: "bg-green-100 text-green-700 border-green-200",
  vendor: "bg-orange-100 text-orange-700 border-orange-200",
  response: "bg-indigo-100 text-indigo-700 border-indigo-200",
  delivery: "bg-teal-100 text-teal-700 border-teal-200",
  deadline: "bg-red-100 text-red-700 border-red-200",
  audit: "bg-gray-100 text-gray-700 border-gray-200",
  incident: "bg-red-100 text-red-700 border-red-200",
  incident_timeline: "bg-amber-100 text-amber-700 border-amber-200",
  linkage: "bg-pink-100 text-pink-700 border-pink-200",
  authority: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function EDiscoveryPage() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [mode, setMode] = useState<"case" | "incident">(
    searchParams.get("incidentId") ? "incident" : "case"
  );
  const [caseId, setCaseId] = useState(searchParams.get("caseId") ?? "");
  const [incidentId, setIncidentId] = useState(searchParams.get("incidentId") ?? "");
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [data, setData] = useState<EDiscoveryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [incidents, setIncidents] = useState<IncidentOption[]>([]);
  const [exporting, setExporting] = useState(false);

  // Load cases and incidents for selector
  useEffect(() => {
    fetch("/api/cases")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setCases(Array.isArray(d) ? d : d.cases ?? []))
      .catch(() => {});

    fetch("/api/incidents")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setIncidents(Array.isArray(d) ? d : d.incidents ?? []))
      .catch(() => {});
  }, []);

  const doFetch = useCallback(async () => {
    const entityId = mode === "case" ? caseId : incidentId;
    if (!entityId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (mode === "case") params.set("caseId", caseId);
      else params.set("incidentId", incidentId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (selectedCategories.length > 0) params.set("eventTypes", selectedCategories.join(","));
      params.set("page", String(page));
      params.set("pageSize", "50");

      const res = await fetch(`/api/ediscovery?${params.toString()}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [mode, caseId, incidentId, dateFrom, dateTo, selectedCategories, page]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  async function handleExport(format: "csv" | "json") {
    const entityId = mode === "case" ? caseId : incidentId;
    if (!entityId) return;

    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (mode === "case") params.set("caseId", caseId);
      else params.set("incidentId", incidentId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("exportFormat", format);

      const res = await fetch(`/api/ediscovery?${params.toString()}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ediscovery-timeline.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // ignore
    } finally {
      setExporting(false);
    }
  }

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
    setPage(1);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">eDiscovery</h1>
      <p className="mt-1 text-sm text-gray-500">
        Comprehensive timeline view for regulatory audits and incident investigation
      </p>

      {/* Mode + Entity Selector */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-4">
          <div className="flex rounded-lg border border-gray-200">
            <button
              onClick={() => setMode("case")}
              className={`px-4 py-2 text-sm font-medium ${
                mode === "case" ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-50"
              } rounded-l-lg`}
            >
              DSAR Case
            </button>
            <button
              onClick={() => setMode("incident")}
              className={`px-4 py-2 text-sm font-medium ${
                mode === "incident" ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-50"
              } rounded-r-lg`}
            >
              Incident
            </button>
          </div>

          {mode === "case" ? (
            <select
              value={caseId}
              onChange={(e) => { setCaseId(e.target.value); setPage(1); }}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select a case...</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.caseNumber} - {c.type} ({c.status})
                </option>
              ))}
            </select>
          ) : (
            <select
              value={incidentId}
              onChange={(e) => { setIncidentId(e.target.value); setPage(1); }}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select an incident...</option>
              {incidents.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.reference} - {i.title} ({i.status})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Filters row */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">From:</label>
            <input
              type="date"
              value={dateFrom ? dateFrom.substring(0, 10) : ""}
              onChange={(e) => { setDateFrom(e.target.value ? new Date(e.target.value).toISOString() : ""); setPage(1); }}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">To:</label>
            <input
              type="date"
              value={dateTo ? dateTo.substring(0, 10) : ""}
              onChange={(e) => { setDateTo(e.target.value ? new Date(e.target.value).toISOString() : ""); setPage(1); }}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting || !(caseId || incidentId)}
              className="flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              CSV
            </button>
            <button
              onClick={() => handleExport("json")}
              disabled={exporting || !(caseId || incidentId)}
              className="flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Category filters */}
      {data && data.categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs font-medium text-gray-500 self-center">Filter:</span>
          {data.categories.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                selectedCategories.length === 0 || selectedCategories.includes(cat)
                  ? CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-600 border-gray-200"
                  : "bg-white text-gray-400 border-gray-200"
              }`}
            >
              {cat.replace(/_/g, " ")}
            </button>
          ))}
          {selectedCategories.length > 0 && (
            <button
              onClick={() => setSelectedCategories([])}
              className="text-xs text-brand-600 hover:text-brand-700 self-center"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Timeline */}
      {loading && (
        <div className="mt-8 flex justify-center">
          <svg className="h-6 w-6 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="mt-2 text-sm text-gray-500">
            {data.total} events found
          </div>

          {data.timeline.length === 0 ? (
            <div className="mt-8 py-12 text-center text-sm text-gray-500">
              {!(caseId || incidentId)
                ? "Select a case or incident to view the timeline."
                : "No events found for the selected criteria."}
            </div>
          ) : (
            <div className="relative mt-4">
              {/* Vertical line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

              <div className="space-y-4">
                {data.timeline.map((event, idx) => {
                  const catColor = CATEGORY_COLORS[event.category] ?? "bg-gray-100 text-gray-700 border-gray-200";
                  return (
                    <div key={idx} className="relative flex gap-4 pl-12">
                      {/* Dot */}
                      <div className={`absolute left-[18px] top-2 h-3.5 w-3.5 rounded-full border-2 border-white ${
                        event.category === "transition" ? "bg-purple-500" :
                        event.category === "audit" ? "bg-gray-500" :
                        event.category === "deadline" ? "bg-red-500" :
                        event.category === "delivery" ? "bg-teal-500" :
                        event.category === "vendor" ? "bg-orange-500" :
                        "bg-blue-500"
                      }`} />

                      <div className="flex-1 rounded-lg border border-gray-200 bg-white p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`rounded px-1.5 py-0.5 text-xs font-medium border ${catColor}`}>
                              {event.category.replace(/_/g, " ")}
                            </span>
                            <span className="text-sm font-medium text-gray-900">{event.title}</span>
                          </div>
                          <span className="shrink-0 text-xs text-gray-400">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {event.description && (
                          <p className="mt-1 text-sm text-gray-600">{event.description}</p>
                        )}
                        {event.actorName && (
                          <p className="mt-1 text-xs text-gray-400">By: {event.actorName}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {page} of {data.totalPages}</span>
              <button
                onClick={() => setPage(Math.min(data.totalPages, page + 1))}
                disabled={page >= data.totalPages}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
