"use client";

import { useEffect, useState, useCallback } from "react";

/* ── Types ──────────────────────────────────────────────────────── */

interface ResponseUser { id: string; name: string; email: string }
interface RenderedSection { key: string; title: string; renderedHtml: string }
interface ResponseApproval { id: string; action: string; comments: string | null; createdAt: string; reviewer: ResponseUser }
interface DeliveryRecord { id: string; method: string; recipientRef: string | null; sentAt: string; notes: string | null; createdBy: ResponseUser }
interface RedactionEntry { id: string; sectionKey: string | null; reason: string; createdAt: string; createdBy: ResponseUser }

interface ResponseDoc {
  id: string;
  version: number;
  status: string;
  language: string;
  sections: RenderedSection[];
  fullHtml: string;
  aiAssisted: boolean;
  aiWarnings: string[];
  createdAt: string;
  editedAt: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  template: { id: string; name: string; language: string } | null;
  createdBy: ResponseUser;
  editedBy: ResponseUser | null;
  approvedBy: ResponseUser | null;
  approvals: ResponseApproval[];
  deliveries: DeliveryRecord[];
  redactions: RedactionEntry[];
}

interface Template {
  id: string;
  name: string;
  language: string;
  dsarTypes: string[];
  isBaseline: boolean;
  tenantId: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  IN_REVIEW: "bg-yellow-100 text-yellow-800",
  CHANGES_REQUESTED: "bg-orange-100 text-orange-800",
  APPROVED: "bg-green-100 text-green-800",
  SENT: "bg-blue-100 text-blue-800",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In Review",
  CHANGES_REQUESTED: "Changes Requested",
  APPROVED: "Approved",
  SENT: "Sent",
};

/* ── Component ──────────────────────────────────────────────────── */

