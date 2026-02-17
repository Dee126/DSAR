"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Incident {
  id: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "CONTAINED" | "RESOLVED";
  detectedAt: string;
  regulatorNotified: boolean;
  regulatorNotifiedAt?: string | null;
}

interface LinkedIncident {
  id: string;
  incidentId: string;
  linkReason: string;
  subjectInScope: "UNKNOWN" | "YES" | "NO";
  incident: Incident;
}

interface IncidentsResponse {
  linkedIncidents: LinkedIncident[];
  hasActiveRegulatorTimeline: boolean;
}

interface AvailableIncident {
  id: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "CONTAINED" | "RESOLVED";
  detectedAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  LOW: "bg-blue-100 text-blue-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  CONTAINED: "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-green-100 text-green-700",
};

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

export default function IncidentPanel({ caseId }: { caseId: string }) {
  const [linkedIncidents, setLinkedIncidents] = useState<LinkedIncident[]>([]);
  const [hasActiveRegulatorTimeline, setHasActiveRegulatorTimeline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [availableIncidents, setAvailableIncidents] = useState<AvailableIncident[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState("");
  const [linkReason, setLinkReason] = useState("");
  const [subjectInScope, setSubjectInScope] = useState<"UNKNOWN" | "YES" | "NO">("UNKNOWN");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const fetchLinkedIncidents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/cases/${caseId}/incidents`);
      if (!res.ok) {
        throw new Error(`Failed to fetch incidents: ${res.status}`);
      }
      const data: IncidentsResponse = await res.json();
      setLinkedIncidents(data.linkedIncidents);
      setHasActiveRegulatorTimeline(data.hasActiveRegulatorTimeline);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchLinkedIncidents();
  }, [fetchLinkedIncidents]);

  const openModal = async () => {
    setModalOpen(true);
    setSelectedIncidentId("");
    setLinkReason("");
    setSubjectInScope("UNKNOWN");
    setSubmitError(null);
    setLoadingAvailable(true);

    try {
      const res = await fetch("/api/incidents");
      if (!res.ok) {
        throw new Error(`Failed to fetch available incidents: ${res.status}`);
      }
      const data = await res.json();
      const incidents: AvailableIncident[] = Array.isArray(data) ? data : data.incidents ?? [];
      setAvailableIncidents(incidents);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to load incidents");
    } finally {
      setLoadingAvailable(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedIncidentId("");
    setLinkReason("");
    setSubjectInScope("UNKNOWN");
    setSubmitError(null);
  };

  const handleLink = async () => {
    if (!selectedIncidentId) {
      setSubmitError("Please select an incident.");
      return;
    }
    if (!linkReason.trim()) {
      setSubmitError("Please provide a link reason.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      const res = await fetch(`/api/cases/${caseId}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: selectedIncidentId,
          linkReason: linkReason.trim(),
          subjectInScope,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to link incident: ${res.status}`);
      }
      closeModal();
      await fetchLinkedIncidents();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to link incident");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlink = async (incidentId: string) => {
    try {
      setUnlinkingId(incidentId);
      const res = await fetch(
        `/api/cases/${caseId}/incidents?incidentId=${encodeURIComponent(incidentId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to unlink incident: ${res.status}`);
      }
      await fetchLinkedIncidents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink incident");
    } finally {
      setUnlinkingId(null);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Warning Banner */}
      {hasActiveRegulatorTimeline && (
        <div className="flex items-start gap-3 rounded-t-lg border-b border-amber-200 bg-amber-50 px-4 py-3">
          <svg
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <p className="text-sm font-medium text-amber-800">
            This case is linked to an incident with an active regulator timeline. Priority handling required.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286z"
            />
          </svg>
          <h3 className="text-sm font-semibold text-gray-900">Linked Incidents</h3>
          <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {linkedIncidents.length}
          </span>
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
            />
          </svg>
          Link to Incident
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
            <span className="ml-2 text-sm text-gray-500">Loading incidents...</span>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && linkedIncidents.length === 0 && (
          <div className="py-6 text-center">
            <svg
              className="mx-auto h-8 w-8 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No linked incidents</p>
            <p className="text-xs text-gray-400">
              Link incidents to track cross-references between DSAR cases and security events.
            </p>
          </div>
        )}

        {!loading && !error && linkedIncidents.length > 0 && (
          <>
            {/* Summary */}
            <div className="mb-3 rounded-md bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-600">
                <span className="font-medium">{linkedIncidents.length}</span>{" "}
                {linkedIncidents.length === 1 ? "incident" : "incidents"} linked
                {" | "}
                <span className="font-medium">
                  {linkedIncidents.filter((li) => li.incident.status === "OPEN").length}
                </span>{" "}
                open
                {" | "}
                <span className="font-medium">
                  {linkedIncidents.filter((li) => li.incident.regulatorNotified).length}
                </span>{" "}
                regulator notified
              </p>
            </div>

            {/* Incident List */}
            <ul className="space-y-3">
              {linkedIncidents.map((li) => (
                <li
                  key={li.id}
                  className="rounded-md border border-gray-200 p-3 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/governance/incidents/${li.incidentId}`}
                        className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                      >
                        {li.incident.title}
                      </Link>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[li.incident.severity]}`}
                        >
                          {li.incident.severity}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[li.incident.status]}`}
                        >
                          {li.incident.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          Detected: {formatDate(li.incident.detectedAt)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {li.incident.regulatorNotified ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700">
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 12.75L11.25 15 15 9.75"
                              />
                            </svg>
                            Regulator notified
                            {li.incident.regulatorNotifiedAt &&
                              ` on ${formatDate(li.incident.regulatorNotifiedAt)}`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            Regulator not yet notified
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlink(li.incidentId)}
                      disabled={unlinkingId === li.incidentId}
                      className="flex-shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      {unlinkingId === li.incidentId ? "Unlinking..." : "Unlink"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Link Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeModal}
          />

          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h4 className="text-sm font-semibold text-gray-900">Link to Incident</h4>
              <button
                onClick={closeModal}
                className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
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

            <div className="space-y-4 p-4">
              {/* Incident Dropdown */}
              <div>
                <label
                  htmlFor="incident-select"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Incident
                </label>
                {loadingAvailable ? (
                  <div className="flex items-center gap-2 py-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
                    <span className="text-sm text-gray-500">Loading incidents...</span>
                  </div>
                ) : (
                  <select
                    id="incident-select"
                    value={selectedIncidentId}
                    onChange={(e) => setSelectedIncidentId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">Select an incident...</option>
                    {availableIncidents.map((inc) => (
                      <option key={inc.id} value={inc.id}>
                        {inc.title} ({inc.severity} - {inc.status})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Link Reason */}
              <div>
                <label
                  htmlFor="link-reason"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Link Reason
                </label>
                <textarea
                  id="link-reason"
                  rows={3}
                  value={linkReason}
                  onChange={(e) => setLinkReason(e.target.value)}
                  placeholder="Explain why this case is related to the selected incident..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Subject In Scope */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Data Subject In Scope
                </label>
                <div className="flex items-center gap-4">
                  {(["UNKNOWN", "YES", "NO"] as const).map((value) => (
                    <label key={value} className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="subjectInScope"
                        value={value}
                        checked={subjectInScope === value}
                        onChange={() => setSubjectInScope(value)}
                        className="h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-gray-700">{value}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit Error */}
              {submitError && (
                <div className="rounded-md bg-red-50 p-3">
                  <p className="text-sm text-red-700">{submitError}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
              <button
                onClick={closeModal}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLink}
                disabled={submitting || loadingAvailable}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? "Linking..." : "Link Incident"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
