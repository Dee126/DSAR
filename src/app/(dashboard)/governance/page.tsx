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

const EXPORT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NONE: { label: "None", color: "text-gray-400" },
  BLOCKED: { label: "Blocked", color: "bg-red-100 text-red-700" },
  PENDING: { label: "Pending approval", color: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-700" },
  GENERATED: { label: "Generated", color: "bg-blue-100 text-blue-700" },
};

const DEFAULT_SETTINGS: GovernanceSettings = {
  copilotEnabled: true,
  allowedProviderPhases: [1],
  defaultExecutionMode: "METADATA_ONLY",
  allowContentScanning: false,
  allowOcr: false,
  allowLlmSummaries: false,
  maxRunsPerDayTenant: 200,
  maxRunsPerDayUser: 20,
  maxEvidenceItemsPerRun: 5000,
  maxContentScanBytes: 5000000,
  maxConcurrentRuns: 5,
  dueSoonWindowDays: 7,
  artifactRetentionDays: 30,
  twoPersonApprovalForExport: false,
  requireJustification: true,
  requireConfirmation: true,
};

function getExportStatus(entry: ActivityLogEntry): string {
  if (entry.exportGenerated) return "GENERATED";
  if (entry.legalApprovalStatus === "APPROVED" && !entry.exportGenerated) return "APPROVED";
  if (entry.legalApprovalStatus === "PENDING") return "PENDING";
  if (entry.art9Suspected && entry.legalApprovalStatus !== "APPROVED") return "BLOCKED";
  return "NONE";
}

/* ── Page Component ───────────────────────────────────────────────────── */

