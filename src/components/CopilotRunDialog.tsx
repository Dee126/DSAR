"use client";

import { useState } from "react";

/* ── Types ────────────────────────────────────────────────────────────── */

interface JustificationTemplate {
  id: string;
  label: string;
  text: string;
}

export interface CopilotRunDialogProps {
  caseId: string;
  caseNumber: string;
  subjectName: string;
  availableIntegrations?: Array<{ id: string; name: string; provider: string }>;
  onClose: () => void;
  onSubmit: (params: CopilotRunParams) => Promise<void>;
}

export interface CopilotRunParams {
  caseId: string;
  justification: string;
  providerSelection: string[];
  contentScanRequested: boolean;
  ocrRequested: boolean;
  llmRequested: boolean;
  confirmed: boolean;
}

const JUSTIFICATION_TEMPLATES: JustificationTemplate[] = [
  {
    id: "art15_access",
    label: "Art. 15 Access request",
    text: "Art. 15 GDPR access request \u2013 locating personal data for response preparation",
  },
  {
    id: "art17_erasure",
    label: "Art. 17 Erasure request",
    text: "Art. 17 GDPR erasure request \u2013 identifying data locations for deletion assessment",
  },
  {
    id: "identity_verification",
    label: "Identity verification",
    text: "Identity verification support \u2013 correlating identifiers to confirm data subject identity",
  },
  {
    id: "art16_rectification",
    label: "Art. 16 Rectification",
    text: "Art. 16 GDPR rectification request \u2013 locating data for accuracy correction",
  },
  {
    id: "art20_portability",
    label: "Art. 20 Portability",
    text: "Art. 20 GDPR portability request \u2013 preparing structured data export",
  },
];

/* ── Component ────────────────────────────────────────────────────────── */

export default function CopilotRunDialog({
  caseId,
  caseNumber,
  subjectName,
  availableIntegrations = [],
  onClose,
  onSubmit,
}: CopilotRunDialogProps) {
  const [justification, setJustification] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<string[]>(
    availableIntegrations.map((i) => i.id),
  );
  const [contentScanRequested, setContentScanRequested] = useState(false);
  const [ocrRequested, setOcrRequested] = useState(false);
  const [llmRequested, setLlmRequested] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isValid = justification.trim().length >= 10 && confirmed;

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        caseId,
        justification: justification.trim(),
        providerSelection: selectedProviders,
        contentScanRequested,
        ocrRequested,
        llmRequested,
        confirmed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start run.");
    } finally {
      setSubmitting(false);
    }
  }

  function selectTemplate(template: JustificationTemplate) {
    setJustification(template.text);
  }

  function toggleProvider(id: string) {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Start Discovery Run</h2>
            <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Case {caseNumber} &middot; Subject: {subjectName}
          </p>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          {/* Warning Banner */}
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="flex gap-2">
              <svg className="h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-xs text-amber-700">
                This action will query connected systems and log the access. All queries are audit-logged and visible to your DPO.
              </p>
            </div>
          </div>

          {/* Subject Identity */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Subject Identity</label>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700">
                {subjectName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </div>
              <span className="text-sm text-gray-700">{subjectName}</span>
              <span className="ml-auto text-xs text-gray-400">Linked to case</span>
            </div>
          </div>

          {/* Justification */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Justification <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500">Min. 10 characters. Select a template or write your own.</p>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {JUSTIFICATION_TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => selectTemplate(t)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    justification === t.text
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:bg-brand-50"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            <textarea value={justification} onChange={(e) => setJustification(e.target.value)}
              placeholder="Describe why this discovery run is needed..."
              rows={3}
              className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            <p className={`mt-1 text-xs ${justification.trim().length >= 10 ? "text-green-600" : "text-gray-400"}`}>
              {justification.trim().length}/10 min characters
            </p>
          </div>

          {/* Provider Scope */}
          {availableIntegrations.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Provider scope</label>
              <p className="text-xs text-gray-500">Select which integrations to include in the discovery.</p>
              <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                {availableIntegrations.map((integration) => (
                  <label key={integration.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox"
                      checked={selectedProviders.includes(integration.id)}
                      onChange={() => toggleProvider(integration.id)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                    <span className="font-medium">{integration.name}</span>
                    <span className="text-xs text-gray-400">({integration.provider})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Advanced Options (collapsible) */}
          <div>
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-800">
              <svg className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              Advanced options
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Expand beyond metadata. Requires DPO/Admin permissions.</p>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={contentScanRequested}
                    onChange={(e) => setContentScanRequested(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  <span className="text-sm text-gray-700">Content Scanning</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={ocrRequested}
                    onChange={(e) => setOcrRequested(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  <span className="text-sm text-gray-700">OCR Processing</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={llmRequested}
                    onChange={(e) => setLlmRequested(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  <span className="text-sm text-gray-700">AI Summaries</span>
                </label>
              </div>
            )}
          </div>

          {/* Confirmation */}
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm text-gray-700">
                I confirm this is for DSAR processing and all access will be audit-logged.
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!isValid || submitting}
            className="btn-primary disabled:opacity-50">
            {submitting ? "Starting..." : "Start Discovery Run"}
          </button>
        </div>
      </div>
    </div>
  );
}
