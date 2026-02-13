"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

/* ── Types ────────────────────────────────────────────────────────────── */

interface GovernanceSettings {
  copilotEnabled: boolean;
  allowedProviderPhases: number[];
  defaultExecutionMode: string;
  allowContentScanning: boolean;
  allowOcr: boolean;
  allowLlmSummaries: boolean;
  maxRunsPerDayTenant: number;
  maxRunsPerDayUser: number;
  maxEvidenceItemsPerRun: number;
  maxContentScanBytes: number;
  maxConcurrentRuns: number;
  dueSoonWindowDays: number;
  artifactRetentionDays: number;
  twoPersonApprovalForExport: boolean;
  requireJustification: boolean;
  requireConfirmation: boolean;
}

interface ActivityLogEntry {
  runId: string;
  caseId: string;
  caseNumber: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  justification: string;
  subjectIdentifier: string;
  subjectIdentifierType: string;
  systemsSearched: string[];
  contentScanningUsed: boolean;
  ocrUsed: boolean;
  art9Suspected: boolean;
  specialCategories: string[];
  totalFindings: number;
  totalEvidenceItems: number;
  exportGenerated: boolean;
  exportApprovedBy: string | null;
  legalApprovalStatus: string;
}

interface ActivityLogSummary {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  art9DetectedRuns: number;
  totalExports: number;
  uniqueUsers: number;
  uniqueCases: number;
  periodStart: string;
  periodEnd: string;
}

interface PendingApproval {
  runId: string;
  caseId: string;
  tenantId: string;
  type: "ART9_LEGAL_REVIEW" | "EXPORT_APPROVAL";
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedBy: string;
  requestedAt: string;
  approvals: Array<{
    userId: string;
    role: string;
    approved: boolean;
    comment: string;
    timestamp: string;
  }>;
}

const ADMIN_ROLES = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO"];

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  BLOCKED: "bg-yellow-100 text-yellow-700",
  RUNNING: "bg-blue-100 text-blue-700 animate-pulse",
  CREATED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const APPROVAL_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

/* ── Component ────────────────────────────────────────────────────────── */

