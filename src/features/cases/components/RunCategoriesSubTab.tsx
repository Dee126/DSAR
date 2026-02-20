"use client";

import { CATEGORY_COLORS, SEVERITY_COLORS } from "../constants";

interface CategoryStat {
  category: string;
  count: number;
  maxSeverity: string;
  isSpecial: boolean;
}

interface Props {
  categoryStats: CategoryStat[];
}

export function RunCategoriesSubTab({ categoryStats }: Props) {
  return (
    <div className="card">
      <h3 className="text-base font-semibold text-gray-900">Data Categories Overview</h3>
      {categoryStats.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No categories identified yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categoryStats.map(({ category, count, maxSeverity, isSpecial }) => (
            <div key={category} className={`rounded-lg border p-4 ${isSpecial ? "border-red-200 bg-red-50/50" : "border-gray-200"}`}>
              <div className="flex items-center justify-between">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-700"}`}>{category.replace(/_/g, " ")}</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[maxSeverity] ?? "bg-gray-100 text-gray-700"}`}>{maxSeverity}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-500">finding{count !== 1 ? "s" : ""}</p>
              {isSpecial && (
                <div className="mt-2 flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                  <span className="text-xs font-medium text-red-600">Special Category (Art. 9)</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
