"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface CriticalFinding {
  id: string;
  riskScore: number;
  severity: string;
  status: string;
  dataCategory: string;
  summary: string;
  containsSpecialCategory: boolean;
  statusComment: string | null;
  createdAt: string;
  systemId: string | null;
  system: { id: string; name: string; criticality: string } | null;
  run: {
    id: string;
    case: { id: string; caseNumber: string };
  };
  statusChangedBy: { id: string; name: string } | null;
  mitigationTasks: {
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
    assignee: { id: string; name: string } | null;
  }[];
}

interface SystemGroup {
  systemId: string;
  systemName: string;
  criticality: string | null;
  findings: CriticalFinding[];
}

interface CategoryGroup {
  category: string;
  findings: CriticalFinding[];
}

interface CriticalResponse {
  findings: CriticalFinding[];
  bySystem: SystemGroup[];
  byCategory: CategoryGroup[];
  summary: {
    total: number;
    open: number;
    accepted: number;
    mitigating: number;
    mitigated: number;
    specialCategory: number;
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
  CREDITWORTHINESS: "Creditworthiness",
  ONLINE_TECHNICAL: "Online/Technical",
  HEALTH: "Health (Art.9)",
  RELIGION: "Religion (Art.9)",
  UNION: "Trade Union (Art.9)",
  POLITICAL_OPINION: "Political Opinion (Art.9)",
  OTHER_SPECIAL_CATEGORY: "Special Category (Art.9)",
  OTHER: "Other",
};

function statusBadgeClass(status: string) {
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

type GroupBy = "system" | "category";
type StatusFilter = "all" | "OPEN" | "ACCEPTED" | "MITIGATING" | "MITIGATED";

/* ── Quick Action Component ────────────────────────────────────────────── */

function QuickAction({
  finding,
  onDone,
}: {
  finding: CriticalFinding;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<null | "accept" | "mitigate" | "resolve">(null);
  const [comment, setComment] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      let url: string;
      let body: Record<string, string>;

      if (mode === "accept") {
        url = `/api/findings/${finding.id}/accept`;
        body = { comment };
      } else if (mode === "mitigate") {
        url = `/api/findings/${finding.id}/mitigate`;
        body = { comment, dueDate };
      } else {
        url = `/api/findings/${finding.id}/resolve`;
        body = { comment };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setMode(null);
      setComment("");
      setDueDate("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!mode) {
    return (
      <div className="flex gap-1">
        {finding.status === "OPEN" && (
          <>
            <button
              onClick={() => setMode("accept")}
              className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-100"
            >
              Accept
            </button>
            <button
              onClick={() => setMode("mitigate")}
              className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100"
            >
              Mitigate
            </button>
          </>
        )}
        {finding.status === "MITIGATING" && (
          <button
            onClick={() => setMode("resolve")}
            className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100"
          >
            Resolve
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
      {error && <p className="text-[10px] text-red-600">{error}</p>}
      {mode === "mitigate" && (
        <input
          type="date"
          className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          min={new Date().toISOString().split("T")[0]}
          placeholder="Due date"
        />
      )}
      <textarea
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
        rows={2}
        placeholder="Comment (required)..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex gap-1">
        <button
          onClick={submit}
          disabled={loading || !comment.trim() || (mode === "mitigate" && !dueDate)}
          className="rounded bg-brand-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "..." : "Confirm"}
        </button>
        <button
          onClick={() => { setMode(null); setError(null); }}
          className="rounded border border-gray-300 px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function CriticalQueuePage() {
  const [data, setData] = useState<CriticalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("system");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/findings/critical");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function filterFindings(findings: CriticalFinding[]) {
    if (statusFilter === "all") return findings;
    return findings.filter((f) => f.status === statusFilter);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-sm text-red-700">{error ?? "Failed to load"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Critical Queue</h1>
          <p className="mt-1 text-sm text-gray-500">
            Findings with risk score &ge; 70 requiring attention
          </p>
        </div>
        <Link
          href="/heatmap"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Heatmap
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="card text-center">
          <p className="text-2xl font-bold text-red-600">{data.summary.total}</p>
          <p className="text-xs text-gray-500">Total Critical</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-indigo-600">{data.summary.open}</p>
          <p className="text-xs text-gray-500">Open</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-amber-600">{data.summary.accepted}</p>
          <p className="text-xs text-gray-500">Accepted</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-blue-600">{data.summary.mitigating}</p>
          <p className="text-xs text-gray-500">Mitigating</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-emerald-600">{data.summary.mitigated}</p>
          <p className="text-xs text-gray-500">Mitigated</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-red-500">{data.summary.specialCategory}</p>
          <p className="text-xs text-gray-500">Art. 9</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Group by:</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            <option value="system">System</option>
            <option value="category">PII Category</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            <option value="all">All</option>
            <option value="OPEN">Open</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="MITIGATING">Mitigating</option>
            <option value="MITIGATED">Mitigated</option>
          </select>
        </div>
      </div>

      {/* Grouped Findings */}
      {groupBy === "system" ? (
        <div className="space-y-6">
          {data.bySystem.map((group) => {
            const filtered = filterFindings(group.findings);
            if (filtered.length === 0) return null;

            return (
              <div key={group.systemId || "__unassigned"} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900">
                      {group.systemName}
                    </h3>
                    {group.criticality && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                        {group.criticality}
                      </span>
                    )}
                  </div>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    {filtered.length} findings
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {filtered.map((f) => (
                    <FindingRow key={f.id} finding={f} onRefresh={fetchData} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {data.byCategory.map((group) => {
            const filtered = filterFindings(group.findings);
            if (filtered.length === 0) return null;

            return (
              <div key={group.category} className="card">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">
                    {CATEGORY_LABELS[group.category] ?? group.category}
                  </h3>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    {filtered.length} findings
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {filtered.map((f) => (
                    <FindingRow key={f.id} finding={f} onRefresh={fetchData} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.summary.total === 0 && (
        <div className="card text-center py-12">
          <p className="text-sm text-gray-500">
            No critical findings found. All findings are below the risk threshold of 70.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Finding Row ────────────────────────────────────────────────────────── */

function FindingRow({
  finding,
  onRefresh,
}: {
  finding: CriticalFinding;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-100 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/heatmap/finding/${finding.id}`}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 truncate"
            >
              {finding.summary}
            </Link>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="rounded-full border border-red-300 bg-red-100 px-2 py-0.5 font-bold text-red-700">
              {finding.riskScore}
            </span>
            <span className={`rounded-full px-2 py-0.5 font-medium ${statusBadgeClass(finding.status)}`}>
              {finding.status}
            </span>
            <span className="text-gray-500">
              {finding.system?.name ?? "Unassigned"}
            </span>
            <span className="text-gray-400">
              {CATEGORY_LABELS[finding.dataCategory] ?? finding.dataCategory}
            </span>
            {finding.containsSpecialCategory && (
              <span className="font-semibold text-red-600">Art. 9</span>
            )}
            <span className="text-gray-400">
              {finding.run.case.caseNumber}
            </span>
          </div>
        </div>
        <QuickAction finding={finding} onDone={onRefresh} />
      </div>
    </div>
  );
}
