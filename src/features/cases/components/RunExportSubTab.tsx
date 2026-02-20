"use client";

import type { CopilotRunDetail } from "../types";
import { COPILOT_STATUS_COLORS } from "../constants";

interface Props {
  run: CopilotRunDetail;
  canManage: boolean;
  approvingLegal: boolean;
  onApproval: (status: "APPROVED" | "REJECTED") => void;
  onExport: (runId: string) => void;
}

export function RunExportSubTab({ run, canManage, approvingLegal, onApproval, onExport }: Props) {
  const exportBlocked = run.containsSpecialCategory && run.legalApprovalStatus !== "APPROVED";

  return (
    <div className="space-y-6">
      {/* Legal gate warning */}
      {exportBlocked && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            <div>
              <h3 className="text-sm font-semibold text-red-900">Export Blocked</h3>
              <p className="mt-1 text-sm text-red-700">This run contains special category data (Art. 9 GDPR). Legal approval is required before export is permitted.</p>
              {canManage && run.legalApprovalStatus !== "REJECTED" && (
                <div className="mt-3 flex gap-3">
                  <button onClick={() => onApproval("APPROVED")} disabled={approvingLegal} className="inline-flex items-center rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50">Approve</button>
                  <button onClick={() => onApproval("REJECTED")} disabled={approvingLegal} className="inline-flex items-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Reject</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Export Evidence</h3>
            <p className="mt-1 text-sm text-gray-500">Download all collected evidence as a JSON file.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <p className="text-gray-500">Legal Gate Status</p>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${run.legalApprovalStatus === "APPROVED" ? "bg-green-100 text-green-700" : run.legalApprovalStatus === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{run.legalApprovalStatus}</span>
            </div>
            <button
              onClick={() => onExport(run.id)}
              disabled={run.status !== "COMPLETED" || exportBlocked}
              className="btn-primary text-sm disabled:opacity-50"
            >
              Export JSON
            </button>
          </div>
        </div>
      </div>

      {/* Previous exports */}
      {run.exports.length > 0 && (
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900">Export History ({run.exports.length})</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Legal Gate</th>
                  <th className="pb-2 pr-4">Created By</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {run.exports.map((exp) => (
                  <tr key={exp.id}>
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{exp.exportType}</td>
                    <td className="py-2.5 pr-4"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${COPILOT_STATUS_COLORS[exp.status] ?? "bg-gray-100 text-gray-700"}`}>{exp.status}</span></td>
                    <td className="py-2.5 pr-4"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${exp.legalGateStatus === "APPROVED" ? "bg-green-100 text-green-700" : exp.legalGateStatus === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{exp.legalGateStatus}</span></td>
                    <td className="py-2.5 pr-4 text-gray-700">{exp.createdBy.name}</td>
                    <td className="py-2.5 text-gray-500">{new Date(exp.createdAt).toLocaleString()}</td>
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
