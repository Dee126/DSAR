"use client";

import type { CopilotEvidenceItem } from "../types";
import { EVIDENCE_PAGE_SIZE } from "../constants";

interface Props {
  paginatedEvidence: CopilotEvidenceItem[];
  totalItems: number;
  evidencePage: number;
  totalPages: number;
  onPageChange: (page: number | ((p: number) => number)) => void;
}

export function RunEvidenceSubTab({ paginatedEvidence, totalItems, evidencePage, totalPages, onPageChange }: Props) {
  return (
    <div className="card">
      <h3 className="text-base font-semibold text-gray-900">Evidence Items ({totalItems})</h3>
      {totalItems === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No evidence items collected yet.</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="pb-2 pr-4">Provider</th>
                  <th className="pb-2 pr-4">Location</th>
                  <th className="pb-2 pr-4">Title</th>
                  <th className="pb-2 pr-4">Item Type</th>
                  <th className="pb-2 pr-4">Content Handling</th>
                  <th className="pb-2 pr-4">Sensitivity</th>
                  <th className="pb-2">Detectors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedEvidence.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{item.provider}</td>
                    <td className="py-2.5 pr-4 text-gray-700 max-w-[200px] truncate" title={item.location}>{item.location}</td>
                    <td className="py-2.5 pr-4 text-gray-700 max-w-[200px] truncate" title={item.title}>{item.title}</td>
                    <td className="py-2.5 pr-4"><span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{item.itemType}</span></td>
                    <td className="py-2.5 pr-4 text-gray-500 text-xs">{item.contentHandling}</td>
                    <td className="py-2.5 pr-4">
                      {item.sensitivityScore != null ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${item.sensitivityScore >= 0.7 ? "bg-red-100 text-red-700" : item.sensitivityScore >= 0.4 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                          {Math.round(item.sensitivityScore * 100)}%
                        </span>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="py-2.5"><span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{item.detectorResults.length}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
              <p className="text-sm text-gray-500">Showing {evidencePage * EVIDENCE_PAGE_SIZE + 1}&ndash;{Math.min((evidencePage + 1) * EVIDENCE_PAGE_SIZE, totalItems)} of {totalItems}</p>
              <div className="flex gap-2">
                <button onClick={() => onPageChange((p: number) => Math.max(0, p - 1))} disabled={evidencePage === 0} className="btn-secondary text-sm disabled:opacity-50">Previous</button>
                <button onClick={() => onPageChange((p: number) => Math.min(totalPages - 1, p + 1))} disabled={evidencePage >= totalPages - 1} className="btn-secondary text-sm disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
