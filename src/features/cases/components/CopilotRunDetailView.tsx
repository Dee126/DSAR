"use client";

import { useState } from "react";
import type { CopilotRunDetail, CopilotFinding, RunTabKey } from "../types";
import { COPILOT_STATUS_COLORS, SPECIAL_CATEGORIES, EVIDENCE_PAGE_SIZE, SUMMARY_TYPES } from "../constants";
import { RunOverviewSubTab } from "./RunOverviewSubTab";
import { RunEvidenceSubTab } from "./RunEvidenceSubTab";
import { RunFindingsSubTab } from "./RunFindingsSubTab";
import { RunCategoriesSubTab } from "./RunCategoriesSubTab";
import { RunSummariesSubTab } from "./RunSummariesSubTab";
import { RunExportSubTab } from "./RunExportSubTab";

interface Props {
  run: CopilotRunDetail;
  onBack: () => void;
  onExport: (runId: string) => void;
  canManage: boolean;
  onRefresh: () => void;
  onGenerateSummary: (runId: string, summaryType: string) => Promise<void>;
  onLegalApproval: (runId: string, status: "APPROVED" | "REJECTED") => Promise<void>;
}

export function CopilotRunDetailView({
  run, onBack, onExport, canManage, onRefresh, onGenerateSummary, onLegalApproval,
}: Props) {
  const [activeRunTab, setActiveRunTab] = useState<RunTabKey>("overview");
  const [generatingSummary, setGeneratingSummary] = useState<string | null>(null);
  const [approvingLegal, setApprovingLegal] = useState(false);
  const [evidencePage, setEvidencePage] = useState(0);

  const isRunning = ["DRAFT", "QUEUED", "RUNNING"].includes(run.status);

  async function handleGenerate(summaryType: string) {
    setGeneratingSummary(summaryType);
    try { await onGenerateSummary(run.id, summaryType); } finally { setGeneratingSummary(null); }
  }

  async function handleApproval(status: "APPROVED" | "REJECTED") {
    setApprovingLegal(true);
    try { await onLegalApproval(run.id, status); } finally { setApprovingLegal(false); }
  }

  const findingsByCategory: Record<string, CopilotFinding[]> = {};
  for (const f of run.findings) {
    if (!findingsByCategory[f.dataCategory]) findingsByCategory[f.dataCategory] = [];
    findingsByCategory[f.dataCategory].push(f);
  }

  const categoryStats = Object.entries(findingsByCategory).map(([category, findings]) => ({
    category,
    count: findings.length,
    maxSeverity: findings.some((f) => f.severity === "CRITICAL") ? "CRITICAL" : findings.some((f) => f.severity === "WARNING") ? "WARNING" : "INFO",
    isSpecial: SPECIAL_CATEGORIES.includes(category),
  }));

  const totalEvidencePages = Math.max(1, Math.ceil(run.evidenceItems.length / EVIDENCE_PAGE_SIZE));
  const paginatedEvidence = run.evidenceItems.slice(evidencePage * EVIDENCE_PAGE_SIZE, (evidencePage + 1) * EVIDENCE_PAGE_SIZE);

  const runTabs: { key: RunTabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "evidence", label: "Evidence", count: run.evidenceItems.length },
    { key: "findings", label: "Findings", count: run.findings.length },
    { key: "categories", label: "Categories", count: categoryStats.length },
    { key: "summaries", label: "Summaries", count: run.summaries.length },
    { key: "export", label: "Export", count: run.exports.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">Discovery Run</h2>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${COPILOT_STATUS_COLORS[run.status] ?? "bg-gray-100 text-gray-700"}`}>{run.status.replace(/_/g, " ")}</span>
                {run.containsSpecialCategory && <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Special Category Data</span>}
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${run.legalApprovalStatus === "APPROVED" ? "bg-green-100 text-green-700" : run.legalApprovalStatus === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{run.legalApprovalStatus}</span>
              </div>
              <p className="mt-1 text-sm text-gray-500">Started {new Date(run.createdAt).toLocaleString()} by {run.createdBy.name}</p>
            </div>
          </div>
          <button onClick={onRefresh} className="btn-secondary text-sm">Refresh</button>
        </div>
      </div>

      {/* Legal Gate Banner */}
      {run.containsSpecialCategory && run.legalApprovalStatus !== "APPROVED" && (
        <LegalGateBanner canManage={canManage} isRejected={run.legalApprovalStatus === "REJECTED"} approvingLegal={approvingLegal} onApproval={handleApproval} />
      )}

      {/* Progress Indicator */}
      {isRunning && (
        <div className="card flex items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <div>
            <p className="text-sm font-medium text-gray-900">Discovery in progress...</p>
            <p className="text-xs text-gray-500">Querying connected systems for personal data. This page auto-refreshes every 3 seconds.</p>
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {runTabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveRunTab(tab.key)}
              className={`whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors ${activeRunTab === tab.key ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"}`}>
              {tab.label}
              {tab.count !== undefined && <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs">{tab.count}</span>}
            </button>
          ))}
        </nav>
      </div>

      {activeRunTab === "overview" && <RunOverviewSubTab run={run} />}
      {activeRunTab === "evidence" && <RunEvidenceSubTab paginatedEvidence={paginatedEvidence} totalItems={run.evidenceItems.length} evidencePage={evidencePage} totalPages={totalEvidencePages} onPageChange={setEvidencePage} />}
      {activeRunTab === "findings" && <RunFindingsSubTab findingsByCategory={findingsByCategory} />}
      {activeRunTab === "categories" && <RunCategoriesSubTab categoryStats={categoryStats} />}
      {activeRunTab === "summaries" && <RunSummariesSubTab run={run} generatingSummary={generatingSummary} onGenerate={handleGenerate} />}
      {activeRunTab === "export" && <RunExportSubTab run={run} canManage={canManage} approvingLegal={approvingLegal} onApproval={handleApproval} onExport={onExport} />}
    </div>
  );
}

function LegalGateBanner({ canManage, isRejected, approvingLegal, onApproval }: {
  canManage: boolean; isRejected: boolean; approvingLegal: boolean;
  onApproval: (status: "APPROVED" | "REJECTED") => void;
}) {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-900">Art. 9 Special Category Data Detected — Legal review required before export</h3>
          <p className="mt-1 text-sm text-red-700">This discovery run contains special category data that requires legal approval before it can be exported or included in the DSAR response.</p>
          {canManage && !isRejected && (
            <div className="mt-3 flex gap-3">
              <button onClick={() => onApproval("APPROVED")} disabled={approvingLegal} className="inline-flex items-center rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50">Approve</button>
              <button onClick={() => onApproval("REJECTED")} disabled={approvingLegal} className="inline-flex items-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Reject</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
