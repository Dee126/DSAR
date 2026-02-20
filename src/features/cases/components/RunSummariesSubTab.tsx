"use client";

import type { CopilotRunDetail } from "../types";
import { SUMMARY_TYPES } from "../constants";

interface Props {
  run: CopilotRunDetail;
  generatingSummary: string | null;
  onGenerate: (summaryType: string) => void;
}

export function RunSummariesSubTab({ run, generatingSummary, onGenerate }: Props) {
  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Generate Summary</h3>
        <p className="mt-1 text-sm text-gray-500">Generate AI-powered summaries for this discovery run.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {SUMMARY_TYPES.map((st) => (
            <button key={st.key} onClick={() => onGenerate(st.key)} disabled={generatingSummary !== null}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {generatingSummary === st.key ? (
                <><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />{`Generating ${st.label}...`}</>
              ) : (
                <>{st.label}</>
              )}
            </button>
          ))}
        </div>
      </div>

      {run.summaries.length === 0 ? (
        <div className="card"><p className="text-sm text-gray-500">No summaries generated yet. Use the buttons above to generate one.</p></div>
      ) : (
        run.summaries.map((summary) => (
          <div key={summary.id} className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-semibold text-gray-900">{summary.summaryType.replace(/_/g, " ")}</h4>
                {summary.disclaimerIncluded && <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Disclaimer Included</span>}
              </div>
              <span className="text-xs text-gray-400">{new Date(summary.createdAt).toLocaleString()} by {summary.createdBy.name}</span>
            </div>
            <div className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-700">{summary.content}</div>
          </div>
        ))
      )}
    </div>
  );
}
