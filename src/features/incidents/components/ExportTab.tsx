"use client";

import type { Incident } from "../types";
import { useExportTab } from "../hooks/useExportTab";
import { EXPORT_STATUS_COLORS } from "../constants";
import { formatDateTime } from "@/shared/utils";

interface Props {
  incident: Incident;
  incidentId: string;
  onRefresh: () => Promise<unknown>;
}

export function ExportTab({ incident, incidentId, onRefresh }: Props) {
  const ex = useExportTab(incidentId, onRefresh);

  return (
    <div className="space-y-6">
      {/* Generate new export */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Authority Pack</h2>
        <p className="text-sm text-gray-600 mb-4">
          Generate a comprehensive export pack for supervisory authority notification under Art. 33 GDPR.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {([
            ["exportIncludeTimeline", "Include Timeline", ex.exportIncludeTimeline, ex.setExportIncludeTimeline],
            ["exportIncludeDsarList", "Include DSAR List", ex.exportIncludeDsarList, ex.setExportIncludeDsarList],
            ["exportIncludeEvidence", "Include Evidence", ex.exportIncludeEvidence, ex.setExportIncludeEvidence],
            ["exportIncludeResponses", "Include Responses", ex.exportIncludeResponses, ex.setExportIncludeResponses],
          ] as const).map(([key, label, checked, setter]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={checked as boolean}
                onChange={(e) => (setter as (v: boolean) => void)(e.target.checked)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              {label}
            </label>
          ))}
        </div>

        <button
          onClick={ex.handleGenerateExport}
          disabled={ex.generatingExport}
          className="bg-brand-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {ex.generatingExport ? "Generating..." : "Generate Authority Pack"}
        </button>
      </div>

      {/* Previous exports */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Export History</h2>

        {incident.exportRuns.length === 0 ? (
          <p className="text-sm text-gray-500">No exports generated yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Date", "Status", "Options", "Completed", "Actions"].map((h, i) => (
                    <th key={h} className={`px-4 py-2 text-xs font-medium text-gray-500 uppercase ${i === 4 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {incident.exportRuns.map((run) => (
                  <tr key={run.id}>
                    <td className="px-4 py-2 text-sm text-gray-700">{formatDateTime(run.createdAt)}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${EXPORT_STATUS_COLORS[run.status] ?? "bg-gray-100 text-gray-700"}`}>{run.status}</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      <div className="flex flex-wrap gap-1">
                        {run.options.includeTimeline && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">Timeline</span>}
                        {run.options.includeDsarList && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">DSARs</span>}
                        {run.options.includeEvidence && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">Evidence</span>}
                        {run.options.includeResponses && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">Responses</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{formatDateTime(run.completedAt)}</td>
                    <td className="px-4 py-2 text-sm text-right">
                      {run.status === "COMPLETED" && (
                        <button onClick={() => ex.handleDownloadExport(run.id)} className="text-brand-600 hover:text-brand-700 text-sm font-medium">Download PDF</button>
                      )}
                      {run.status === "GENERATING" && <span className="text-xs text-blue-600">Processing...</span>}
                      {run.status === "FAILED" && <span className="text-xs text-red-600">Failed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
