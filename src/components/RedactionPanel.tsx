"use client";

import { useEffect, useState, useCallback } from "react";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface RedactionEntry {
  id: string;
  sectionKey?: string;
  documentRef?: string;
  redactedContent?: string;
  reason: string;
  redactionType?: string;
  pageNumber?: number;
  legalBasisReference?: string;
  approved: boolean;
  createdBy: { id: string; name: string; email: string };
  approvedBy?: { id: string; name: string };
  createdAt: string;
}

interface SensitiveFlag {
  id: string;
  dataCategory: string;
  description: string;
  status: string;
  pageNumber?: number;
  sectionKey?: string;
  reviewNote?: string;
  flaggedBy: { id: string; name: string; email: string };
  reviewedBy?: { id: string; name: string };
  createdAt: string;
}

interface LegalException {
  id: string;
  exceptionType: string;
  legalBasisReference: string;
  scope: string;
  justification: string;
  status: string;
  rejectionReason?: string;
  proposedBy: { id: string; name: string; email: string };
  approvedBy?: { id: string; name: string };
  createdAt: string;
}

interface PartialDenial {
  id: string;
  sectionKey: string;
  deniedScope: string;
  legalBasis: string;
  justificationText: string;
  status: string;
  exception?: { id: string; exceptionType: string; legalBasisReference: string };
  createdBy: { id: string; name: string; email: string };
  approvedBy?: { id: string; name: string };
  createdAt: string;
}

interface ReviewState {
  id: string;
  state: string;
  totalRedactions: number;
  approvedRedactions: number;
  pendingSensitiveFlags: number;
  pendingExceptions: number;
  completedBy?: { id: string; name: string };
  completedAt?: string;
  notes?: string;
}

interface GateResult {
  allowed: boolean;
  blockers: string[];
}

interface Props {
  caseId: string;
  userRole?: string;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const REDACTION_TYPE_LABELS: Record<string, string> = {
  FULL: "Full Redaction",
  PARTIAL: "Partial Mask",
  THIRD_PARTY: "Third-Party Data",
  ART9_SPECIAL: "Art. 9 Special Category",
  LEGAL_PRIVILEGE: "Legal Privilege",
  TRADE_SECRET: "Trade Secret",
};

const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  ART_15_4_RIGHTS_OF_OTHERS: "Art. 15(4) — Rights of Others",
  ART_17_3_LEGAL_OBLIGATION: "Art. 17(3)(b) — Legal Obligation",
  ART_17_3_PUBLIC_INTEREST: "Art. 17(3)(d) — Public Interest",
  ART_17_3_LEGAL_CLAIMS: "Art. 17(3)(e) — Legal Claims",
  ART_23_NATIONAL_SECURITY: "Art. 23(1)(a) — National Security",
  ART_23_PUBLIC_SECURITY: "Art. 23(1)(c) — Public Security",
  ART_23_JUDICIAL_PROCEEDINGS: "Art. 23(1)(f) — Judicial Proceedings",
  TRADE_SECRET: "Trade Secret",
  INTELLECTUAL_PROPERTY: "Intellectual Property",
  PROFESSIONAL_PRIVILEGE: "Professional Privilege",
};

const STATUS_COLORS: Record<string, string> = {
  FLAGGED: "bg-yellow-100 text-yellow-800",
  UNDER_REVIEW: "bg-blue-100 text-blue-800",
  CLEARED: "bg-green-100 text-green-800",
  REQUIRES_REDACTION: "bg-red-100 text-red-800",
  PROPOSED: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  WITHDRAWN: "bg-gray-100 text-gray-800",
  DRAFT: "bg-gray-100 text-gray-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_REVIEW: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
};