export default function GovernancePage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";
  const isAdmin = ADMIN_ROLES.includes(userRole);

  const [activeTab, setActiveTab] = useState<"activity" | "approvals" | "settings">("activity");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Governance Center</h1>
        <p className="mt-1 text-sm text-gray-500">
          Copilot governance, audit trail, and compliance controls. Zero-trust by design.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("activity")}
            className={`border-b-2 px-1 py-3 text-sm font-medium ${
              activeTab === "activity"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Activity Log
          </button>
          <button
            onClick={() => setActiveTab("approvals")}
            className={`border-b-2 px-1 py-3 text-sm font-medium ${
              activeTab === "approvals"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Pending Approvals
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("settings")}
              className={`border-b-2 px-1 py-3 text-sm font-medium ${
                activeTab === "settings"
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Settings
            </button>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "activity" && <ActivityLogTab isAdmin={isAdmin} />}
      {activeTab === "approvals" && <ApprovalsTab />}
      {activeTab === "settings" && isAdmin && <SettingsTab />}
    </div>
  );
}

/* ── Activity Log Tab ─────────────────────────────────────────────────── */

function ActivityLogTab({ isAdmin }: { isAdmin: boolean }) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [summary, setSummary] = useState<ActivityLogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [specialCatFilter, setSpecialCatFilter] = useState("");
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (specialCatFilter) params.set("containsSpecialCategory", specialCatFilter);

      const res = await fetch(`/api/governance/activity-log?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setSummary(data.summary);
        setTotalPages(data.pagination.totalPages);
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, specialCatFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleExport(format: "csv" | "json") {
    setExporting(true);
    try {
      const res = await fetch(`/api/governance/report-export?format=${format}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `governance-report.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      /* silently fail */
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card">
            <p className="text-sm font-medium text-gray-500">Total Runs</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{summary.totalRuns}</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-500">Completed</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{summary.completedRuns}</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-500">Art. 9 Flagged</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{summary.art9DetectedRuns}</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-gray-500">Exports</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{summary.totalExports}</p>
          </div>
        </div>
      )}

      {/* Filters + Export */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="BLOCKED">Blocked</option>
        </select>

        <select
          value={specialCatFilter}
          onChange={(e) => { setSpecialCatFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All categories</option>
          <option value="true">Art. 9 flagged</option>
          <option value="false">No Art. 9</option>
        </select>

        <div className="flex-1" />

        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              onClick={() => handleExport("json")}
              disabled={exporting}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Export JSON
            </button>
          </div>
        )}
      </div>

      {/* Activity Table */}
      <div className="card p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500">No activity log entries yet.</p>
            <p className="mt-1 text-xs text-gray-400">Copilot run activity will appear here automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Case</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Findings</th>
                  <th className="px-4 py-3">Art. 9</th>
                  <th className="px-4 py-3">Export</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries.map((entry) => (
                  <tr key={entry.runId} className="text-sm hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-brand-600">
                      {entry.caseNumber}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      <span>{entry.actorName}</span>
                      <span className="ml-1 text-xs text-gray-400">({entry.actorRole})</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[entry.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500 font-mono text-xs">
                      {entry.subjectIdentifier}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{entry.totalFindings}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {entry.art9Suspected ? (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          {entry.specialCategories.join(", ") || "Yes"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {entry.exportGenerated ? (
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Exported
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {entry.startedAt ? new Date(entry.startedAt).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Approvals Tab ────────────────────────────────────────────────────── */

function ApprovalsTab() {
  const { data: session } = useSession();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchApprovals();
  }, []);

  async function fetchApprovals() {
    setLoading(true);
    try {
      // In a real app, we'd fetch from a list endpoint. For now, show guidance.
      const res = await fetch("/api/governance/approval?runId=all");
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals ?? []);
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }

  async function handleApprovalAction(runId: string, type: string, action: "APPROVE" | "REJECT") {
    setActionLoading(runId);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/governance/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          caseId: approvals.find((a) => a.runId === runId)?.caseId ?? "",
          type,
          action,
          comment,
        }),
      });

      if (res.ok) {
        setSuccess(`Successfully ${action === "APPROVE" ? "approved" : "rejected"}.`);
        setComment("");
        setSelectedRunId(null);
        fetchApprovals();
      } else {
        const data = await res.json();
        setError(data.error ?? "Action failed.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const pendingApprovals = approvals.filter((a) => a.status === "PENDING");

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>
      )}

      {pendingApprovals.length === 0 ? (
        <div className="card py-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-2 text-sm text-gray-500">No pending approvals.</p>
          <p className="mt-1 text-xs text-gray-400">Art. 9 legal reviews and export approvals will appear here when requested.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingApprovals.map((approval) => (
            <div key={`${approval.runId}-${approval.type}`} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      approval.type === "ART9_LEGAL_REVIEW" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {approval.type === "ART9_LEGAL_REVIEW" ? "Art. 9 Legal Review" : "Export Approval"}
                    </span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${APPROVAL_STATUS_COLORS[approval.status]}`}>
                      {approval.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">
                    Run: <span className="font-mono text-xs">{approval.runId}</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    Requested: {new Date(approval.requestedAt).toLocaleString()}
                  </p>
                  {approval.approvals.length > 0 && (
                    <div className="mt-2 text-xs text-gray-400">
                      {approval.approvals.length} approval(s) received
                    </div>
                  )}
                </div>

                {approval.status === "PENDING" && (
                  <div className="flex flex-col gap-2">
                    {selectedRunId === approval.runId ? (
                      <div className="space-y-2">
                        <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Comment (optional)"
                          className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprovalAction(approval.runId, approval.type, "APPROVE")}
                            disabled={actionLoading === approval.runId}
                            className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleApprovalAction(approval.runId, approval.type, "REJECT")}
                            disabled={actionLoading === approval.runId}
                            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => { setSelectedRunId(null); setComment(""); }}
                            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedRunId(approval.runId)}
                        className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                      >
                        Review
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Historical approvals */}
      {approvals.filter((a) => a.status !== "PENDING").length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Resolved</h3>
          <div className="space-y-2">
            {approvals.filter((a) => a.status !== "PENDING").map((approval) => (
              <div key={`${approval.runId}-${approval.type}-hist`} className="card bg-gray-50 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${APPROVAL_STATUS_COLORS[approval.status]}`}>
                      {approval.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {approval.type === "ART9_LEGAL_REVIEW" ? "Art. 9 Legal Review" : "Export Approval"}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-gray-400">{approval.runId}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Settings Tab ─────────────────────────────────────────────────────── */

function SettingsTab() {
  const [settings, setSettings] = useState<GovernanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/governance/settings");
        if (res.ok) {
          setSettings(await res.json());
        }
      } catch {
        /* silently fail */
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/governance/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSettings(await res.json());
        setSuccess("Settings saved successfully. Changes are audit-logged.");
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to save settings.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      {/* Global Controls */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Global Controls</h3>
        <p className="mt-1 text-xs text-gray-500">Master switches for the Privacy Copilot.</p>

        <div className="mt-4 space-y-4">
          <ToggleField
            label="Copilot Enabled"
            description="Master switch: disable to prevent all Copilot operations tenant-wide."
            checked={settings.copilotEnabled}
            onChange={(v) => setSettings({ ...settings, copilotEnabled: v })}
          />
          <ToggleField
            label="Require Justification"
            description="Require a justification for every Copilot run (min. 10 characters)."
            checked={settings.requireJustification}
            onChange={(v) => setSettings({ ...settings, requireJustification: v })}
          />
          <ToggleField
            label="Require Confirmation"
            description="Show a confirmation dialog before starting each Copilot run."
            checked={settings.requireConfirmation}
            onChange={(v) => setSettings({ ...settings, requireConfirmation: v })}
          />
          <ToggleField
            label="Two-Person Export Approval"
            description="Require two distinct approvers for export operations (one must be DPO/Admin)."
            checked={settings.twoPersonApprovalForExport}
            onChange={(v) => setSettings({ ...settings, twoPersonApprovalForExport: v })}
          />
        </div>
      </div>

      {/* Content Controls */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Content Controls</h3>
        <p className="mt-1 text-xs text-gray-500">Control what the Copilot can access. Default: METADATA_ONLY.</p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Default Execution Mode</label>
            <select
              value={settings.defaultExecutionMode}
              onChange={(e) => setSettings({ ...settings, defaultExecutionMode: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="METADATA_ONLY">METADATA_ONLY (safest)</option>
              <option value="CONTENT_SCAN">CONTENT_SCAN</option>
              <option value="FULL_CONTENT">FULL_CONTENT</option>
            </select>
          </div>

          <ToggleField
            label="Allow Content Scanning"
            description="Allow DPO/Admin to enable content scanning per run."
            checked={settings.allowContentScanning}
            onChange={(v) => setSettings({ ...settings, allowContentScanning: v })}
          />
          <ToggleField
            label="Allow OCR"
            description="Allow OCR processing of scanned documents."
            checked={settings.allowOcr}
            onChange={(v) => setSettings({ ...settings, allowOcr: v })}
          />
          <ToggleField
            label="Allow LLM Summaries"
            description="Allow AI-generated summaries of findings."
            checked={settings.allowLlmSummaries}
            onChange={(v) => setSettings({ ...settings, allowLlmSummaries: v })}
          />
        </div>
      </div>

      {/* Rate Limits */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Rate Limits</h3>
        <p className="mt-1 text-xs text-gray-500">Prevent abuse and excessive querying.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumberField
            label="Max Runs/Day (Tenant)"
            value={settings.maxRunsPerDayTenant}
            min={1} max={10000}
            onChange={(v) => setSettings({ ...settings, maxRunsPerDayTenant: v })}
          />
          <NumberField
            label="Max Runs/Day (User)"
            value={settings.maxRunsPerDayUser}
            min={1} max={1000}
            onChange={(v) => setSettings({ ...settings, maxRunsPerDayUser: v })}
          />
          <NumberField
            label="Max Concurrent Runs"
            value={settings.maxConcurrentRuns}
            min={1} max={50}
            onChange={(v) => setSettings({ ...settings, maxConcurrentRuns: v })}
          />
        </div>
      </div>

      {/* Evidence & Retention */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Evidence & Retention</h3>
        <p className="mt-1 text-xs text-gray-500">Control data collection limits and artifact lifecycle.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="Max Evidence Items/Run"
            value={settings.maxEvidenceItemsPerRun}
            min={1} max={100000}
            onChange={(v) => setSettings({ ...settings, maxEvidenceItemsPerRun: v })}
          />
          <NumberField
            label="Max Content Scan Bytes"
            value={settings.maxContentScanBytes}
            min={1024} max={10000000}
            onChange={(v) => setSettings({ ...settings, maxContentScanBytes: v })}
          />
          <NumberField
            label="Artifact Retention (Days)"
            value={settings.artifactRetentionDays}
            min={1} max={3650}
            onChange={(v) => setSettings({ ...settings, artifactRetentionDays: v })}
          />
          <NumberField
            label="Due Soon Window (Days)"
            value={settings.dueSoonWindowDays}
            min={1} max={365}
            onChange={(v) => setSettings({ ...settings, dueSoonWindowDays: v })}
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

/* ── Shared Form Components ───────────────────────────────────────────── */

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-brand-600" : "bg-gray-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}
