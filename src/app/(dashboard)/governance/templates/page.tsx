"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

/* ── Types ──────────────────────────────────────────────────────── */

interface TemplateSection {
  key: string;
  title: string;
  body: string;
}

interface Template {
  id: string;
  tenantId: string | null;
  name: string;
  language: string;
  jurisdiction: string;
  dsarTypes: string[];
  subjectTypes: string[];
  sections: TemplateSection[];
  disclaimerText: string | null;
  isBaseline: boolean;
  clonedFromId: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { versions: number; responseDocuments: number };
}

const TYPE_LABELS: Record<string, string> = {
  ACCESS: "Art. 15 Access",
  ERASURE: "Art. 17 Erasure",
  RECTIFICATION: "Art. 16 Rectification",
  RESTRICTION: "Art. 18 Restriction",
  PORTABILITY: "Art. 20 Portability",
  OBJECTION: "Art. 21 Objection",
};

const LANG_LABELS: Record<string, string> = { en: "English", de: "Deutsch" };

/* ── Component ──────────────────────────────────────────────────── */

export default function TemplateLibraryPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [filterLang, setFilterLang] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO"].includes(user?.role || "");

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const params = new URLSearchParams();
        if (filterLang) params.set("language", filterLang);
        if (filterType) params.set("dsarType", filterType);
        const res = await fetch(`/api/response-templates?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          setTemplates(json.templates || []);
        }
      } catch { /* silent */ }
      setLoading(false);
    }
    fetchTemplates();
  }, [filterLang, filterType]);

  async function handleClone(template: Template) {
    setCloning(true);
    setError(null);
    try {
      const res = await fetch("/api/response-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          language: template.language,
          jurisdiction: template.jurisdiction,
          dsarTypes: template.dsarTypes,
          subjectTypes: template.subjectTypes,
          sections: template.sections,
          disclaimerText: template.disclaimerText,
          clonedFromId: template.id,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setTemplates((prev) => [json.template, ...prev]);
      } else {
        const j = await res.json();
        setError(j.error);
      }
    } catch { setError("Network error"); }
    finally { setCloning(false); }
  }

  const baselineTemplates = templates.filter((t) => t.isBaseline);
  const tenantTemplates = templates.filter((t) => !t.isBaseline);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Response Templates</h1>
          <p className="mt-1 text-sm text-gray-500">Manage GDPR response templates. Clone baseline templates to customize for your organization.</p>
        </div>
        <Link href="/governance" className="btn-secondary text-sm">Back to Governance</Link>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-medium">Dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filterLang} onChange={(e) => setFilterLang(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">All Languages</option>
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">All DSAR Types</option>
          <option value="ACCESS">Access (Art. 15)</option>
          <option value="ERASURE">Erasure (Art. 17)</option>
          <option value="RECTIFICATION">Rectification (Art. 16)</option>
          <option value="RESTRICTION">Restriction (Art. 18)</option>
          <option value="PORTABILITY">Portability (Art. 20)</option>
          <option value="OBJECTION">Objection (Art. 21)</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse"><div className="h-5 w-64 bg-gray-200 rounded" /><div className="mt-2 h-4 w-48 bg-gray-100 rounded" /></div>
          ))}
        </div>
      ) : (
        <>
          {/* Tenant Templates */}
          {tenantTemplates.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Templates</h2>
              <div className="space-y-2">
                {tenantTemplates.map((t) => (
                  <TemplateCard key={t.id} template={t} onSelect={setSelectedTemplate} onClone={handleClone} canManage={canManage} cloning={cloning} />
                ))}
              </div>
            </div>
          )}

          {/* Baseline Templates */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Baseline Templates (Read-Only)</h2>
            {baselineTemplates.length === 0 ? (
              <p className="text-sm text-gray-400">No baseline templates installed. Run seed to install defaults.</p>
            ) : (
              <div className="space-y-2">
                {baselineTemplates.map((t) => (
                  <TemplateCard key={t.id} template={t} onSelect={setSelectedTemplate} onClone={handleClone} canManage={canManage} cloning={cloning} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Template Detail / Preview */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedTemplate(null)}>
          <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedTemplate.name}</h3>
                <p className="text-sm text-gray-500">
                  {LANG_LABELS[selectedTemplate.language] || selectedTemplate.language} &middot;
                  {selectedTemplate.dsarTypes.map((t) => TYPE_LABELS[t] || t).join(", ")} &middot;
                  {selectedTemplate.isBaseline ? " Baseline" : " Custom"}
                </p>
              </div>
              <button onClick={() => setSelectedTemplate(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Sections preview */}
            <div className="space-y-4">
              {selectedTemplate.sections.map((s) => (
                <div key={s.key} className="border rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-gray-800 mb-1">{s.title} <span className="text-xs font-normal text-gray-400">({s.key})</span></h4>
                  <div className="text-sm text-gray-600 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: s.body }} />
                </div>
              ))}
            </div>

            {selectedTemplate.disclaimerText && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">{selectedTemplate.disclaimerText}</div>
            )}

            {/* Placeholder reference */}
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Available Placeholders</h4>
              <div className="flex flex-wrap gap-1.5">
                {["case.number", "case.type", "case.received_date", "case.due_date", "subject.name", "subject.email", "tenant.name",
                  "deadlines.effective_due_date", "deadlines.extension_reason", "idv.status", "systems.count", "systems.names",
                  "data.categories", "data.total_records", "legal.exemptions", "legal.lawful_basis", "recipients.categories",
                  "retention.summary", "current_date"].map((p) => (
                  <code key={p} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{`{{${p}}}`}</code>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onSelect,
  onClone,
  canManage,
  cloning,
}: {
  template: Template;
  onSelect: (t: Template) => void;
  onClone: (t: Template) => void;
  canManage: boolean;
  cloning: boolean;
}) {
  return (
    <div className="card flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onSelect(template)}>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{template.name}</h3>
          {template.isBaseline && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Baseline</span>}
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{(LANG_LABELS as Record<string, string>)[template.language] || template.language}</span>
        </div>
        <p className="mt-0.5 text-xs text-gray-500 truncate">
          {template.dsarTypes.map((t) => (TYPE_LABELS as Record<string, string>)[t] || t).join(", ")}
          {template._count.responseDocuments > 0 && <span className="ml-2">&middot; {template._count.responseDocuments} doc(s) generated</span>}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => onSelect(template)} className="btn-secondary text-xs">Preview</button>
        {canManage && template.isBaseline && (
          <button onClick={() => onClone(template)} disabled={cloning} className="btn-primary text-xs">
            {cloning ? "..." : "Clone"}
          </button>
        )}
      </div>
    </div>
  );
}
