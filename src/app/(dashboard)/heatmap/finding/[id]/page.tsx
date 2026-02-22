"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface Evidence {
  id: string;
  location: string;
  title: string;
  itemType: string;
  provider: string;
  workload: string | null;
  sensitivityScore: number | null;
  metadata: Record<string, unknown> | null;
  createdAtSource: string | null;
}

interface MitigationTask {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
  assignee: { id: string; name: string } | null;
}

interface FindingDetail {
  id: string;
  tenantId: string;
  caseId: string;
  runId: string;
  systemId: string | null;
  riskScore: number;
  severity: string;
  status: string;
  dataCategory: string;
  summary: string;
  confidence: number;
  containsSpecialCategory: boolean;
  containsThirdPartyDataSuspected: boolean;
  requiresLegalReview: boolean;
  dataAssetLocation: string | null;
  sampleRedacted: string | null;
  statusComment: string | null;
  statusChangedAt: string | null;
  mitigationDueDate: string | null;
  createdAt: string;
  system: { id: string; name: string; description: string | null; criticality: string } | null;
  run: {
    id: string;
    status: string;
    case: {
      id: string;
      caseNumber: string;
      dataSubject: { id: string; fullName: string };
    };
  };
  statusChangedBy: { id: string; name: string; email: string } | null;
  mitigationTasks: MitigationTask[];
  evidenceItems: Evidence[];
}

interface AuditEvent {
  id: string;
  action: string;
  comment: string | null;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string; email: string };
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

