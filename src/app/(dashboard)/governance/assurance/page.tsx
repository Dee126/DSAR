"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

type Tab = "audit" | "access" | "sod" | "retention" | "deletion";

interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string | null;
  action: string;
  actorUserId: string | null;
  actorType: string;
  timestamp: string;
  hash: string;
  prevHash: string | null;
  actor?: { name: string; email: string } | null;
}

interface AccessLogEntry {
  id: string;
  userId: string | null;
  accessType: string;
  resourceType: string;
  resourceId: string;
  caseId: string | null;
  timestamp: string;
  outcome: string;
  reason: string | null;
  user?: { name: string; email: string } | null;
}

interface SodRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface SodPolicy {
  id: string;
  enabled: boolean;
  rulesJson: SodRule[];
}

interface RetentionPolicy {
  id: string;
  artifactType: string;
  retentionDays: number;
  deleteMode: string;
  legalHoldRespects: boolean;
  enabled: boolean;
}

interface DeletionJob {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  summaryJson: { totalEvaluated: number; totalDeleted: number; totalBlocked: number; errors: string[] } | null;
  triggeredBy: string;
  triggeredUser?: { name: string } | null;
  _count?: { events: number };
}

interface DeletionEvent {
  id: string;
  artifactType: string;
  artifactId: string;
  caseId: string | null;
  deletedAt: string;
  deletionMethod: string;
  proofHash: string;
  legalHoldBlocked: boolean;
  reason: string | null;
}

interface ApprovalEntry {
  id: string;
  scopeType: string;
  scopeId: string;
  status: string;
  reason: string | null;
  requestedAt: string;
  approvedAt: string | null;
  requester?: { name: string; email: string } | null;
  approver?: { name: string; email: string } | null;
}

