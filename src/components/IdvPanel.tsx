"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ── Types ────────────────────────────────────────────────────────────── */

interface IdvArtifact {
  id: string;
  artifactType: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  consentGiven: boolean;
  retainUntil: string | null;
  createdAt: string;
  uploadedBy: string | null;
}

interface IdvCheck {
  id: string;
  method: string;
  passed: boolean | null;
  details: Record<string, unknown> | null;
  performedAt: string;
}

interface IdvDecision {
  id: string;
  outcome: string;
  rationale: string;
  decidedAt: string;
  reviewer: { id: string; name: string; email: string };
}

interface IdvFlag {
  flag: string;
  severity: string;
  detail: string;
}

interface FieldMismatch {
  field: string;
  expected: string;
  extracted: string;
  severity: string;
}

interface IdvAssessment {
  id: string;
  riskScore: number;
  flags: IdvFlag[];
  extractedFields: Record<string, string | undefined> | null;
  mismatches: FieldMismatch[];
  provider: string;
  createdAt: string;
}

interface IdvRequest {
  id: string;
  status: string;
  portalToken: string | null;
  allowedMethods: string[];
  submittedAt: string | null;
  submissionCount: number;
  maxSubmissions: number;
  expiresAt: string | null;
  artifacts: IdvArtifact[];
  checks: IdvCheck[];
  decisions: IdvDecision[];
  assessments: IdvAssessment[];
}

interface IdvData {
  case: { id: string; identityVerified: boolean; status: string };
  idvRequest: IdvRequest | null;
  settings: Record<string, unknown> | null;
}

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  LINK_SENT: "Verification Link Sent",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  NEED_MORE_INFO: "Need More Info",
};

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: "bg-gray-100 text-gray-700",
  LINK_SENT: "bg-blue-100 text-blue-700",
  SUBMITTED: "bg-yellow-100 text-yellow-700",
  IN_REVIEW: "bg-purple-100 text-purple-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  NEED_MORE_INFO: "bg-orange-100 text-orange-700",
};

const ARTIFACT_LABELS: Record<string, string> = {
  ID_FRONT: "ID Card (Front)",
  ID_BACK: "ID Card (Back)",
  PASSPORT: "Passport",
  DRIVERS_LICENSE: "Driver's License",
  UTILITY_BILL: "Utility Bill",
  SELFIE: "Selfie",
  OTHER_DOCUMENT: "Other Document",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "text-gray-600 bg-gray-50",
  medium: "text-yellow-700 bg-yellow-50",
  high: "text-red-700 bg-red-50",
  critical: "text-red-800 bg-red-100",
};

const DECIDE_ROLES = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO"];
const MANAGE_ROLES = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO", "CASE_MANAGER"];

/* ── Component ────────────────────────────────────────────────────────── */

