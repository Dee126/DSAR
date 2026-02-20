"use client";

import type { DSARCaseDetail, CopilotRunSummary } from "../types";
import { COPILOT_STATUS_COLORS } from "../constants";
import CopilotRunDialog from "@/components/CopilotRunDialog";
import { CopilotRunDetailView } from "./CopilotRunDetailView";

interface Props {
  caseData: DSARCaseDetail;
  canManage: boolean;
  canCopilot: boolean;
  // eslint-disable-next-line
  copilot: any;
}

export function CopilotTab({ caseData, canManage, canCopilot, copilot }: Props) {
  const {
    copilotRuns, selectedRun, setSelectedRun,
    copilotQuestion, setCopilotQuestion,
    showRunDialog, setShowRunDialog,
    availableIntegrations,
    handleRunDialogSubmit, fetchRunDetail,
    handleGenerateSummary, handleLegalApproval, handleExportEvidence,
  } = copilot;

  const pendingSpecialRuns = (copilotRuns as CopilotRunSummary[]).filter(
    (r) => r.containsSpecialCategory && r.legalApprovalStatus === "PENDING",
  );

  return (
    <>
      {/* Approval Banners */}
      {pendingSpecialRuns.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">Art. 9 Special Category Data — Legal review required before export</h3>
              <p className="mt-1 text-sm text-amber-700">
                {pendingSpecialRuns.length} run(s) contain special category data requiring DPO/Legal approval before results can be exported.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Selected Run Detail View */}
      {selectedRun ? (
        <CopilotRunDetailView
          run={selectedRun}
          onBack={() => setSelectedRun(null)}
          onExport={handleExportEvidence}
          canManage={canManage}
          onRefresh={() => fetchRunDetail(selectedRun.id)}
          onGenerateSummary={handleGenerateSummary}
          onLegalApproval={handleLegalApproval}
        />
      ) : (
        <CopilotListView
          caseData={caseData}
          copilotRuns={copilotRuns}
          canCopilot={canCopilot}
          copilotQuestion={copilotQuestion}
          setCopilotQuestion={setCopilotQuestion}
          setShowRunDialog={setShowRunDialog}
          fetchRunDetail={fetchRunDetail}
        />
      )}

      {/* CopilotRunDialog */}
      {showRunDialog && caseData && (
        <CopilotRunDialog
          caseId={caseData.id}
          caseNumber={caseData.caseNumber}
          subjectName={caseData.dataSubject.fullName}
          availableIntegrations={availableIntegrations}
          onClose={() => setShowRunDialog(false)}
          onSubmit={handleRunDialogSubmit}
        />
      )}
    </>
  );
}

/* ── Inline: Copilot list view (ask + run history) ──────────────────── */

function CopilotListView({
  caseData, copilotRuns, canCopilot,
  copilotQuestion, setCopilotQuestion,
  setShowRunDialog, fetchRunDetail,
}: {
  caseData: DSARCaseDetail;
  copilotRuns: CopilotRunSummary[];
  canCopilot: boolean;
  copilotQuestion: string;
  setCopilotQuestion: (v: string) => void;
  setShowRunDialog: (v: boolean) => void;
  fetchRunDetail: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Left Column — Ask Copilot */}
      <div className="space-y-4 lg:col-span-2">
        <AskCopilotCard
          caseData={caseData}
          copilotQuestion={copilotQuestion}
          setCopilotQuestion={setCopilotQuestion}
        />
        {canCopilot && <RunDiscoveryCard onStart={() => setShowRunDialog(true)} />}
        {copilotRuns.length > 0 && <StatsCard copilotRuns={copilotRuns} />}
      </div>

      {/* Right Column — Run History */}
      <div className="lg:col-span-3">
        <RunHistoryCard copilotRuns={copilotRuns} fetchRunDetail={fetchRunDetail} />
      </div>
    </div>
  );
}