export default function AssurancePage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("audit");

  // Audit trail state
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditFilter, setAuditFilter] = useState({ entityType: "", action: "" });
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; totalEntries: number; error?: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Access logs state
  const [accessLogs, setAccessLogs] = useState<AccessLogEntry[]>([]);
  const [accessTotal, setAccessTotal] = useState(0);
  const [accessFilter, setAccessFilter] = useState({ resourceType: "", outcome: "" });

  // SoD state
  const [sodPolicy, setSodPolicy] = useState<SodPolicy | null>(null);
  const [sodSaving, setSodSaving] = useState(false);

  // Retention state
  const [retentionPolicies, setRetentionPolicies] = useState<RetentionPolicy[]>([]);
  const [runningJob, setRunningJob] = useState(false);
  const [jobResult, setJobResult] = useState<{ status: string; totalDeleted: number; totalBlocked: number } | null>(null);

  // Deletion state
  const [deletionJobs, setDeletionJobs] = useState<DeletionJob[]>([]);
  const [deletionEvents, setDeletionEvents] = useState<DeletionEvent[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Approvals state
  const [approvals, setApprovals] = useState<ApprovalEntry[]>([]);

  const role = session?.user?.role;
  const canManage = role === "SUPER_ADMIN" || role === "TENANT_ADMIN";
  const canVerify = canManage || role === "DPO" || role === "AUDITOR";
  const canRunRetention = canManage;

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async () => {
    const params = new URLSearchParams();
    if (auditFilter.entityType) params.set("entityType", auditFilter.entityType);
    if (auditFilter.action) params.set("action", auditFilter.action);
    params.set("limit", "50");
    const res = await fetch(`/api/assurance/audit-trail?${params}`);
    if (res.ok) {
      const data = await res.json();
      setAuditLogs(data.items);
      setAuditTotal(data.total);
    }
  }, [auditFilter]);

  // Fetch access logs
  const fetchAccessLogs = useCallback(async () => {
    const params = new URLSearchParams();
    if (accessFilter.resourceType) params.set("resourceType", accessFilter.resourceType);
    if (accessFilter.outcome) params.set("outcome", accessFilter.outcome);
    params.set("limit", "50");
    const res = await fetch(`/api/assurance/access-logs?${params}`);
    if (res.ok) {
      const data = await res.json();
      setAccessLogs(data.items);
      setAccessTotal(data.total);
    }
  }, [accessFilter]);

  // Fetch SoD policy
  const fetchSodPolicy = useCallback(async () => {
    const res = await fetch("/api/assurance/sod");
    if (res.ok) setSodPolicy(await res.json());
  }, []);

  // Fetch retention policies
  const fetchRetentionPolicies = useCallback(async () => {
    const res = await fetch("/api/assurance/retention");
    if (res.ok) setRetentionPolicies(await res.json());
  }, []);

  // Fetch deletion jobs
  const fetchDeletionJobs = useCallback(async () => {
    const res = await fetch("/api/assurance/deletion-jobs?limit=20");
    if (res.ok) {
      const data = await res.json();
      setDeletionJobs(data.items);
    }
  }, []);

  // Fetch deletion events for a job
  const fetchDeletionEvents = useCallback(async (jobId: string) => {
    const res = await fetch(`/api/assurance/deletion-events?jobId=${jobId}&limit=100`);
    if (res.ok) {
      const data = await res.json();
      setDeletionEvents(data.items);
    }
  }, []);

  // Fetch approvals
  const fetchApprovals = useCallback(async () => {
    const res = await fetch("/api/assurance/approvals?limit=50");
    if (res.ok) {
      const data = await res.json();
      setApprovals(data.items);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "audit") fetchAuditLogs();
    if (activeTab === "access") fetchAccessLogs();
    if (activeTab === "sod") { fetchSodPolicy(); fetchApprovals(); }
    if (activeTab === "retention") fetchRetentionPolicies();
    if (activeTab === "deletion") fetchDeletionJobs();
  }, [activeTab, fetchAuditLogs, fetchAccessLogs, fetchSodPolicy, fetchRetentionPolicies, fetchDeletionJobs, fetchApprovals]);

  // Verify integrity
  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    const res = await fetch("/api/assurance/verify", { method: "POST" });
    if (res.ok) setVerifyResult(await res.json());
    setVerifying(false);
  };

  // Toggle SoD
  const handleToggleSod = async () => {
    if (!sodPolicy) return;
    setSodSaving(true);
    await fetch("/api/assurance/sod", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !sodPolicy.enabled }),
    });
    await fetchSodPolicy();
    setSodSaving(false);
  };

  // Toggle SoD rule
  const handleToggleRule = async (ruleId: string) => {
    if (!sodPolicy) return;
    const updatedRules = (sodPolicy.rulesJson as SodRule[]).map(r =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    setSodSaving(true);
    await fetch("/api/assurance/sod", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules: updatedRules }),
    });
    await fetchSodPolicy();
    setSodSaving(false);
  };

  // Run retention job
  const handleRunRetention = async () => {
    setRunningJob(true);
    setJobResult(null);
    const res = await fetch("/api/jobs/retention", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setJobResult({ status: data.status, totalDeleted: data.totalDeleted, totalBlocked: data.totalBlocked });
    }
    setRunningJob(false);
  };

  // Export deletion CSV
  const handleExportCSV = async (jobId?: string) => {
    const url = jobId
      ? `/api/assurance/deletion-events?format=csv&jobId=${jobId}`
      : "/api/assurance/deletion-events?format=csv";
    const res = await fetch(url);
    if (res.ok) {
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `deletion-proof-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    }
  };

  // Decide approval
  const handleDecideApproval = async (approvalId: string, decision: "APPROVED" | "REJECTED") => {
    await fetch(`/api/assurance/approvals/${approvalId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    await fetchApprovals();
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "audit", label: "Audit Trail" },
    { key: "access", label: "Access Logs" },
    { key: "sod", label: "SoD Policies" },
    { key: "retention", label: "Retention Policies" },
    { key: "deletion", label: "Deletion Proof" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assurance Layer</h1>
        <p className="mt-1 text-sm text-gray-500">
          ISO/SOC2-grade controls: audit trail integrity, access logging, separation of duties, retention policies, and deletion proof.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${
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
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Filter by entity type..."
              value={auditFilter.entityType}
              onChange={e => setAuditFilter(f => ({ ...f, entityType: e.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Filter by action..."
              value={auditFilter.action}
              onChange={e => setAuditFilter(f => ({ ...f, action: e.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={fetchAuditLogs}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
            >
              Search
            </button>
            {canVerify && (
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              >
                {verifying ? "Verifying..." : "Verify Integrity"}
              </button>
            )}
          </div>

          {verifyResult && (
            <div className={`rounded-md p-4 ${verifyResult.valid ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              <p className="font-medium">
                {verifyResult.valid ? "Chain integrity verified" : "Integrity violation detected"}
              </p>
              <p className="text-sm mt-1">{verifyResult.totalEntries} entries checked.</p>
              {verifyResult.error && <p className="text-sm mt-1">{verifyResult.error}</p>}
            </div>
          )}

          <p className="text-sm text-gray-500">{auditTotal} total entries</p>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {auditLogs.map(entry => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{new Date(entry.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">{entry.action}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.entityType}{entry.entityId ? `:${entry.entityId.slice(0, 8)}` : ""}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.actor?.name || entry.actorType}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-400">{entry.hash.slice(0, 12)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "access" && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <select
              value={accessFilter.resourceType}
              onChange={e => setAccessFilter(f => ({ ...f, resourceType: e.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All resource types</option>
              <option value="IDV_ARTIFACT">IDV Artifact</option>
              <option value="DOCUMENT">Document</option>
              <option value="RESPONSE_DOC">Response Doc</option>
              <option value="DELIVERY_PACKAGE">Delivery Package</option>
              <option value="VENDOR_ARTIFACT">Vendor Artifact</option>
              <option value="EXPORT_ARTIFACT">Export</option>
              <option value="EVIDENCE">Evidence</option>
            </select>
            <select
              value={accessFilter.outcome}
              onChange={e => setAccessFilter(f => ({ ...f, outcome: e.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All outcomes</option>
              <option value="ALLOWED">Allowed</option>
              <option value="DENIED">Denied</option>
            </select>
            <button
              onClick={fetchAccessLogs}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
            >
              Search
            </button>
          </div>

          <p className="text-sm text-gray-500">{accessTotal} total entries</p>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outcome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {accessLogs.map(entry => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{new Date(entry.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.accessType}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.resourceType}:{entry.resourceId.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.user?.name || "Public"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.outcome === "ALLOWED" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}>{entry.outcome}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{entry.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "sod" && (
        <div className="space-y-6">
          {sodPolicy && (
            <>
              <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm border border-gray-200">
                <div>
                  <h3 className="font-medium text-gray-900">Separation of Duties</h3>
                  <p className="text-sm text-gray-500">4-Augen-Prinzip for critical actions</p>
                </div>
                {canManage && (
                  <button
                    onClick={handleToggleSod}
                    disabled={sodSaving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      sodPolicy.enabled ? "bg-brand-600" : "bg-gray-300"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      sodPolicy.enabled ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {(sodPolicy.rulesJson as SodRule[]).map(rule => (
                  <div key={rule.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{rule.name}</h4>
                        <p className="mt-1 text-sm text-gray-500">{rule.description}</p>
                      </div>
                      {canManage && (
                        <button
                          onClick={() => handleToggleRule(rule.id)}
                          disabled={sodSaving || !sodPolicy.enabled}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            rule.enabled && sodPolicy.enabled ? "bg-brand-600" : "bg-gray-300"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            rule.enabled && sodPolicy.enabled ? "translate-x-6" : "translate-x-1"
                          }`} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pending Approvals */}
              {approvals.filter(a => a.status === "PENDING").length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900">Pending Approvals</h3>
                  {approvals.filter(a => a.status === "PENDING").map(approval => (
                    <div key={approval.id} className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-yellow-800">{approval.scopeType} - {approval.scopeId.slice(0, 8)}</p>
                          <p className="text-sm text-yellow-600">{approval.reason}</p>
                          <p className="text-xs text-yellow-500 mt-1">Requested by: {approval.requester?.name} at {new Date(approval.requestedAt).toLocaleString()}</p>
                        </div>
                        {canVerify && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDecideApproval(approval.id, "APPROVED")}
                              className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDecideApproval(approval.id, "REJECTED")}
                              className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "retention" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Retention Policies</h3>
            {canRunRetention && (
              <button
                onClick={handleRunRetention}
                disabled={runningJob}
                className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {runningJob ? "Running..." : "Run Retention Job Now"}
              </button>
            )}
          </div>

          {jobResult && (
            <div className={`rounded-md p-4 ${jobResult.status === "SUCCESS" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              <p className="font-medium">{jobResult.status}: {jobResult.totalDeleted} deleted, {jobResult.totalBlocked} blocked by legal hold</p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Artifact Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retention (days)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delete Mode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Legal Hold</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enabled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {retentionPolicies.map(policy => (
                  <tr key={policy.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{policy.artifactType.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{policy.retentionDays}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        policy.deleteMode === "HARD_DELETE" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                      }`}>{policy.deleteMode.replace("_", " ")}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{policy.legalHoldRespects ? "Respects" : "Ignores"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        policy.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                      }`}>{policy.enabled ? "Active" : "Disabled"}</span>
                    </td>
                  </tr>
                ))}
                {retentionPolicies.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                      No retention policies configured. Seed data or create policies via API.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "deletion" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Deletion Jobs & Proof</h3>
            <button
              onClick={() => handleExportCSV(selectedJobId || undefined)}
              className="rounded-md bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-700"
            >
              Export CSV
            </button>
          </div>

          {/* Deletion Jobs */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trigger</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Summary</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Events</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {deletionJobs.map(job => (
                  <tr key={job.id} className={selectedJobId === job.id ? "bg-blue-50" : ""}>
                    <td className="px-4 py-3 text-sm text-gray-900">{new Date(job.startedAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        job.status === "SUCCESS" ? "bg-green-100 text-green-800" :
                        job.status === "FAILED" ? "bg-red-100 text-red-800" :
                        "bg-yellow-100 text-yellow-800"
                      }`}>{job.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{job.triggeredBy}{job.triggeredUser ? ` (${job.triggeredUser.name})` : ""}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {job.summaryJson
                        ? `${job.summaryJson.totalDeleted} deleted, ${job.summaryJson.totalBlocked} blocked`
                        : "-"
                      }
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{job._count?.events || 0}</td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => { setSelectedJobId(job.id); fetchDeletionEvents(job.id); }}
                        className="text-brand-600 hover:text-brand-800 text-xs font-medium"
                      >
                        View Events
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Deletion Events */}
          {selectedJobId && deletionEvents.length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">Deletion Events for Job {selectedJobId.slice(0, 8)}...</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deleted At</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Artifact</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Legal Hold</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proof Hash</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {deletionEvents.map(event => (
                      <tr key={event.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{new Date(event.deletedAt).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{event.artifactType}:{event.artifactId.slice(0, 8)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{event.deletionMethod}</td>
                        <td className="px-4 py-3 text-sm">
                          {event.legalHoldBlocked
                            ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">BLOCKED</span>
                            : <span className="text-gray-400">-</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-400">{event.proofHash.slice(0, 16)}...</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{event.reason || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