export default function GovernancePage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";
  const isAdmin = ADMIN_ROLES.includes(userRole);

  const [activeTab, setActiveTab] = useState<"activity" | "approvals" | "settings">("activity");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Copilot Governance</h1>
        <p className="mt-1 text-sm text-gray-500">
          Control access, scope, retention, and approvals for Privacy Copilot. All actions are audited.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 overflow-x-auto sm:space-x-8">
          {[
            { key: "activity" as const, label: "Activity" },
            { key: "approvals" as const, label: "Approvals" },
            { key: "settings" as const, label: "Settings" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${
                activeTab === tab.key
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "activity" && <ActivityLogTab isAdmin={isAdmin} />}
      {activeTab === "approvals" && <ApprovalsTab />}
      {activeTab === "settings" && <SettingsTab isAdmin={isAdmin} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ *
 * Tab 1: Activity Log (Copilot Activity Report)
 * ═══════════════════════════════════════════════════════════════════════ */

function ActivityLogTab({ isAdmin }: { isAdmin: boolean }) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [summary, setSummary] = useState<ActivityLogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [specialCatOnly, setSpecialCatOnly] = useState(false);
  const [exportsOnly, setExportsOnly] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Export
  const [exporting, setExporting] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState<"csv" | "json" | null>(null);

  // Drawer
  const [selectedEntry, setSelectedEntry] = useState<ActivityLogEntry | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (specialCatOnly) params.set("containsSpecialCategory", "true");
      if (exportsOnly) params.set("exportCreated", "true");
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);

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
  }, [page, statusFilter, specialCatOnly, exportsOnly, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Client-side search (case number or subject)
  const filtered = searchQuery.trim()
    ? entries.filter(
        (e) =>
          e.caseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.subjectIdentifier.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : entries;

  async function handleExport(format: "csv" | "json") {
    setExporting(true);
    setShowExportConfirm(null);
    try {
      const res = await fetch(`/api/governance/report-export?format=${format}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `governance-report-${new Date().toISOString().split("T")[0]}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      /* silently fail */
    } finally {
      setExporting(false);
    }
  }

  // Derived anomaly count
  const anomalyCount = summary ? summary.failedRuns : 0;
  const policyBlocks = summary ? summary.failedRuns : 0;

  return (
    <div className="space-y-6">
      {/* Anomaly banner */}
      {anomalyCount > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">Anomalous usage detected</h3>
              <p className="mt-1 text-sm text-amber-700">{anomalyCount} blocked or failed run(s) in this period. Review runs below for details.</p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Summary Strip */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="card py-3">
            <p className="text-xs font-medium text-gray-500">Total Runs</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{summary.totalRuns}</p>
          </div>
          <div className="card py-3">
            <p className="text-xs font-medium text-gray-500">Special Category</p>
            <p className="mt-1 text-xl font-bold text-red-600">{summary.art9DetectedRuns}</p>
          </div>
          <div className="card py-3">
            <p className="text-xs font-medium text-gray-500">Exports</p>
            <p className="mt-1 text-xl font-bold text-blue-600">{summary.totalExports}</p>
          </div>
          <div className="card py-3">
            <p className="text-xs font-medium text-gray-500">Policy Blocks</p>
            <p className="mt-1 text-xl font-bold text-amber-600">{policyBlocks}</p>
          </div>
          <div className="card py-3">
            <p className="text-xs font-medium text-gray-500">Anomalies</p>
            <p className="mt-1 text-xl font-bold text-purple-600">{anomalyCount}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2 sm:gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500">From</label>
          <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className="mt-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">To</label>
          <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            className="mt-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">Outcome</label>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
            <option value="">All</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="BLOCKED">Blocked</option>
            <option value="RUNNING">Running</option>
          </select>
        </div>

        <label className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm">
          <input type="checkbox" checked={specialCatOnly} onChange={(e) => { setSpecialCatOnly(e.target.checked); setPage(1); }}
            className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
          <span className="text-gray-700">Special category only</span>
        </label>

        <label className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm">
          <input type="checkbox" checked={exportsOnly} onChange={(e) => { setExportsOnly(e.target.checked); setPage(1); }}
            className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
          <span className="text-gray-700">Exports only</span>
        </label>

        <div className="relative">
          <label className="block text-xs font-medium text-gray-500">Search</label>
          <input type="text" placeholder="Case or subject..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-44" />
        </div>

        <div className="flex-1" />

        {isAdmin && (
          <div className="relative">
            <button onClick={() => setShowExportConfirm(showExportConfirm ? null : "csv")} disabled={exporting}
              className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export Report
            </button>
            {showExportConfirm && (
              <div className="absolute right-0 top-full z-10 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                <p className="text-sm text-gray-700">Report contains masked identifiers only. Continue?</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => handleExport("csv")} className="btn-primary text-xs">CSV</button>
                  <button onClick={() => handleExport("json")} className="btn-primary text-xs">JSON</button>
                  <button onClick={() => setShowExportConfirm(null)} className="btn-secondary text-xs">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500">No activity log entries found.</p>
            <p className="mt-1 text-xs text-gray-400">Copilot run activity will appear here automatically.</p>
          </div>
        ) : (
          <>
          {/* Desktop: Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Case</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Providers</th>
                  <th className="px-4 py-3">Evidence</th>
                  <th className="px-4 py-3">Special Cat.</th>
                  <th className="px-4 py-3">Export</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((entry) => {
                  const exportStatus = getExportStatus(entry);
                  const ex = EXPORT_STATUS_LABELS[exportStatus] ?? EXPORT_STATUS_LABELS.NONE;
                  return (
                    <tr key={entry.runId} className="cursor-pointer text-sm hover:bg-gray-50" onClick={() => setSelectedEntry(entry)}>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                        {entry.startedAt ? new Date(entry.startedAt).toLocaleString() : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">{entry.actorName}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-brand-600">{entry.caseNumber}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500">
                        <span className="text-gray-400">{entry.subjectIdentifierType}: </span>{entry.subjectIdentifier}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                        {entry.systemsSearched.length > 0 ? entry.systemsSearched.slice(0, 2).join(", ") + (entry.systemsSearched.length > 2 ? ` +${entry.systemsSearched.length - 2}` : "") : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">{entry.totalEvidenceItems}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {entry.art9Suspected
                          ? <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Art. 9</span>
                          : <span className="text-xs text-gray-400">-</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {exportStatus === "NONE"
                          ? <span className="text-xs text-gray-400">-</span>
                          : <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ex.color}`}>{ex.label}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedEntry(entry); }}
                          className="text-xs font-medium text-brand-600 hover:text-brand-700">View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: Card List */}
          <div className="divide-y divide-gray-200 md:hidden">
            {filtered.map((entry) => {
              const exportStatus = getExportStatus(entry);
              const ex = EXPORT_STATUS_LABELS[exportStatus] ?? EXPORT_STATUS_LABELS.NONE;
              return (
                <button
                  key={entry.runId}
                  onClick={() => setSelectedEntry(entry)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-brand-600">{entry.caseNumber}</span>
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[entry.status] ?? "bg-gray-100 text-gray-600"}`}>{entry.status}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500">{entry.actorName} &middot; {entry.subjectIdentifier}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-gray-400">{entry.totalEvidenceItems} evidence</span>
                      {entry.art9Suspected && <span className="inline-flex rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">Art. 9</span>}
                      {exportStatus !== "NONE" && <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ex.color}`}>{ex.label}</span>}
                    </div>
                    <p className="mt-0.5 text-[10px] text-gray-400">
                      {entry.startedAt ? new Date(entry.startedAt).toLocaleDateString() : "-"}
                    </p>
                  </div>
                  <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              );
            })}
          </div>
          </>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Prev</button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedEntry && (
        <RunDetailDrawer entry={selectedEntry} isAdmin={isAdmin} onClose={() => setSelectedEntry(null)} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ *
 * Detail Drawer (right-side sliding panel)
 * ═══════════════════════════════════════════════════════════════════════ */

function RunDetailDrawer({ entry, isAdmin, onClose }: { entry: ActivityLogEntry; isAdmin: boolean; onClose: () => void }) {
  const [drawerTab, setDrawerTab] = useState<"overview" | "approvals" | "audit">("overview");
  const [showFullJustification, setShowFullJustification] = useState(false);

  // Simulated audit timeline for this run
  const auditEvents = [
    { action: "Run created", time: entry.startedAt, icon: "create" },
    ...(entry.startedAt ? [{ action: "Discovery started", time: entry.startedAt, icon: "start" }] : []),
    ...(entry.art9Suspected ? [{ action: "Art. 9 special category detected", time: entry.completedAt, icon: "warning" }] : []),
    ...(entry.exportGenerated ? [{ action: "Export generated", time: entry.completedAt, icon: "export" }] : []),
    ...(entry.completedAt ? [{ action: `Run ${entry.status.toLowerCase()}`, time: entry.completedAt, icon: "complete" }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 flex h-full w-full flex-col bg-white shadow-xl md:max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Run Details</h3>
            <p className="text-xs text-gray-500">
              {entry.caseNumber} &middot; <span className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[entry.status] ?? "bg-gray-100 text-gray-600"}`}>{entry.status}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="border-b border-gray-200 px-6">
          <nav className="-mb-px flex gap-6">
            {(["overview", "approvals", "audit"] as const).map((t) => (
              <button key={t} onClick={() => setDrawerTab(t)}
                className={`border-b-2 py-2.5 text-xs font-medium capitalize ${
                  drawerTab === t ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}>
                {t}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {drawerTab === "overview" && (
            <div className="space-y-4">
              <dl className="space-y-3 text-sm">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><dt className="shrink-0 font-medium text-gray-500">Run ID</dt><dd className="truncate font-mono text-xs text-gray-700">{entry.runId}</dd></div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><dt className="shrink-0 font-medium text-gray-500">Case</dt><dd className="font-medium text-brand-600">{entry.caseNumber}</dd></div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><dt className="shrink-0 font-medium text-gray-500">User</dt><dd className="text-gray-700">{entry.actorName} <span className="text-xs text-gray-400">({entry.actorRole})</span></dd></div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><dt className="shrink-0 font-medium text-gray-500">Status</dt><dd><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[entry.status] ?? "bg-gray-100"}`}>{entry.status}</span></dd></div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><dt className="shrink-0 font-medium text-gray-500">Started</dt><dd className="text-gray-700">{entry.startedAt ? new Date(entry.startedAt).toLocaleString() : "-"}</dd></div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><dt className="shrink-0 font-medium text-gray-500">Completed</dt><dd className="text-gray-700">{entry.completedAt ? new Date(entry.completedAt).toLocaleString() : "-"}</dd></div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><dt className="shrink-0 font-medium text-gray-500">Evidence</dt><dd className="text-gray-700">{entry.totalEvidenceItems} items, {entry.totalFindings} findings</dd></div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><dt className="shrink-0 font-medium text-gray-500">Content scan</dt><dd className="text-gray-700">{entry.contentScanningUsed ? "Yes" : "No"}</dd></div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><dt className="shrink-0 font-medium text-gray-500">OCR</dt><dd className="text-gray-700">{entry.ocrUsed ? "Yes" : "No"}</dd></div>
              </dl>

              {/* Subject */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500">Subject (masked)</p>
                <p className="mt-1 font-mono text-sm text-gray-700">{entry.subjectIdentifierType}: {entry.subjectIdentifier}</p>
              </div>

              {/* Justification */}
              <div>
                <p className="text-xs font-medium text-gray-500">Justification</p>
                <p className="mt-1 text-sm text-gray-700">
                  {showFullJustification || isAdmin
                    ? entry.justification
                    : entry.justification.length > 80
                      ? entry.justification.slice(0, 80) + "..."
                      : entry.justification}
                </p>
                {!isAdmin && entry.justification.length > 80 && (
                  <button onClick={() => setShowFullJustification(!showFullJustification)}
                    className="mt-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                    {showFullJustification ? "Show less" : "Show full (DPO/Admin only)"}
                  </button>
                )}
              </div>

              {/* Providers */}
              <div>
                <p className="text-xs font-medium text-gray-500">Providers searched</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {entry.systemsSearched.length > 0
                    ? entry.systemsSearched.map((s) => (
                        <span key={s} className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{s}</span>
                      ))
                    : <span className="text-xs text-gray-400">None</span>}
                </div>
              </div>

              {/* Special categories */}
              {entry.art9Suspected && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-medium text-red-700">Art. 9 special categories detected</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {entry.specialCategories.map((c) => (
                      <span key={c} className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {drawerTab === "approvals" && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Legal Approval Status</p>
                <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  entry.legalApprovalStatus === "APPROVED" ? "bg-green-100 text-green-700"
                    : entry.legalApprovalStatus === "REJECTED" ? "bg-red-100 text-red-700"
                      : entry.legalApprovalStatus === "NOT_REQUIRED" ? "bg-gray-100 text-gray-600"
                        : "bg-yellow-100 text-yellow-700"
                }`}>{entry.legalApprovalStatus}</span>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Export Status</p>
                {(() => {
                  const status = getExportStatus(entry);
                  const ex = EXPORT_STATUS_LABELS[status];
                  return status === "NONE"
                    ? <span className="mt-1 text-xs text-gray-400">No export requested</span>
                    : <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ex.color}`}>{ex.label}</span>;
                })()}
              </div>

              {entry.exportApprovedBy && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Approved by</p>
                  <p className="mt-1 text-sm text-gray-700">{entry.exportApprovedBy}</p>
                </div>
              )}

              {!entry.art9Suspected && !entry.exportGenerated && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-sm text-gray-500">No approvals required for this run.</p>
                </div>
              )}
            </div>
          )}

          {drawerTab === "audit" && (
            <div className="space-y-0">
              {auditEvents.map((event, idx) => (
                <div key={idx} className="relative flex gap-3 pb-6">
                  {idx < auditEvents.length - 1 && <div className="absolute left-[11px] top-6 h-full w-px bg-gray-200" />}
                  <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100">
                    <div className="h-2 w-2 rounded-full bg-brand-600" />
                  </div>
                  <div className="pt-0.5">
                    <p className="text-sm text-gray-900">{event.action}</p>
                    <p className="text-xs text-gray-400">{event.time ? new Date(event.time).toLocaleString() : "-"}</p>
                  </div>
                </div>
              ))}
              {auditEvents.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-400">No audit events.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ *
 * Tab 2: Approvals (unchanged)
 * ═══════════════════════════════════════════════════════════════════════ */

function ApprovalsTab() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { fetchApprovals(); }, []);

  async function fetchApprovals() {
    setLoading(true);
    try {
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
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>}

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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      approval.type === "ART9_LEGAL_REVIEW" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {approval.type === "ART9_LEGAL_REVIEW" ? "Art. 9 Legal Review" : "Export Approval"}
                    </span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${APPROVAL_STATUS_COLORS[approval.status]}`}>
                      {approval.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">Run: <span className="font-mono text-xs">{approval.runId}</span></p>
                  <p className="text-sm text-gray-500">Requested: {new Date(approval.requestedAt).toLocaleString()}</p>
                  {approval.approvals.length > 0 && (
                    <div className="mt-2 text-xs text-gray-400">{approval.approvals.length} approval(s) received</div>
                  )}
                </div>

                {approval.status === "PENDING" && (
                  <div className="flex flex-col gap-2">
                    {selectedRunId === approval.runId ? (
                      <div className="space-y-2">
                        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (required)"
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-48" rows={2} />
                        <div className="flex gap-2">
                          <button onClick={() => handleApprovalAction(approval.runId, approval.type, "APPROVE")}
                            disabled={actionLoading === approval.runId}
                            className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">Approve</button>
                          <button onClick={() => handleApprovalAction(approval.runId, approval.type, "REJECT")}
                            disabled={actionLoading === approval.runId}
                            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">Reject</button>
                          <button onClick={() => { setSelectedRunId(null); setComment(""); }}
                            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setSelectedRunId(approval.runId)}
                        className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">Review</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {approvals.filter((a) => a.status !== "PENDING").length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Resolved</h3>
          <div className="space-y-2">
            {approvals.filter((a) => a.status !== "PENDING").map((approval) => (
              <div key={`${approval.runId}-${approval.type}-hist`} className="card bg-gray-50 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${APPROVAL_STATUS_COLORS[approval.status]}`}>{approval.status}</span>
                    <span className="text-xs text-gray-500">{approval.type === "ART9_LEGAL_REVIEW" ? "Art. 9 Legal Review" : "Export Approval"}</span>
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

/* ═══════════════════════════════════════════════════════════════════════ *
 * Tab 3: Settings (Sections A–F per wireframe)
 * ═══════════════════════════════════════════════════════════════════════ */

const PROVIDER_PHASES = [
  { phase: 1, label: "Phase 1", providers: ["M365 Directory", "Exchange", "SharePoint", "OneDrive"] },
  { phase: 2, label: "Phase 2", providers: ["Google Workspace", "Salesforce", "ServiceNow"] },
  { phase: 3, label: "Phase 3", providers: ["Atlassian", "HR Systems"] },
  { phase: 4, label: "Phase 4", providers: ["AWS", "Azure", "GCP"] },
];

function SettingsTab({ isAdmin }: { isAdmin: boolean }) {
  const [settings, setSettings] = useState<GovernanceSettings | null>(null);
  const [maskIdentifiers, setMaskIdentifiers] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/governance/settings");
        if (res.ok) setSettings(await res.json());
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
        setSuccess("Governance settings updated. Changes are recorded in the audit trail.");
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

  function handleReset() {
    setSettings({ ...DEFAULT_SETTINGS });
    setSuccess("");
    setError("");
  }

  function togglePhase(phase: number) {
    if (!settings) return;
    const current = settings.allowedProviderPhases;
    const next = current.includes(phase)
      ? current.filter((p) => p !== phase)
      : [...current, phase].sort();
    setSettings({ ...settings, allowedProviderPhases: next });
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  // Non-admin banner
  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <svg className="mx-auto h-10 w-10 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <p className="mt-3 text-sm font-medium text-amber-800">You do not have permission to change governance settings.</p>
        <p className="mt-1 text-xs text-amber-600">Only DPO, Tenant Admin, or Super Admin can modify these controls.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      {/* Section A: Status & Defaults */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Status & Defaults</h3>
        <div className="mt-4 space-y-4">
          <ToggleField label="Enable Copilot" description="Master switch: disable to prevent all Copilot operations tenant-wide."
            checked={settings.copilotEnabled} onChange={(v) => setSettings({ ...settings, copilotEnabled: v })} />
          <ToggleField label="Require justification for every run" description="Require a justification (min. 10 characters) before any Copilot run."
            checked={settings.requireJustification} onChange={(v) => setSettings({ ...settings, requireJustification: v })} />
          <div>
            <label className="block text-sm font-medium text-gray-700">Default execution mode</label>
            <select value={settings.defaultExecutionMode}
              onChange={(e) => setSettings({ ...settings, defaultExecutionMode: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
              <option value="METADATA_ONLY">Metadata-only (default)</option>
              <option value="CONTENT_SCAN" disabled={!settings.allowContentScanning}>Include content {!settings.allowContentScanning ? "(enable content scanning first)" : ""}</option>
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-400">Metadata-only is recommended for privacy-by-design.</p>
      </div>

      {/* Section B: Capabilities */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Capabilities</h3>
        <div className="mt-4 space-y-4">
          <ToggleField label="Allow content scanning" description="Allow DPO/Admin to enable content scanning per run."
            checked={settings.allowContentScanning}
            onChange={(v) => {
              const update: Partial<GovernanceSettings> = { allowContentScanning: v };
              if (!v) { update.allowOcr = false; update.defaultExecutionMode = "METADATA_ONLY"; }
              setSettings({ ...settings, ...update });
            }} />
          <ToggleField label="Allow OCR" description="Allow OCR processing of scanned documents."
            checked={settings.allowOcr} disabled={!settings.allowContentScanning}
            onChange={(v) => setSettings({ ...settings, allowOcr: v })} />
          <ToggleField label="Allow LLM summaries" description="Allow AI-generated summaries of findings."
            checked={settings.allowLlmSummaries} onChange={(v) => setSettings({ ...settings, allowLlmSummaries: v })} />
        </div>
        <p className="mt-3 text-xs text-gray-400">Content scanning and OCR increase sensitivity and should be limited to DPO/Admin.</p>
      </div>

      {/* Section C: Allowed Providers */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Allowed Providers</h3>
        <div className="mt-4 space-y-4">
          {PROVIDER_PHASES.map((group) => (
            <div key={group.phase}>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={settings.allowedProviderPhases.includes(group.phase)}
                  onChange={() => togglePhase(group.phase)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm font-medium text-gray-700">{group.label}</span>
              </label>
              <div className="ml-6 mt-1 flex flex-wrap gap-1.5">
                {group.providers.map((p) => (
                  <span key={p} className={`inline-flex rounded px-2 py-0.5 text-xs ${
                    settings.allowedProviderPhases.includes(group.phase) ? "bg-brand-50 text-brand-700" : "bg-gray-100 text-gray-400"
                  }`}>{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-400">Providers can be enabled once integrations are configured.</p>
      </div>

      {/* Section D: Limits & Abuse Prevention */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Limits & Abuse Prevention</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField label="Max runs per user per day" value={settings.maxRunsPerDayUser} min={1} max={1000}
            onChange={(v) => setSettings({ ...settings, maxRunsPerDayUser: v })} />
          <NumberField label="Max runs per tenant per day" value={settings.maxRunsPerDayTenant} min={1} max={10000}
            onChange={(v) => setSettings({ ...settings, maxRunsPerDayTenant: v })} />
          <NumberField label="Max evidence items per run" value={settings.maxEvidenceItemsPerRun} min={1} max={100000}
            onChange={(v) => setSettings({ ...settings, maxEvidenceItemsPerRun: v })} />
          <NumberField label="Max parallel runs per tenant" value={settings.maxConcurrentRuns} min={1} max={50}
            onChange={(v) => setSettings({ ...settings, maxConcurrentRuns: v })} />
        </div>
        <p className="mt-3 text-xs text-gray-400">Limits protect from abuse and stabilize performance.</p>
      </div>

      {/* Section E: Export Governance */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Export Governance</h3>
        <div className="mt-4 space-y-4">
          <ToggleField label="Exports require approval" description="Require confirmation before any data export."
            checked={settings.requireConfirmation} onChange={(v) => setSettings({ ...settings, requireConfirmation: v })} />
          <ToggleField label="Two-person approval for exports (Enterprise)" description="Require two distinct approvers for export operations (one must be DPO/Admin)."
            checked={settings.twoPersonApprovalForExport} onChange={(v) => setSettings({ ...settings, twoPersonApprovalForExport: v })} />
        </div>
        <p className="mt-3 text-xs text-gray-400">Recommended when special category data might be present.</p>
      </div>

      {/* Section F: Retention & Privacy */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Retention & Privacy</h3>
        <div className="mt-4 space-y-4">
          <NumberField label="Delete copilot artifacts X days after case close" value={settings.artifactRetentionDays} min={1} max={3650}
            onChange={(v) => setSettings({ ...settings, artifactRetentionDays: v })} />
          <ToggleField label="Mask subject identifiers in governance reports" description="Always mask PII in exported governance reports and activity logs."
            checked={maskIdentifiers} onChange={setMaskIdentifiers} />
        </div>
        <p className="mt-3 text-xs text-gray-400">Retention applies to evidence index, detector results, summaries, and exports (unless legal hold).</p>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-400">Changes are recorded in the audit trail.</p>
        <div className="flex gap-3">
          <button onClick={handleReset} className="btn-secondary flex-1 sm:flex-none">Reset Defaults</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 disabled:opacity-50 sm:flex-none">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ *
 * Shared Form Components
 * ═══════════════════════════════════════════════════════════════════════ */

function ToggleField({
  label, description, checked, onChange, disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 sm:items-center sm:justify-between ${disabled ? "opacity-50" : ""}`}>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-brand-600" : "bg-gray-200"
        } ${disabled ? "cursor-not-allowed" : ""}`}>
        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`} />
      </button>
    </div>
  );
}

function NumberField({
  label, value, min, max, onChange,
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
      <input type="number" value={value} min={min} max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
    </div>
  );
}