function AskCopilotCard({ caseData, copilotQuestion, setCopilotQuestion }: {
  caseData: DSARCaseDetail; copilotQuestion: string; setCopilotQuestion: (v: string) => void;
}) {
  const initials = caseData.dataSubject.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>
        <h2 className="text-lg font-semibold text-gray-900">Ask Copilot</h2>
      </div>
      <p className="mt-1 text-sm text-gray-500">Ask questions about this case&apos;s data subject or start a full discovery run.</p>
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700">{initials}</div>
        <span className="text-sm text-gray-700">{caseData.dataSubject.fullName}</span>
        <span className="ml-auto text-xs text-gray-400">Data Subject</span>
      </div>
      <div className="mt-4">
        <textarea value={copilotQuestion} onChange={(e) => setCopilotQuestion(e.target.value)} placeholder="Ask a question about this data subject..." rows={3} className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
          Audit-logged
        </div>
        <button disabled={!copilotQuestion.trim()} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Ask</button>
      </div>
    </div>
  );
}

function RunDiscoveryCard({ onStart }: { onStart: () => void }) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-900">Run Discovery</h3>
      <p className="mt-1 text-xs text-gray-500">Start a full automated data discovery across all connected integrations for this data subject.</p>
      <button onClick={onStart} className="btn-primary mt-3 w-full text-sm">
        <span className="flex items-center justify-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          Start Discovery Run
        </span>
      </button>
      <p className="mt-2 text-xs text-gray-400">Metadata-only mode by default. Advanced options available in the run dialog.</p>
    </div>
  );
}

function StatsCard({ copilotRuns }: { copilotRuns: CopilotRunSummary[] }) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-900">Summary</h3>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-gray-50 p-2.5 text-center"><dd className="text-lg font-bold text-gray-900">{copilotRuns.length}</dd><dt className="text-xs text-gray-500">Total Runs</dt></div>
        <div className="rounded-lg bg-gray-50 p-2.5 text-center"><dd className="text-lg font-bold text-gray-900">{copilotRuns.filter((r) => r.status === "COMPLETED").length}</dd><dt className="text-xs text-gray-500">Completed</dt></div>
        <div className="rounded-lg bg-gray-50 p-2.5 text-center"><dd className="text-lg font-bold text-gray-900">{copilotRuns.reduce((sum, r) => sum + r.totalEvidenceItems, 0)}</dd><dt className="text-xs text-gray-500">Evidence Items</dt></div>
        <div className="rounded-lg bg-gray-50 p-2.5 text-center">
          <dd className={`text-lg font-bold ${copilotRuns.some((r) => r.containsSpecialCategory) ? "text-red-600" : "text-gray-900"}`}>{copilotRuns.filter((r) => r.containsSpecialCategory).length}</dd>
          <dt className="text-xs text-gray-500">Special Cat.</dt>
        </div>
      </dl>
    </div>
  );
}

function RunHistoryCard({ copilotRuns, fetchRunDetail }: { copilotRuns: CopilotRunSummary[]; fetchRunDetail: (id: string) => void }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Run History</h2>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{copilotRuns.length}</span>
      </div>
      {copilotRuns.length === 0 ? (
        <div className="mt-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          <p className="mt-3 text-sm text-gray-500">No discovery runs yet.</p>
          <p className="mt-1 text-xs text-gray-400">Start a discovery run to search for the data subject&apos;s personal data across connected systems.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {copilotRuns.map((run) => (
            <button key={run.id} onClick={() => fetchRunDetail(run.id)} className="w-full rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${COPILOT_STATUS_COLORS[run.status] ?? "bg-gray-100 text-gray-700"}`}>{run.status.replace(/_/g, " ")}</span>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${run.legalApprovalStatus === "APPROVED" ? "bg-green-100 text-green-700" : run.legalApprovalStatus === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{run.legalApprovalStatus}</span>
                  {run.containsSpecialCategory && <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Art. 9</span>}
                </div>
                <span className="text-xs text-gray-400">{new Date(run.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm text-gray-700 line-clamp-2">{run.justification}</p>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>{run._count.findings} findings</span>
                  <span>{run.totalEvidenceItems} evidence</span>
                  <span>{run._count.queries} queries</span>
                </div>
                <span className="text-xs text-gray-400">by {run.createdBy.name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
