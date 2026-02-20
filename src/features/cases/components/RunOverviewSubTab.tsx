"use client";

import type { CopilotRunDetail } from "../types";
import { COPILOT_STATUS_COLORS } from "../constants";

interface Props {
  run: CopilotRunDetail;
}

export function RunOverviewSubTab({ run }: Props) {
  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Run Details</h3>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div><dt className="font-medium text-gray-500">Status</dt><dd className="mt-1"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${COPILOT_STATUS_COLORS[run.status] ?? "bg-gray-100 text-gray-700"}`}>{run.status.replace(/_/g, " ")}</span></dd></div>
          <div><dt className="font-medium text-gray-500">Legal Approval</dt><dd className="mt-1"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${run.legalApprovalStatus === "APPROVED" ? "bg-green-100 text-green-700" : run.legalApprovalStatus === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{run.legalApprovalStatus}</span></dd></div>
          <div><dt className="font-medium text-gray-500">Total Findings</dt><dd className="mt-1 text-gray-900">{run.totalFindings}</dd></div>
          <div><dt className="font-medium text-gray-500">Total Evidence Items</dt><dd className="mt-1 text-gray-900">{run.totalEvidenceItems}</dd></div>
          <div><dt className="font-medium text-gray-500">Special Category Data</dt><dd className="mt-1 text-gray-900">{run.containsSpecialCategory ? <span className="text-red-600 font-medium">Yes</span> : "No"}</dd></div>
          <div><dt className="font-medium text-gray-500">Queries</dt><dd className="mt-1 text-gray-900">{run.queries.length}</dd></div>
          <div><dt className="font-medium text-gray-500">Created</dt><dd className="mt-1 text-gray-900">{new Date(run.createdAt).toLocaleString()}</dd></div>
          {run.startedAt && <div><dt className="font-medium text-gray-500">Started</dt><dd className="mt-1 text-gray-900">{new Date(run.startedAt).toLocaleString()}</dd></div>}
          {run.completedAt && <div><dt className="font-medium text-gray-500">Completed</dt><dd className="mt-1 text-gray-900">{new Date(run.completedAt).toLocaleString()}</dd></div>}
          {run.legalApprovedBy && <div><dt className="font-medium text-gray-500">Approved By</dt><dd className="mt-1 text-gray-900">{run.legalApprovedBy.name}</dd></div>}
          {run.legalApprovedAt && <div><dt className="font-medium text-gray-500">Approved At</dt><dd className="mt-1 text-gray-900">{new Date(run.legalApprovedAt).toLocaleString()}</dd></div>}
        </dl>
      </div>

      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Justification</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{run.justification}</p>
      </div>

      {run.scopeSummary && (
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900">Scope Summary</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{run.scopeSummary}</p>
        </div>
      )}

      {run.resultSummary && (
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900">Result Summary</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{run.resultSummary}</p>
        </div>
      )}

      {run.errorDetails && (
        <div className="card border-red-200 bg-red-50/30">
          <h3 className="text-base font-semibold text-red-900">Error Details</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-red-700">{run.errorDetails}</p>
        </div>
      )}

      {run.queries.length > 0 && (
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900">Queries ({run.queries.length})</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="pb-2 pr-4">Provider</th>
                  <th className="pb-2 pr-4">Integration</th>
                  <th className="pb-2 pr-4">Intent</th>
                  <th className="pb-2 pr-4">Mode</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Records</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {run.queries.map((q) => (
                  <tr key={q.id}>
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{q.provider ?? "N/A"}</td>
                    <td className="py-2.5 pr-4 text-gray-700">{q.integration?.name ?? "N/A"}</td>
                    <td className="py-2.5 pr-4 text-gray-700">{q.queryIntent}</td>
                    <td className="py-2.5 pr-4 text-gray-500 text-xs">{q.executionMode}</td>
                    <td className="py-2.5 pr-4"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${COPILOT_STATUS_COLORS[q.status] ?? "bg-gray-100 text-gray-700"}`}>{q.status.replace(/_/g, " ")}</span></td>
                    <td className="py-2.5 pr-4 text-gray-700">{q.recordsFound ?? "-"}</td>
                    <td className="py-2.5 text-gray-500">{q.executionMs != null ? `${q.executionMs}ms` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
