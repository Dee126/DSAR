"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchJsonWithRetry } from "@/lib/fetch-client";

/* ── Types ────────────────────────────────────────────────────────────── */

interface IncidentStats {
  openIncidents: number;
  contained: number;
  resolved: number;
  linkedDSARs: number;
  overdueDSARs: number;
  severityDistribution: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
  /** Set when user lacks INCIDENT_VIEW permission */
  permissionDenied?: boolean;
  message?: string;
}

type WidgetState =
  | { kind: "loading" }
  | { kind: "loaded"; stats: IncidentStats }
  | { kind: "no_permission"; message: string }
  | { kind: "error"; message: string; retryable: boolean };

/* ── Severity badge config ────────────────────────────────────────────── */

const SEVERITY_CONFIG: {
  key: keyof IncidentStats["severityDistribution"];
  label: string;
  dot: string;
  badge: string;
}[] = [
  { key: "LOW", label: "Low", dot: "bg-gray-400", badge: "bg-gray-100 text-gray-700" },
  { key: "MEDIUM", label: "Medium", dot: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-700" },
  { key: "HIGH", label: "High", dot: "bg-orange-400", badge: "bg-orange-100 text-orange-700" },
  { key: "CRITICAL", label: "Critical", dot: "bg-red-500", badge: "bg-red-100 text-red-700" },
];

/* ── Component ────────────────────────────────────────────────────────── */

export default function IncidentDashboardWidget() {
  const [state, setState] = useState<WidgetState>({ kind: "loading" });

  const fetchStats = useCallback(async () => {
    setState({ kind: "loading" });

    const result = await fetchJsonWithRetry<IncidentStats>(
      "/api/incidents/stats",
      { retries: 2, backoffMs: 1000 },
    );

    if (result.data) {
      // Server returns permissionDenied flag for users without INCIDENT_VIEW
      if (result.data.permissionDenied) {
        setState({
          kind: "no_permission",
          message: result.data.message || "No access to incident data",
        });
        return;
      }
      setState({ kind: "loaded", stats: result.data });
      return;
    }

    // Classify the error
    if (result.permissionDenied || result.status === 401) {
      setState({
        kind: "no_permission",
        message: result.status === 401
          ? "Please log in to view incident data"
          : "You do not have permission to view incident data",
      });
      return;
    }

    setState({
      kind: "error",
      message: result.error || "Failed to load incident data",
      retryable: result.status === 0 || result.status >= 500,
    });
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  /* Loading skeleton */
  if (state.kind === "loading") {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-200" />
            <div className="h-4 w-40 rounded bg-gray-200" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg bg-gray-100 px-3 py-2">
                <div className="mx-auto h-5 w-8 rounded bg-gray-200" />
                <div className="mx-auto mt-1 h-3 w-16 rounded bg-gray-200" />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-5 w-16 rounded-full bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* No permission — show informational card instead of error */
  if (state.kind === "no_permission") {
    return (
      <div className="card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Incident-Linked DSARs</h3>
            <p className="mt-0.5 text-xs text-gray-500">{state.message}</p>
          </div>
        </div>
      </div>
    );
  }

  /* Error state — with retry button for transient errors */
  if (state.kind === "error") {
    return (
      <div className="card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">Incident-Linked DSARs</h3>
            <p className="mt-0.5 text-xs text-red-600">{state.message}</p>
          </div>
          {state.retryable && (
            <button
              onClick={fetchStats}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const stats = state.stats;

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Incident-Linked DSARs</h3>
        </div>
        <Link
          href="/governance/incidents"
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          View Incidents
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-lg bg-red-50 px-3 py-2 text-center">
          <p className={`text-lg font-bold ${stats.openIncidents > 0 ? "text-red-700" : "text-gray-700"}`}>
            {stats.openIncidents}
          </p>
          <p className="text-xs text-gray-600">Open Incidents</p>
        </div>
        <div className="rounded-lg bg-yellow-50 px-3 py-2 text-center">
          <p className="text-lg font-bold text-yellow-700">{stats.contained}</p>
          <p className="text-xs text-gray-600">Contained</p>
        </div>
        <div className="rounded-lg bg-green-50 px-3 py-2 text-center">
          <p className="text-lg font-bold text-green-700">{stats.resolved}</p>
          <p className="text-xs text-gray-600">Resolved</p>
        </div>
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-center">
          <p className="text-lg font-bold text-blue-700">{stats.linkedDSARs}</p>
          <p className="text-xs text-gray-600">Linked DSARs</p>
        </div>
        <div className="rounded-lg bg-red-50 px-3 py-2 text-center">
          <p className={`text-lg font-bold ${stats.overdueDSARs > 0 ? "text-red-700" : "text-gray-700"}`}>
            {stats.overdueDSARs}
          </p>
          <p className="text-xs text-gray-600">Overdue DSARs</p>
        </div>
      </div>

      {/* Severity Distribution */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Severity Distribution</p>
        <div className="flex flex-wrap items-center gap-2">
          {SEVERITY_CONFIG.map(({ key, label, dot, badge }) => (
            <span
              key={key}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge}`}
            >
              <span className={`h-2 w-2 rounded-full ${dot}`} />
              {label}: {stats.severityDistribution[key]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
