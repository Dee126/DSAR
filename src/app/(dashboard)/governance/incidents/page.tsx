"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

/* ── Display helpers ──────────────────────────────────────────────────── */

const SEVERITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const SEVERITY_COLORS: Record<string, string> = {
  LOW: "bg-blue-100 text-blue-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  CONTAINED: "Contained",
  RESOLVED: "Resolved",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-100 text-red-800",
  CONTAINED: "bg-yellow-100 text-yellow-800",
  RESOLVED: "bg-green-100 text-green-800",
};

const INCIDENT_STATUSES = ["OPEN", "CONTAINED", "RESOLVED"] as const;
const INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = months[date.getMonth()];
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}

/* ── Types ────────────────────────────────────────────────────────────── */

interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  detectedAt: string;
  numberOfDataSubjectsEstimate: number | null;
  regulatorNotificationRequired: boolean;
  crossBorder: boolean;
  createdAt: string;
  _count?: {
    dsarIncidents: number;
    regulatorRecords: number;
    timeline: number;
  };
}

/* ── Component ────────────────────────────────────────────────────────── */

export default function IncidentsPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [hasLinkedDSARs, setHasLinkedDSARs] = useState(false);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Create form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSeverity, setFormSeverity] = useState("MEDIUM");
  const [formDetectedAt, setFormDetectedAt] = useState("");
  const [formRegulatorRequired, setFormRegulatorRequired] = useState(false);
  const [formDataSubjectsEstimate, setFormDataSubjectsEstimate] = useState("");
  const [formCrossBorder, setFormCrossBorder] = useState(false);

  /* ── Fetch incidents ──────────────────────────────────────────────── */

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (severityFilter) params.set("severity", severityFilter);
      if (hasLinkedDSARs) params.set("hasLinkedDSARs", "true");

      const res = await fetch(`/api/incidents?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Failed to fetch incidents (${res.status})`);
      }
      const json = await res.json();
      setIncidents(Array.isArray(json) ? json : json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, hasLinkedDSARs]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  /* ── Create incident ──────────────────────────────────────────────── */

  function resetCreateForm() {
    setFormTitle("");
    setFormDescription("");
    setFormSeverity("MEDIUM");
    setFormDetectedAt("");
    setFormRegulatorRequired(false);
    setFormDataSubjectsEstimate("");
    setFormCrossBorder(false);
    setCreateError(null);
  }

  function handleOpenCreateModal() {
    resetCreateForm();
    setShowCreateModal(true);
  }

  function handleCloseCreateModal() {
    setShowCreateModal(false);
    resetCreateForm();
  }

  async function handleCreateIncident(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) {
      setCreateError("Title is required.");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const body: Record<string, unknown> = {
        title: formTitle.trim(),
        severity: formSeverity,
        regulatorNotificationRequired: formRegulatorRequired,
        crossBorder: formCrossBorder,
      };

      if (formDescription.trim()) {
        body.description = formDescription.trim();
      }
      if (formDetectedAt) {
        body.detectedAt = new Date(formDetectedAt).toISOString();
      }
      if (formDataSubjectsEstimate !== "") {
        const num = parseInt(formDataSubjectsEstimate, 10);
        if (!isNaN(num) && num >= 0) {
          body.numberOfDataSubjectsEstimate = num;
        }
      }

      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error ?? `Failed to create incident (${res.status})`);
      }

      handleCloseCreateModal();
      fetchIncidents();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create incident");
    } finally {
      setCreating(false);
    }
  }

  /* ── Helpers ──────────────────────────────────────────────────────── */

  function getDsarCount(incident: Incident): number {
    return incident._count?.dsarIncidents ?? 0;
  }

  function getRegulatorCount(incident: Incident): number {
    return incident._count?.regulatorRecords ?? 0;
  }

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            Incidents &amp; Authorities
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage security/privacy incidents, link to DSAR cases, and prepare
            authority submissions.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="btn-primary"
        >
          <svg
            className="mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Register Incident
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-auto">
            <label htmlFor="filter-status" className="label">
              Status
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field w-full sm:w-44"
            >
              <option value="">All Statuses</option>
              {INCIDENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-auto">
            <label htmlFor="filter-severity" className="label">
              Severity
            </label>
            <select
              id="filter-severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="input-field w-full sm:w-44"
            >
              <option value="">All Severities</option>
              {INCIDENT_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-auto flex items-end">
            <label className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasLinkedDSARs}
                onChange={(e) => setHasLinkedDSARs(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-700">Has linked DSARs</span>
            </label>
          </div>

          {(statusFilter || severityFilter || hasLinkedDSARs) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("");
                setSeverityFilter("");
                setHasLinkedDSARs(false);
              }}
              className="text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card p-0">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded bg-gray-100"
              />
            ))}
          </div>
        ) : incidents.length === 0 ? (
          <div className="px-6 py-16 text-center">
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
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">
              No incidents found. Adjust your filters or register a new incident.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3">Title</th>
                    <th className="px-6 py-3">Severity</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Detected</th>
                    <th className="px-6 py-3">Data Subjects Est.</th>
                    <th className="px-6 py-3">DSARs Linked</th>
                    <th className="px-6 py-3">Regulator Records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {incidents.map((incident) => (
                    <tr
                      key={incident.id}
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                      onClick={() =>
                        router.push(`/governance/incidents/${incident.id}`)
                      }
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">
                          {incident.title}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            SEVERITY_COLORS[incident.severity] ??
                            "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {SEVERITY_LABELS[incident.severity] ??
                            incident.severity}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            STATUS_COLORS[incident.status] ??
                            "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {STATUS_LABELS[incident.status] ?? incident.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {incident.detectedAt
                          ? formatDate(incident.detectedAt)
                          : <span className="text-gray-400">--</span>}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {incident.numberOfDataSubjectsEstimate != null
                          ? incident.numberOfDataSubjectsEstimate.toLocaleString()
                          : <span className="text-gray-400">--</span>}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {getDsarCount(incident)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {getRegulatorCount(incident)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="divide-y divide-gray-200 md:hidden">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="cursor-pointer p-4 transition-colors hover:bg-gray-50 relative"
                  onClick={() =>
                    router.push(`/governance/incidents/${incident.id}`)
                  }
                >
                  <div className="pr-6">
                    {/* Line 1: Title + Severity */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {incident.title}
                      </span>
                      <span
                        className={`inline-flex flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          SEVERITY_COLORS[incident.severity] ??
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {SEVERITY_LABELS[incident.severity] ??
                          incident.severity}
                      </span>
                    </div>

                    {/* Line 2: Status + Detected date */}
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[incident.status] ??
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {STATUS_LABELS[incident.status] ?? incident.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {incident.detectedAt
                          ? formatDate(incident.detectedAt)
                          : "No detection date"}
                      </span>
                    </div>

                    {/* Line 3: Counts */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {incident.numberOfDataSubjectsEstimate != null && (
                        <span>
                          {incident.numberOfDataSubjectsEstimate.toLocaleString()}{" "}
                          subjects est.
                        </span>
                      )}
                      <span>
                        {getDsarCount(incident)} DSAR
                        {getDsarCount(incident) !== 1 ? "s" : ""}
                      </span>
                      <span>
                        {getRegulatorCount(incident)} regulator rec.
                      </span>
                    </div>
                  </div>

                  {/* Chevron */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 4.5l7.5 7.5-7.5 7.5"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Create Incident Modal ──────────────────────────────────────── */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseCreateModal();
          }}
        >
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Register Incident
              </h2>
              <button
                type="button"
                onClick={handleCloseCreateModal}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateIncident}>
              <div className="max-h-[70vh] overflow-y-auto px-6 py-4 space-y-4">
                {/* Title */}
                <div>
                  <label htmlFor="incident-title" className="label">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="incident-title"
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Brief description of the incident"
                    className="input-field"
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="incident-description" className="label">
                    Description
                  </label>
                  <textarea
                    id="incident-description"
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Detailed description of what occurred..."
                    className="input-field min-h-[80px] resize-y"
                  />
                </div>

                {/* Severity */}
                <div>
                  <label htmlFor="incident-severity" className="label">
                    Severity
                  </label>
                  <select
                    id="incident-severity"
                    value={formSeverity}
                    onChange={(e) => setFormSeverity(e.target.value)}
                    className="input-field"
                  >
                    {INCIDENT_SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {SEVERITY_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Detected At */}
                <div>
                  <label htmlFor="incident-detected-at" className="label">
                    Detected At
                  </label>
                  <input
                    id="incident-detected-at"
                    type="datetime-local"
                    value={formDetectedAt}
                    onChange={(e) => setFormDetectedAt(e.target.value)}
                    className="input-field"
                  />
                </div>

                {/* Number of Data Subjects Estimate */}
                <div>
                  <label
                    htmlFor="incident-data-subjects"
                    className="label"
                  >
                    Estimated Data Subjects Affected
                  </label>
                  <input
                    id="incident-data-subjects"
                    type="number"
                    min="0"
                    value={formDataSubjectsEstimate}
                    onChange={(e) =>
                      setFormDataSubjectsEstimate(e.target.value)
                    }
                    placeholder="0"
                    className="input-field"
                  />
                </div>

                {/* Checkboxes */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formRegulatorRequired}
                      onChange={(e) =>
                        setFormRegulatorRequired(e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-700">
                      Regulator notification required
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formCrossBorder}
                      onChange={(e) => setFormCrossBorder(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-700">
                      Cross-border incident
                    </span>
                  </label>
                </div>

                {/* Error */}
                {createError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3">
                    <p className="text-sm text-red-700">{createError}</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  disabled={creating}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !formTitle.trim()}
                  className="btn-primary"
                >
                  {creating ? (
                    <>
                      <svg
                        className="mr-2 h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Creating...
                    </>
                  ) : (
                    "Register Incident"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