const ACTION_LABELS: Record<string, string> = {
  FINDING_ACCEPT_RISK: "Accepted Risk",
  FINDING_CREATE_MITIGATION: "Created Mitigation Task",
  FINDING_MARK_MITIGATED: "Marked as Mitigated",
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

function riskBadge(score: number) {
  if (score >= 70) return "bg-red-100 text-red-700 border-red-300";
  if (score >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-300";
  return "bg-green-100 text-green-700 border-green-300";
}

function riskLabel(score: number) {
  if (score >= 70) return "High Risk";
  if (score >= 40) return "Medium Risk";
  return "Low Risk";
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function FindingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [finding, setFinding] = useState<FindingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audit trail
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Action state
  const [actionMode, setActionMode] = useState<
    null | "accept_risk" | "create_mitigation" | "mark_mitigated"
  >(null);
  const [actionComment, setActionComment] = useState("");
  const [actionDueDate, setActionDueDate] = useState("");
  const [actionTaskTitle, setActionTaskTitle] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchFinding = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/findings/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFinding(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchAuditTrail = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/findings/${id}/audit`);
      if (res.ok) {
        setAuditEvents(await res.json());
      }
    } catch {
      // Audit trail is non-critical
    } finally {
      setAuditLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchFinding();
    fetchAuditTrail();
  }, [fetchFinding, fetchAuditTrail]);

  async function submitAction() {
    if (!actionMode) return;
    setActionLoading(true);
    setActionError(null);

    try {
      let url: string;
      let body: Record<string, string>;

      if (actionMode === "accept_risk") {
        url = `/api/findings/${id}/accept`;
        body = { comment: actionComment };
      } else if (actionMode === "create_mitigation") {
        url = `/api/findings/${id}/mitigate`;
        body = { comment: actionComment, dueDate: actionDueDate };
        if (actionTaskTitle) body.taskTitle = actionTaskTitle;
      } else {
        url = `/api/findings/${id}/resolve`;
        body = { comment: actionComment };
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

      // Refresh data and close modal
      setActionMode(null);
      setActionComment("");
      setActionDueDate("");
      setActionTaskTitle("");
      await Promise.all([fetchFinding(), fetchAuditTrail()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-64 animate-pulse rounded bg-gray-200" />
        <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-60 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (error || !finding) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-sm text-red-700">
          {error ?? "Finding not found"}
        </p>
        <button
          onClick={() => router.back()}
          className="mt-2 text-sm font-medium text-red-600 hover:text-red-800"
        >
          Go back
        </button>
      </div>
    );
  }

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
        {finding.system && (
          <>
            <Link
              href={`/heatmap/system/${finding.system.id}`}
              className="hover:text-brand-600"
            >
              {finding.system.name}
            </Link>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </>
        )}
        <span className="font-medium text-gray-900">Finding Detail</span>
      </nav>

      {/* Header Card */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">
              {finding.summary}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded-full border px-2.5 py-0.5 font-bold ${riskBadge(
                  finding.riskScore
                )}`}
              >
                Risk: {finding.riskScore} &mdash; {riskLabel(finding.riskScore)}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-medium ${
                  finding.severity === "CRITICAL"
                    ? "bg-red-100 text-red-700"
                    : finding.severity === "WARNING"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {finding.severity}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-medium ${statusBadgeClass(finding.status)}`}
              >
                {finding.status}
              </span>
              <span className="text-gray-500">
                {CATEGORY_LABELS[finding.dataCategory] ?? finding.dataCategory}
              </span>
              {finding.containsSpecialCategory && (
                <span className="font-semibold text-red-600">Art. 9</span>
              )}
              {finding.requiresLegalReview && (
                <span className="font-semibold text-orange-600">
                  Legal Review Required
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 gap-2">
            {finding.status === "OPEN" && (
              <>
                <button
                  onClick={() => setActionMode("accept_risk")}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                >
                  Accept Risk
                </button>
                <button
                  onClick={() => setActionMode("create_mitigation")}
                  className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  Create Mitigation
                </button>
              </>
            )}
            {finding.status === "MITIGATING" && (
              <button
                onClick={() => setActionMode("mark_mitigated")}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              >
                Mark Mitigated
              </button>
            )}
          </div>
        </div>

        {/* Status comment */}
        {finding.statusComment && (
          <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <span className="font-medium">Status note:</span>{" "}
            {finding.statusComment}
            {finding.statusChangedBy && (
              <span className="text-gray-400">
                {" "}
                &mdash; {finding.statusChangedBy.name}
                {finding.statusChangedAt &&
                  `, ${new Date(finding.statusChangedAt).toLocaleString()}`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action Modal */}
      {actionMode && (
        <div className="card border-2 border-brand-300">
          <h3 className="text-sm font-semibold text-gray-900">
            {actionMode === "accept_risk"
              ? "Accept Risk"
              : actionMode === "create_mitigation"
              ? "Create Mitigation Task"
              : "Mark as Mitigated"}
          </h3>

          {actionError && (
            <p className="mt-2 text-xs text-red-600">{actionError}</p>
          )}

          <div className="mt-3 space-y-3">
            {actionMode === "create_mitigation" && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-600">
                    Task Title (optional)
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                    placeholder="Auto-generated from finding summary"
                    value={actionTaskTitle}
                    onChange={(e) => setActionTaskTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                    value={actionDueDate}
                    onChange={(e) => setActionDueDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-medium text-gray-600">
                Comment *
              </label>
              <textarea
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                rows={3}
                placeholder={
                  actionMode === "accept_risk"
                    ? "Explain why the risk is accepted..."
                    : actionMode === "create_mitigation"
                    ? "Describe the mitigation plan..."
                    : "Confirm the mitigation is complete..."
                }
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={submitAction}
                disabled={
                  actionLoading ||
                  !actionComment.trim() ||
                  (actionMode === "create_mitigation" && !actionDueDate)
                }
                className="btn-primary text-xs disabled:opacity-50"
              >
                {actionLoading
                  ? "Saving..."
                  : actionMode === "accept_risk"
                  ? "Confirm Accept Risk"
                  : actionMode === "create_mitigation"
                  ? "Create Mitigation Task"
                  : "Confirm Mitigated"}
              </button>
              <button
                onClick={() => {
                  setActionMode(null);
                  setActionError(null);
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column: Details */}
        <div className="space-y-6">
          {/* Meta */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700">Details</h3>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-gray-500">System</dt>
                <dd className="font-medium text-gray-900">
                  {finding.system?.name ?? "Unassigned"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Case</dt>
                <dd>
                  <Link
                    href={`/cases/${finding.run.case.id}`}
                    className="font-medium text-brand-600 hover:text-brand-700"
                  >
                    {finding.run.case.caseNumber}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Data Subject</dt>
                <dd className="font-medium text-gray-900">
                  {finding.run.case.dataSubject.fullName}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Data Category</dt>
                <dd className="font-medium text-gray-900">
                  {CATEGORY_LABELS[finding.dataCategory] ??
                    finding.dataCategory}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Confidence</dt>
                <dd className="font-medium text-gray-900">
                  {(finding.confidence * 100).toFixed(0)}%
                </dd>
              </div>
              {finding.dataAssetLocation && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Data Asset Location</dt>
                  <dd className="text-right font-medium text-gray-900">
                    {finding.dataAssetLocation}
                  </dd>
                </div>
              )}
              {finding.mitigationDueDate && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Mitigation Due</dt>
                  <dd className="font-medium text-gray-900">
                    {new Date(finding.mitigationDueDate).toLocaleDateString()}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Discovered</dt>
                <dd className="text-gray-700">
                  {new Date(finding.createdAt).toLocaleString()}
                </dd>
              </div>
              {finding.containsThirdPartyDataSuspected && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Third-Party Data</dt>
                  <dd className="font-medium text-orange-600">Suspected</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Redacted Sample */}
          {finding.sampleRedacted && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700">
                Redacted Data Sample
              </h3>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700 font-mono whitespace-pre-wrap">
                {finding.sampleRedacted}
              </pre>
            </div>
          )}

          {/* Mitigation Tasks */}
          {finding.mitigationTasks.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700">
                Mitigation Tasks
              </h3>
              <div className="mt-2 space-y-2">
                {finding.mitigationTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
                  >
                    <div>
                      <p className="text-xs font-medium text-gray-900">
                        {t.title}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {t.assignee?.name ?? "Unassigned"} &middot;{" "}
                        {t.dueDate
                          ? `Due: ${new Date(t.dueDate).toLocaleDateString()}`
                          : "No due date"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        t.status === "DONE"
                          ? "bg-green-100 text-green-700"
                          : t.status === "IN_PROGRESS"
                          ? "bg-blue-100 text-blue-700"
                          : t.status === "BLOCKED"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Trail */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700">
              Audit Trail
            </h3>
            {auditLoading ? (
              <div className="mt-3 space-y-2">
                <div className="h-12 animate-pulse rounded bg-gray-100" />
                <div className="h-12 animate-pulse rounded bg-gray-100" />
              </div>
            ) : auditEvents.length === 0 ? (
              <p className="mt-2 text-xs text-gray-400">
                No actions recorded yet.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {auditEvents.map((event) => (
                  <div
                    key={event.id}
                    className="border-l-2 border-brand-200 pl-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-900">
                        {ACTION_LABELS[event.action] ?? event.action}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(event.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-600">
                      by {event.actor.name}
                    </p>
                    {event.comment && (
                      <p className="mt-1 text-xs text-gray-500 italic">
                        &ldquo;{event.comment}&rdquo;
                      </p>
                    )}
                    {event.beforeJson && event.afterJson && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[10px] text-brand-600 hover:text-brand-700">
                          View before/after
                        </summary>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] font-medium text-gray-500">Before</p>
                            <pre className="overflow-x-auto rounded bg-gray-50 p-1.5 text-[10px] text-gray-600 font-mono whitespace-pre-wrap">
                              {JSON.stringify(event.beforeJson, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-gray-500">After</p>
                            <pre className="overflow-x-auto rounded bg-gray-50 p-1.5 text-[10px] text-gray-600 font-mono whitespace-pre-wrap">
                              {JSON.stringify(event.afterJson, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Evidence */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700">
              Evidence Items ({finding.evidenceItems.length})
            </h3>
            {finding.evidenceItems.length === 0 ? (
              <p className="mt-2 text-xs text-gray-400">
                No evidence items linked.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {finding.evidenceItems.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-lg border border-gray-100 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-900">
                        {ev.title}
                      </p>
                      {ev.sensitivityScore != null && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            ev.sensitivityScore >= 70
                              ? "bg-red-100 text-red-700"
                              : ev.sensitivityScore >= 40
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          Sensitivity: {ev.sensitivityScore}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
                        {ev.provider}
                        {ev.workload ? ` / ${ev.workload}` : ""}
                      </span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
                        {ev.itemType}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400 truncate">
                      {ev.location}
                    </p>
                    {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[10px] text-brand-600 hover:text-brand-700">
                          View metadata
                        </summary>
                        <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-[10px] text-gray-600 font-mono whitespace-pre-wrap">
                          {JSON.stringify(ev.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