const REVIEW_STATE_LABELS: Record<string, string> = {
  PENDING: "Pending",
  IN_REVIEW: "In Review",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

const CAN_MANAGE = new Set(["SUPER_ADMIN", "TENANT_ADMIN", "DPO"]);
const CAN_CREATE = new Set(["SUPER_ADMIN", "TENANT_ADMIN", "DPO", "CASE_MANAGER"]);

type Section = "redactions" | "sensitive" | "exceptions" | "denials" | "review";

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function RedactionPanel({ caseId, userRole }: Props) {
  const [activeSection, setActiveSection] = useState<Section>("review");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data
  const [redactionEntries, setRedactionEntries] = useState<RedactionEntry[]>([]);
  const [sensitiveFlags, setSensitiveFlags] = useState<SensitiveFlag[]>([]);
  const [legalExceptions, setLegalExceptions] = useState<LegalException[]>([]);
  const [partialDenials, setPartialDenials] = useState<PartialDenial[]>([]);
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [gateResult, setGateResult] = useState<GateResult | null>(null);

  // Form states
  const [showRedactionForm, setShowRedactionForm] = useState(false);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [showDenialForm, setShowDenialForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canManage = CAN_MANAGE.has(userRole || "");
  const canCreate = CAN_CREATE.has(userRole || "");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/cases/${caseId}/redaction`);
      if (!res.ok) throw new Error("Failed to fetch redaction data");
      const data = await res.json();
      setRedactionEntries(data.redactionEntries || []);
      setSensitiveFlags(data.sensitiveFlags || []);
      setLegalExceptions(data.legalExceptions || []);
      setPartialDenials(data.partialDenials || []);
      setReviewState(data.reviewState || null);
      setGateResult(data.gateResult || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function postAction(body: Record<string, unknown>) {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/redaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Action failed");
      }
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="py-8 text-center text-sm text-gray-500">Loading redaction data...</div>;
  }

  const sections: { key: Section; label: string; count?: number }[] = [
    { key: "review", label: "Review Status" },
    { key: "redactions", label: "Redaction Log", count: redactionEntries.length },
    { key: "sensitive", label: "Sensitive Data", count: sensitiveFlags.length },
    { key: "exceptions", label: "Legal Exceptions", count: legalExceptions.length },
    { key: "denials", label: "Partial Denials", count: partialDenials.length },
  ];

  return (
    <div className="space-y-4">
      {/* Gate Status Banner */}
      {gateResult && !gateResult.allowed && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          <strong>Response generation blocked:</strong>
          <ul className="mt-1 list-disc pl-5">
            {gateResult.blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {gateResult && gateResult.allowed && redactionEntries.length > 0 && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
          Redaction review complete. Response generation is allowed.
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Section Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              activeSection === s.key
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            {s.label}
            {s.count !== undefined && (
              <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {s.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Review Status Section ────────────────────────────────────────── */}
      {activeSection === "review" && (
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Redaction Review Status</h3>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{reviewState?.totalRedactions ?? 0}</p>
              <p className="text-xs text-gray-500">Total Redactions</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{reviewState?.approvedRedactions ?? 0}</p>
              <p className="text-xs text-gray-500">Approved</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{reviewState?.pendingSensitiveFlags ?? 0}</p>
              <p className="text-xs text-gray-500">Sensitive Pending</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{reviewState?.pendingExceptions ?? 0}</p>
              <p className="text-xs text-gray-500">Exceptions Pending</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Review State:</span>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[reviewState?.state || "PENDING"]}`}>
              {REVIEW_STATE_LABELS[reviewState?.state || "PENDING"]}
            </span>
            {reviewState?.completedBy && (
              <span className="text-xs text-gray-500">
                by {reviewState.completedBy.name} on {new Date(reviewState.completedAt!).toLocaleDateString()}
              </span>
            )}
          </div>

          {canManage && (
            <div className="flex flex-wrap gap-2">
              {["PENDING", "IN_REVIEW", "COMPLETED"].map((state) => (
                <button
                  key={state}
                  onClick={() => postAction({ action: "update_review_state", state })}
                  disabled={submitting || reviewState?.state === state}
                  className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Set {REVIEW_STATE_LABELS[state]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Redaction Log Section ────────────────────────────────────────── */}
      {activeSection === "redactions" && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Document Redaction Log</h3>
            {canCreate && (
              <button
                onClick={() => setShowRedactionForm(!showRedactionForm)}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                + Add Redaction
              </button>
            )}
          </div>

          {showRedactionForm && <RedactionForm onSubmit={async (data) => {
            await postAction({ action: "create_redaction", ...data });
            setShowRedactionForm(false);
          }} submitting={submitting} />}

          {redactionEntries.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No redaction entries yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {redactionEntries.map((entry) => (
                <div key={entry.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        {entry.redactionType && (
                          <span className="inline-flex rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                            {REDACTION_TYPE_LABELS[entry.redactionType] || entry.redactionType}
                          </span>
                        )}
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${entry.approved ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                          {entry.approved ? "Approved" : "Pending"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-900">{entry.reason}</p>
                      {entry.sectionKey && <p className="text-xs text-gray-500">Section: {entry.sectionKey}</p>}
                      {entry.pageNumber && <p className="text-xs text-gray-500">Page: {entry.pageNumber}</p>}
                      {entry.legalBasisReference && <p className="text-xs text-gray-500">Legal Basis: {entry.legalBasisReference}</p>}
                      <p className="mt-1 text-xs text-gray-400">by {entry.createdBy.name} — {new Date(entry.createdAt).toLocaleString()}</p>
                    </div>
                    {canManage && !entry.approved && (
                      <button
                        onClick={() => postAction({ action: "approve_redaction", entryId: entry.id, approved: true })}
                        disabled={submitting}
                        className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Sensitive Data Section ───────────────────────────────────────── */}
      {activeSection === "sensitive" && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Sensitive Data Flags</h3>
            {canCreate && (
              <button
                onClick={() => setShowFlagForm(!showFlagForm)}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                + Flag Data
              </button>
            )}
          </div>

          {showFlagForm && <FlagForm onSubmit={async (data) => {
            await postAction({ action: "create_sensitive_flag", ...data });
            setShowFlagForm(false);
          }} submitting={submitting} />}

          {sensitiveFlags.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No sensitive data flags.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {sensitiveFlags.map((flag) => (
                <div key={flag.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          {flag.dataCategory}
                        </span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[flag.status]}`}>
                          {flag.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-900">{flag.description}</p>
                      {flag.reviewNote && <p className="mt-1 text-xs text-gray-600">Review: {flag.reviewNote}</p>}
                      <p className="mt-1 text-xs text-gray-400">by {flag.flaggedBy.name} — {new Date(flag.createdAt).toLocaleString()}</p>
                    </div>
                    {canManage && (flag.status === "FLAGGED" || flag.status === "UNDER_REVIEW") && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => postAction({ action: "review_sensitive_flag", flagId: flag.id, status: "CLEARED" })}
                          disabled={submitting}
                          className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => postAction({ action: "review_sensitive_flag", flagId: flag.id, status: "REQUIRES_REDACTION" })}
                          disabled={submitting}
                          className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Requires Redaction
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Legal Exceptions Section ─────────────────────────────────────── */}
      {activeSection === "exceptions" && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Legal Exceptions</h3>
            {canCreate && (
              <button
                onClick={() => setShowExceptionForm(!showExceptionForm)}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                + Propose Exception
              </button>
            )}
          </div>

          {showExceptionForm && <ExceptionForm onSubmit={async (data) => {
            await postAction({ action: "create_legal_exception", ...data });
            setShowExceptionForm(false);
          }} submitting={submitting} />}

          {legalExceptions.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No legal exceptions proposed.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {legalExceptions.map((ex) => (
                <div key={ex.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                          {EXCEPTION_TYPE_LABELS[ex.exceptionType] || ex.exceptionType}
                        </span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[ex.status]}`}>
                          {ex.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-900">{ex.legalBasisReference}</p>
                      <p className="text-sm text-gray-700">Scope: {ex.scope}</p>
                      <p className="text-sm text-gray-600">{ex.justification}</p>
                      {ex.rejectionReason && <p className="mt-1 text-xs text-red-600">Rejected: {ex.rejectionReason}</p>}
                      <p className="mt-1 text-xs text-gray-400">by {ex.proposedBy.name} — {new Date(ex.createdAt).toLocaleString()}</p>
                    </div>
                    {canManage && ex.status === "PROPOSED" && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => postAction({ action: "decide_legal_exception", exceptionId: ex.id, decision: "approve" })}
                          disabled={submitting}
                          className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt("Rejection reason:");
                            if (reason) postAction({ action: "decide_legal_exception", exceptionId: ex.id, decision: "reject", rejectionReason: reason });
                          }}
                          disabled={submitting}
                          className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
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
        </div>
      )}

      {/* ─── Partial Denials Section ──────────────────────────────────────── */}
      {activeSection === "denials" && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Partial Denial Builder</h3>
            {canCreate && (
              <button
                onClick={() => setShowDenialForm(!showDenialForm)}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                + Add Denial
              </button>
            )}
          </div>

          {showDenialForm && <DenialForm
            exceptions={legalExceptions}
            onSubmit={async (data) => {
              await postAction({ action: "create_partial_denial", ...data });
              setShowDenialForm(false);
            }}
            submitting={submitting}
          />}

          {partialDenials.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No partial denial sections.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {partialDenials.map((d) => (
                <div key={d.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">Section: {d.sectionKey}</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[d.status]}`}>
                          {d.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">Denied: {d.deniedScope}</p>
                      <p className="text-xs text-gray-500">Legal Basis: {d.legalBasis}</p>
                      <p className="text-sm text-gray-600">{d.justificationText}</p>
                      {d.exception && (
                        <p className="text-xs text-indigo-600">
                          Linked to: {EXCEPTION_TYPE_LABELS[d.exception.exceptionType] || d.exception.exceptionType}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">by {d.createdBy.name} — {new Date(d.createdAt).toLocaleString()}</p>
                    </div>
                    {canManage && d.status === "DRAFT" && (
                      <button
                        onClick={() => postAction({ action: "decide_partial_denial", denialId: d.id, decision: "submit" })}
                        disabled={submitting}
                        className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Submit
                      </button>
                    )}
                    {canManage && d.status === "SUBMITTED" && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => postAction({ action: "decide_partial_denial", denialId: d.id, decision: "approve" })}
                          disabled={submitting}
                          className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => postAction({ action: "decide_partial_denial", denialId: d.id, decision: "reject" })}
                          disabled={submitting}
                          className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
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
        </div>
      )}
    </div>
  );
}

/* ─── Sub-Forms ──────────────────────────────────────────────────────────── */

function RedactionForm({ onSubmit, submitting }: { onSubmit: (data: any) => Promise<void>; submitting: boolean }) {
  const [form, setForm] = useState({
    responseDocId: "",
    sectionKey: "",
    reason: "",
    redactionType: "",
    pageNumber: "",
    legalBasisReference: "",
    redactedContent: "",
  });

  return (
    <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Response Doc ID *" value={form.responseDocId} onChange={(e) => setForm({ ...form, responseDocId: e.target.value })}
          className="rounded-md border px-3 py-2 text-sm" />
        <select value={form.redactionType} onChange={(e) => setForm({ ...form, redactionType: e.target.value })}
          className="rounded-md border px-3 py-2 text-sm">
          <option value="">Redaction Type</option>
          {Object.entries(REDACTION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <input placeholder="Reason *" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
        className="w-full rounded-md border px-3 py-2 text-sm" />
      <div className="grid grid-cols-3 gap-3">
        <input placeholder="Section Key" value={form.sectionKey} onChange={(e) => setForm({ ...form, sectionKey: e.target.value })}
          className="rounded-md border px-3 py-2 text-sm" />
        <input placeholder="Page Number" type="number" value={form.pageNumber} onChange={(e) => setForm({ ...form, pageNumber: e.target.value })}
          className="rounded-md border px-3 py-2 text-sm" />
        <input placeholder="Legal Basis Ref" value={form.legalBasisReference} onChange={(e) => setForm({ ...form, legalBasisReference: e.target.value })}
          className="rounded-md border px-3 py-2 text-sm" />
      </div>
      <textarea placeholder="Redacted Content Description" value={form.redactedContent} onChange={(e) => setForm({ ...form, redactedContent: e.target.value })}
        className="w-full rounded-md border px-3 py-2 text-sm" rows={2} />
      <button onClick={() => onSubmit({
        ...form,
        pageNumber: form.pageNumber ? parseInt(form.pageNumber) : undefined,
        redactionType: form.redactionType || undefined,
        sectionKey: form.sectionKey || undefined,
        legalBasisReference: form.legalBasisReference || undefined,
        redactedContent: form.redactedContent || undefined,
      })} disabled={submitting || !form.responseDocId || !form.reason}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
        Create Redaction Entry
      </button>
    </div>
  );
}

const DATA_CATEGORIES = [
  "HEALTH", "RELIGION", "UNION", "POLITICAL_OPINION", "OTHER_SPECIAL_CATEGORY",
  "IDENTIFICATION", "CONTACT", "CONTRACT", "PAYMENT", "COMMUNICATION",
  "HR", "CREDITWORTHINESS", "ONLINE_TECHNICAL", "OTHER",
];

function FlagForm({ onSubmit, submitting }: { onSubmit: (data: any) => Promise<void>; submitting: boolean }) {
  const [form, setForm] = useState({ dataCategory: "HEALTH", description: "", pageNumber: "", sectionKey: "" });

  return (
    <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <select value={form.dataCategory} onChange={(e) => setForm({ ...form, dataCategory: e.target.value })}
          className="rounded-md border px-3 py-2 text-sm">
          {DATA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input placeholder="Section Key" value={form.sectionKey} onChange={(e) => setForm({ ...form, sectionKey: e.target.value })}
          className="rounded-md border px-3 py-2 text-sm" />
      </div>
      <input placeholder="Description *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
        className="w-full rounded-md border px-3 py-2 text-sm" />
      <button onClick={() => onSubmit({
        dataCategory: form.dataCategory,
        description: form.description,
        pageNumber: form.pageNumber ? parseInt(form.pageNumber) : undefined,
        sectionKey: form.sectionKey || undefined,
      })} disabled={submitting || !form.description}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
        Create Flag
      </button>
    </div>
  );
}

function ExceptionForm({ onSubmit, submitting }: { onSubmit: (data: any) => Promise<void>; submitting: boolean }) {
  const [form, setForm] = useState({
    exceptionType: "ART_15_4_RIGHTS_OF_OTHERS",
    legalBasisReference: "",
    scope: "",
    justification: "",
  });

  return (
    <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
      <select value={form.exceptionType} onChange={(e) => setForm({ ...form, exceptionType: e.target.value })}
        className="w-full rounded-md border px-3 py-2 text-sm">
        {Object.entries(EXCEPTION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <input placeholder="Legal Basis Reference * (e.g. GDPR Art. 15(4))" value={form.legalBasisReference}
        onChange={(e) => setForm({ ...form, legalBasisReference: e.target.value })}
        className="w-full rounded-md border px-3 py-2 text-sm" />
      <input placeholder="Scope * (which data/sections)" value={form.scope}
        onChange={(e) => setForm({ ...form, scope: e.target.value })}
        className="w-full rounded-md border px-3 py-2 text-sm" />
      <textarea placeholder="Justification *" value={form.justification}
        onChange={(e) => setForm({ ...form, justification: e.target.value })}
        className="w-full rounded-md border px-3 py-2 text-sm" rows={3} />
      <button onClick={() => onSubmit(form)}
        disabled={submitting || !form.legalBasisReference || !form.scope || !form.justification}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
        Propose Exception
      </button>
    </div>
  );
}

function DenialForm({ exceptions, onSubmit, submitting }: {
  exceptions: LegalException[];
  onSubmit: (data: any) => Promise<void>;
  submitting: boolean;
}) {
  const [form, setForm] = useState({
    sectionKey: "",
    deniedScope: "",
    legalBasis: "",
    exceptionId: "",
    justificationText: "",
  });

  const approvedExceptions = exceptions.filter((e) => e.status === "APPROVED");

  return (
    <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Section Key *" value={form.sectionKey}
          onChange={(e) => setForm({ ...form, sectionKey: e.target.value })}
          className="rounded-md border px-3 py-2 text-sm" />
        <input placeholder="Legal Basis *" value={form.legalBasis}
          onChange={(e) => setForm({ ...form, legalBasis: e.target.value })}
          className="rounded-md border px-3 py-2 text-sm" />
      </div>
      <input placeholder="Denied Scope *" value={form.deniedScope}
        onChange={(e) => setForm({ ...form, deniedScope: e.target.value })}
        className="w-full rounded-md border px-3 py-2 text-sm" />
      {approvedExceptions.length > 0 && (
        <select value={form.exceptionId} onChange={(e) => setForm({ ...form, exceptionId: e.target.value })}
          className="w-full rounded-md border px-3 py-2 text-sm">
          <option value="">Link to Exception (optional)</option>
          {approvedExceptions.map((e) => (
            <option key={e.id} value={e.id}>
              {EXCEPTION_TYPE_LABELS[e.exceptionType] || e.exceptionType} — {e.scope}
            </option>
          ))}
        </select>
      )}
      <textarea placeholder="Justification Text * (included in response)" value={form.justificationText}
        onChange={(e) => setForm({ ...form, justificationText: e.target.value })}
        className="w-full rounded-md border px-3 py-2 text-sm" rows={3} />
      <button onClick={() => onSubmit({
        ...form,
        exceptionId: form.exceptionId || undefined,
      })}
        disabled={submitting || !form.sectionKey || !form.deniedScope || !form.legalBasis || !form.justificationText}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
        Create Partial Denial
      </button>
    </div>
  );
}