export default function IdvPanel({ caseId, userRole }: { caseId: string; userRole?: string }) {
  const [data, setData] = useState<IdvData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState("");

  // Decision modal
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionOutcome, setDecisionOutcome] = useState<"APPROVED" | "REJECTED" | "NEED_MORE_INFO">("APPROVED");
  const [decisionRationale, setDecisionRationale] = useState("");

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState("ID_FRONT");
  const [uploadConsent, setUploadConsent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Portal link
  const [portalUrl, setPortalUrl] = useState("");

  const canDecide = DECIDE_ROLES.includes(userRole ?? "");
  const canManage = MANAGE_ROLES.includes(userRole ?? "");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/idv`);
      if (res.ok) {
        setData(await res.json());
      } else {
        const err = await res.json();
        setError(err.error ?? "Failed to load IDV data");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleAction(action: string) {
    setActionLoading(action);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/cases/${caseId}/idv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      if (res.ok) {
        if (action === "send_link" && result.portalUrl) {
          setPortalUrl(result.portalUrl);
          setSuccess("Verification link generated. Share the link with the data subject.");
        } else if (action === "init") {
          setSuccess("IDV request initialized.");
        } else if (action === "run_ai_review") {
          setSuccess(`AI review complete. Risk score: ${result.riskScore}/100`);
        }
        fetchData();
      } else {
        setError(result.error ?? "Action failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setActionLoading("");
    }
  }

  async function handleDecision() {
    if (!decisionRationale.trim()) return;
    setActionLoading("decision");
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/cases/${caseId}/idv`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: decisionOutcome, rationale: decisionRationale }),
      });
      if (res.ok) {
        setSuccess(`Identity verification ${decisionOutcome.toLowerCase().replace(/_/g, " ")}.`);
        setShowDecisionModal(false);
        setDecisionRationale("");
        fetchData();
      } else {
        const err = await res.json();
        setError(err.error ?? "Decision failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setActionLoading("");
    }
  }

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    if (uploadType === "SELFIE" && !uploadConsent) {
      setError("Biometric data (selfie) requires explicit consent");
      return;
    }

    setActionLoading("upload");
    setError("");
    setSuccess("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("artifactType", uploadType);
      formData.append("consentGiven", String(uploadConsent || uploadType !== "SELFIE"));

      const res = await fetch(`/api/cases/${caseId}/idv/artifacts`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setSuccess(`${ARTIFACT_LABELS[uploadType] ?? uploadType} uploaded successfully.`);
        setShowUploadModal(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchData();
      } else {
        const err = await res.json();
        setError(err.error ?? "Upload failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setActionLoading("");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const req = data?.idvRequest;
  const caseInfo = data?.case;
  const latestAssessment = req?.assessments?.[0];
  const latestDecision = req?.decisions?.[0];

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      {/* Status Header */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
              <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Identity Verification</h3>
              <div className="mt-1 flex items-center gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[req?.status ?? "NOT_STARTED"] ?? STATUS_COLORS.NOT_STARTED}`}>
                  {STATUS_LABELS[req?.status ?? "NOT_STARTED"] ?? req?.status}
                </span>
                {caseInfo?.identityVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {canManage && (
            <div className="flex flex-wrap gap-2">
              {!req && (
                <button onClick={() => handleAction("init")} disabled={!!actionLoading}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                  {actionLoading === "init" ? "Initializing..." : "Start IDV"}
                </button>
              )}
              {req && !["APPROVED", "REJECTED"].includes(req.status) && (
                <>
                  {!req.portalToken && (
                    <button onClick={() => handleAction("send_link")} disabled={!!actionLoading}
                      className="rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50">
                      {actionLoading === "send_link" ? "Generating..." : "Send Verification Link"}
                    </button>
                  )}
                  <button onClick={() => setShowUploadModal(true)} disabled={!!actionLoading}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    Upload Evidence
                  </button>
                  {req.artifacts.length > 0 && (
                    <button onClick={() => handleAction("run_ai_review")} disabled={!!actionLoading}
                      className="rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50">
                      {actionLoading === "run_ai_review" ? "Analyzing..." : "Run AI Review"}
                    </button>
                  )}
                  {canDecide && req.status !== "NOT_STARTED" && (
                    <button onClick={() => setShowDecisionModal(true)} disabled={!!actionLoading}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
                      Make Decision
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Portal Link */}
        {(portalUrl || req?.portalToken) && (
          <div className="mt-3 rounded-md bg-blue-50 p-3">
            <p className="text-xs font-medium text-blue-800">Portal Verification Link</p>
            <p className="mt-1 break-all font-mono text-xs text-blue-600">
              {portalUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/verify/${req?.portalToken}`}
            </p>
            {req?.expiresAt && (
              <p className="mt-1 text-[10px] text-blue-500">Expires: {new Date(req.expiresAt).toLocaleDateString()}</p>
            )}
          </div>
        )}
      </div>

      {/* AI Risk Assessment */}
      {latestAssessment && (
        <div className="card">
          <h4 className="text-sm font-semibold text-gray-900">AI Risk Assessment</h4>
          <div className="mt-3 flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold ${
              latestAssessment.riskScore <= 25 ? "bg-green-100 text-green-700" :
              latestAssessment.riskScore <= 50 ? "bg-yellow-100 text-yellow-700" :
              latestAssessment.riskScore <= 75 ? "bg-orange-100 text-orange-700" :
              "bg-red-100 text-red-700"
            }`}>
              {latestAssessment.riskScore}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Risk Score: {latestAssessment.riskScore}/100
              </p>
              <p className="text-xs text-gray-500">
                {latestAssessment.riskScore <= 25 ? "Low risk" :
                 latestAssessment.riskScore <= 50 ? "Moderate risk" :
                 latestAssessment.riskScore <= 75 ? "High risk" :
                 "Very high risk"} — Provider: {latestAssessment.provider}
              </p>
            </div>
          </div>

          {/* Extracted Fields */}
          {latestAssessment.extractedFields && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-600">Extracted Fields</p>
              <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(latestAssessment.extractedFields)
                  .filter(([, v]) => v)
                  .map(([key, value]) => (
                    <div key={key} className="rounded bg-gray-50 px-2 py-1">
                      <span className="text-[10px] text-gray-500">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      <p className="text-xs font-medium text-gray-900">{value}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Mismatches */}
          {latestAssessment.mismatches.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-red-600">Field Mismatches</p>
              <div className="mt-1 space-y-1">
                {latestAssessment.mismatches.map((m, i) => (
                  <div key={i} className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs">
                    <span className="font-medium capitalize text-red-700">{m.field}:</span>{" "}
                    <span className="text-red-600">Expected &quot;{m.expected}&quot; but extracted &quot;{m.extracted}&quot;</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flags */}
          {latestAssessment.flags.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-600">Flags ({latestAssessment.flags.length})</p>
              <div className="mt-1 space-y-1">
                {latestAssessment.flags.map((f, i) => (
                  <div key={i} className={`flex items-start gap-2 rounded px-3 py-2 text-xs ${SEVERITY_COLORS[f.severity] ?? SEVERITY_COLORS.low}`}>
                    <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase">{f.severity}</span>
                    <div>
                      <span className="font-medium">{f.flag.replace(/_/g, " ")}</span>
                      <p className="text-[11px] opacity-80">{f.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Evidence List */}
      {req && req.artifacts.length > 0 && (
        <div className="card">
          <h4 className="text-sm font-semibold text-gray-900">Evidence ({req.artifacts.length})</h4>
          <div className="mt-2 space-y-2">
            {req.artifacts.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="rounded bg-brand-50 px-2 py-1 text-[10px] font-medium text-brand-700">
                    {ARTIFACT_LABELS[a.artifactType] ?? a.artifactType}
                  </span>
                  <div>
                    <p className="text-sm text-gray-900">{a.filename}</p>
                    <p className="text-[10px] text-gray-500">
                      {(a.sizeBytes / 1024).toFixed(1)}KB &middot; {a.mimeType}
                      {a.uploadedBy ? " &middot; Staff upload" : " &middot; Portal upload"}
                      {a.consentGiven && " &middot; Consent given"}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-gray-400">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decision History */}
      {req && req.decisions.length > 0 && (
        <div className="card">
          <h4 className="text-sm font-semibold text-gray-900">Decision History</h4>
          <div className="mt-2 space-y-2">
            {req.decisions.map((d) => (
              <div key={d.id} className="rounded-md border border-gray-200 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    d.outcome === "APPROVED" ? "bg-green-100 text-green-700" :
                    d.outcome === "REJECTED" ? "bg-red-100 text-red-700" :
                    "bg-orange-100 text-orange-700"
                  }`}>
                    {d.outcome.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] text-gray-400">{new Date(d.decidedAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-xs text-gray-700">{d.rationale}</p>
                <p className="mt-0.5 text-[10px] text-gray-500">by {d.reviewer.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Check History */}
      {req && req.checks.length > 0 && (
        <div className="card">
          <h4 className="text-sm font-semibold text-gray-900">Verification Checks</h4>
          <div className="mt-2 space-y-1">
            {req.checks.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${c.passed === true ? "bg-green-500" : c.passed === false ? "bg-red-500" : "bg-gray-300"}`} />
                  <span className="font-medium text-gray-700">{c.method.replace(/_/g, " ")}</span>
                </div>
                <span className="text-gray-400">{new Date(c.performedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decision Modal */}
      {showDecisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">IDV Decision</h3>
            <p className="mt-1 text-sm text-gray-500">Review the evidence and make a verification decision.</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Outcome</label>
                <div className="mt-1 flex gap-2">
                  {(["APPROVED", "REJECTED", "NEED_MORE_INFO"] as const).map((o) => (
                    <button key={o} onClick={() => setDecisionOutcome(o)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        decisionOutcome === o
                          ? o === "APPROVED" ? "bg-green-600 text-white" :
                            o === "REJECTED" ? "bg-red-600 text-white" :
                            "bg-orange-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}>
                      {o.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Rationale</label>
                <textarea value={decisionRationale} onChange={(e) => setDecisionRationale(e.target.value)}
                  placeholder="Provide justification for this decision..."
                  rows={3}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowDecisionModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleDecision} disabled={!decisionRationale.trim() || actionLoading === "decision"}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {actionLoading === "decision" ? "Submitting..." : "Submit Decision"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Upload Evidence</h3>
            <p className="mt-1 text-sm text-gray-500">Upload an identity document on behalf of the data subject.</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Document Type</label>
                <select value={uploadType} onChange={(e) => setUploadType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                  {Object.entries(ARTIFACT_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">File</label>
                <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
                  className="mt-1 w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
              </div>
              {uploadType === "SELFIE" && (
                <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <input type="checkbox" checked={uploadConsent} onChange={(e) => setUploadConsent(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300" />
                  <span className="text-xs text-amber-800">
                    I confirm that the data subject has given explicit consent for the collection and processing of this biometric data (selfie/face image) for identity verification purposes only.
                  </span>
                </label>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowUploadModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleUpload} disabled={actionLoading === "upload"}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {actionLoading === "upload" ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