export default function ResponsePanel({
  caseId,
  userRole,
}: {
  caseId: string;
  userRole?: string;
}) {
  const [documents, setDocuments] = useState<ResponseDoc[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ResponseDoc | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [approvalAction, setApprovalAction] = useState<"approve" | "request_changes">("approve");
  const [approvalComments, setApprovalComments] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("EMAIL");
  const [deliveryRef, setDeliveryRef] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO", "CASE_MANAGER"].includes(userRole || "");
  const canApprove = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO"].includes(userRole || "");
  const canSend = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO"].includes(userRole || "");
  const canEdit = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO", "CASE_MANAGER"].includes(userRole || "");

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/response`);
      if (res.ok) {
        const json = await res.json();
        setDocuments(json.documents || []);
        if (json.documents?.length > 0 && !selectedDoc) {
          setSelectedDoc(json.documents[0]);
        }
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [caseId, selectedDoc]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/response-templates");
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.templates || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchDocuments(); fetchTemplates(); }, [fetchDocuments, fetchTemplates]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          templateId: selectedTemplateId || undefined,
          language: selectedLanguage,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Generation failed"); return; }
      setShowGenerateModal(false);
      await fetchDocuments();
    } catch { setError("Network error"); }
    finally { setGenerating(false); }
  }

  async function handleSubmitReview() {
    if (!selectedDoc) return;
    try {
      const res = await fetch(`/api/cases/${caseId}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit_review", responseDocId: selectedDoc.id }),
      });
      if (res.ok) await fetchDocuments();
      else { const j = await res.json(); setError(j.error); }
    } catch { setError("Network error"); }
  }

  async function handleApproval() {
    if (!selectedDoc) return;
    try {
      const res = await fetch(`/api/cases/${caseId}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: approvalAction,
          responseDocId: selectedDoc.id,
          comments: approvalComments || undefined,
        }),
      });
      if (res.ok) { setShowApprovalModal(false); setApprovalComments(""); await fetchDocuments(); }
      else { const j = await res.json(); setError(j.error); }
    } catch { setError("Network error"); }
  }

  async function handleDelivery() {
    if (!selectedDoc) return;
    try {
      const res = await fetch(`/api/cases/${caseId}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deliver",
          responseDocId: selectedDoc.id,
          method: deliveryMethod,
          recipientRef: deliveryRef || undefined,
          notes: deliveryNotes || undefined,
        }),
      });
      if (res.ok) { setShowDeliveryModal(false); setDeliveryRef(""); setDeliveryNotes(""); await fetchDocuments(); }
      else { const j = await res.json(); setError(j.error); }
    } catch { setError("Network error"); }
  }

  async function handleExport(format: string) {
    if (!selectedDoc) return;
    setExporting(format);
    try {
      const res = await fetch(`/api/cases/${caseId}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export", responseDocId: selectedDoc.id, format }),
      });
      if (res.ok) {
        // Download via the download endpoint
        await fetchDocuments();
        const downloadUrl = `/api/cases/${caseId}/response/download?docId=${selectedDoc.id}&format=${format}`;
        window.open(downloadUrl, "_blank");
      } else {
        const j = await res.json();
        setError(j.error);
      }
    } catch { setError("Network error"); }
    finally { setExporting(null); }
  }

  if (loading) {
    return <div className="card animate-pulse"><div className="h-6 w-48 bg-gray-200 rounded" /><div className="mt-4 h-32 bg-gray-100 rounded" /></div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-medium">Dismiss</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Response Documents</h2>
        {canGenerate && (
          <button onClick={() => setShowGenerateModal(true)} className="btn-primary text-sm">
            Generate Response
          </button>
        )}
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <div className="card text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="mt-3 text-sm text-gray-500">No response documents generated yet.</p>
          {canGenerate && <p className="mt-1 text-xs text-gray-400">Click "Generate Response" to create a DSAR response from a template.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Version selector */}
          <div className="flex flex-wrap gap-2">
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => { setSelectedDoc(doc); setShowPreview(false); }}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  selectedDoc?.id === doc.id
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                v{doc.version}
                <span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[doc.status] || "bg-gray-100"}`}>
                  {STATUS_LABELS[doc.status] || doc.status}
                </span>
              </button>
            ))}
          </div>

          {/* Selected document detail */}
          {selectedDoc && (
            <div className="card space-y-4">
              {/* Meta info */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Version {selectedDoc.version}
                    {selectedDoc.template && <span className="ml-2 text-xs font-normal text-gray-500">({selectedDoc.template.name})</span>}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Created {new Date(selectedDoc.createdAt).toLocaleString()} by {selectedDoc.createdBy.name}
                    {selectedDoc.editedBy && <> &middot; Last edited by {selectedDoc.editedBy.name}</>}
                    {selectedDoc.approvedBy && <> &middot; Approved by {selectedDoc.approvedBy.name}</>}
                  </p>
                  {selectedDoc.aiWarnings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {selectedDoc.aiWarnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
                          <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                          {w}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setShowPreview(!showPreview)} className="btn-secondary text-xs">
                    {showPreview ? "Hide Preview" : "Preview"}
                  </button>

                  {/* Export buttons */}
                  <button onClick={() => handleExport("html")} disabled={!!exporting} className="btn-secondary text-xs">
                    {exporting === "html" ? "..." : "HTML"}
                  </button>
                  <button onClick={() => handleExport("pdf")} disabled={!!exporting} className="btn-secondary text-xs">
                    {exporting === "pdf" ? "..." : "PDF"}
                  </button>
                  <button onClick={() => handleExport("docx")} disabled={!!exporting} className="btn-secondary text-xs">
                    {exporting === "docx" ? "..." : "DOCX"}
                  </button>

                  {/* Workflow buttons */}
                  {canEdit && (selectedDoc.status === "DRAFT" || selectedDoc.status === "CHANGES_REQUESTED") && (
                    <button onClick={handleSubmitReview} className="btn-primary text-xs">Submit for Review</button>
                  )}
                  {canApprove && selectedDoc.status === "IN_REVIEW" && (
                    <button onClick={() => setShowApprovalModal(true)} className="btn-primary text-xs">Review</button>
                  )}
                  {canSend && selectedDoc.status === "APPROVED" && (
                    <button onClick={() => setShowDeliveryModal(true)} className="btn-primary text-xs">Record Delivery</button>
                  )}
                </div>
              </div>

              {/* Section navigator */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sections</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDoc.sections.map((s) => (
                    <span key={s.key} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">{s.title}</span>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {showPreview && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 border-b">Document Preview</div>
                  <div className="p-4 bg-white max-h-[600px] overflow-y-auto">
                    <div dangerouslySetInnerHTML={{ __html: selectedDoc.fullHtml }} />
                  </div>
                </div>
              )}

              {/* Approval history */}
              {selectedDoc.approvals.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Review History</h4>
                  <div className="space-y-2">
                    {selectedDoc.approvals.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 text-xs">
                        <span className={`mt-0.5 rounded-full px-2 py-0.5 font-medium ${a.action === "approve" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                          {a.action === "approve" ? "Approved" : "Changes Requested"}
                        </span>
                        <span className="text-gray-600">by {a.reviewer.name}</span>
                        <span className="text-gray-400">{new Date(a.createdAt).toLocaleString()}</span>
                        {a.comments && <span className="text-gray-500 italic">&mdash; {a.comments}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery records */}
              {selectedDoc.deliveries.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Delivery Records</h4>
                  <div className="space-y-2">
                    {selectedDoc.deliveries.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 text-xs">
                        <span className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-700">{d.method}</span>
                        {d.recipientRef && <span className="text-gray-600">{d.recipientRef}</span>}
                        <span className="text-gray-400">{new Date(d.sentAt).toLocaleString()}</span>
                        <span className="text-gray-500">by {d.createdBy.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Redaction log */}
              {selectedDoc.redactions.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Redaction Log</h4>
                  <div className="space-y-2">
                    {selectedDoc.redactions.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-xs">
                        <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700">Redacted</span>
                        {r.sectionKey && <span className="text-gray-600">Section: {r.sectionKey}</span>}
                        <span className="text-gray-500">Reason: {r.reason}</span>
                        <span className="text-gray-400">{new Date(r.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Generate Modal ─────────────────────────────────────────── */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Generate Response</h3>
            <p className="mt-1 text-sm text-gray-500">Select a template and language to generate a DSAR response document.</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Auto-select based on case type</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.language.toUpperCase()}) {t.isBaseline ? "[Baseline]" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Language</label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>

              <p className="text-xs text-amber-600 flex items-center gap-1 bg-amber-50 rounded-lg p-2">
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                Generated responses are templates filled with case data and do not constitute legal advice. Review before sending.
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowGenerateModal(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleGenerate} disabled={generating} className="btn-primary text-sm">
                {generating ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approval Modal ─────────────────────────────────────────── */}
      {showApprovalModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Review Response (v{selectedDoc.version})</h3>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Decision</label>
                <div className="mt-1 flex gap-3">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={approvalAction === "approve"} onChange={() => setApprovalAction("approve")} className="text-brand-600" />
                    <span className="text-sm text-gray-700">Approve</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={approvalAction === "request_changes"} onChange={() => setApprovalAction("request_changes")} className="text-orange-600" />
                    <span className="text-sm text-gray-700">Request Changes</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Comments</label>
                <textarea
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Optional review comments..."
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowApprovalModal(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleApproval} className={`text-sm rounded-lg px-4 py-2 font-medium text-white ${approvalAction === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700"}`}>
                {approvalAction === "approve" ? "Approve" : "Request Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delivery Modal ─────────────────────────────────────────── */}
      {showDeliveryModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Record Delivery</h3>
            <p className="mt-1 text-sm text-gray-500">Record how the response was delivered to the data subject.</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Delivery Method</label>
                <select value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="EMAIL">Email</option>
                  <option value="POSTAL">Postal Mail</option>
                  <option value="PORTAL">Portal</option>
                  <option value="API">API</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Recipient Reference</label>
                <input type="text" value={deliveryRef} onChange={(e) => setDeliveryRef(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Email address, postal ref, etc." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Optional delivery notes..." />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowDeliveryModal(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleDelivery} className="btn-primary text-sm">Record Delivery</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
