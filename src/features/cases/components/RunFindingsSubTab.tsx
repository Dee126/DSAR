"use client";

import type { CopilotFinding } from "../types";
import { CATEGORY_COLORS, SEVERITY_COLORS, SPECIAL_CATEGORIES } from "../constants";

interface Props {
  findingsByCategory: Record<string, CopilotFinding[]>;
}

export function RunFindingsSubTab({ findingsByCategory }: Props) {
  const entries = Object.entries(findingsByCategory);

  if (entries.length === 0) {
    return <div className="card"><p className="text-sm text-gray-500">No findings yet.</p></div>;
  }

  return (
    <div className="space-y-6">
      {entries.map(([category, findings]) => (
        <div key={category} className="card">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-gray-900">{category.replace(/_/g, " ")}</h3>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-700"}`}>{findings.length} finding{findings.length !== 1 ? "s" : ""}</span>
            {SPECIAL_CATEGORIES.includes(category) && <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Special Category</span>}
          </div>
          <div className="mt-4 space-y-3">
            {findings.map((finding) => (
              <div key={finding.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[finding.severity] ?? "bg-gray-100 text-gray-700"}`}>{finding.severity}</span>
                      <span className="text-sm text-gray-500">{Math.round(finding.confidence * 100)}% confidence</span>
                      {finding.containsSpecialCategory && <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Special Category</span>}
                      {finding.requiresLegalReview && <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Legal Review Required</span>}
                      {finding.containsThirdPartyDataSuspected && <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Third-Party Data</span>}
                    </div>
                    <p className="mt-2 text-sm text-gray-700">{finding.summary}</p>
                    <p className="mt-1 text-xs text-gray-500">{finding.evidenceItemIds.length} evidence item{finding.evidenceItemIds.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
