"use client";

import Link from "next/link";
import type { Incident } from "../types";
import { useLinkedDsarsTab } from "../hooks/useLinkedDsarsTab";
import { DSAR_STATUS_COLORS, PRIORITY_COLORS } from "../constants";
import { formatDate } from "@/shared/utils";

interface Props {
  incident: Incident;
  incidentId: string;
  onRefresh: () => Promise<unknown>;
}

export function LinkedDsarsTab({ incident, incidentId, onRefresh }: Props) {
  const ld = useLinkedDsarsTab(incidentId, onRefresh);

  return (
    <div className="space-y-6">
      <LinkedCasesSection incident={incident} ld={ld} />
      <SurgeGroupsSection incident={incident} ld={ld} />
    </div>
  );
}

// eslint-disable-next-line
function LinkedCasesSection({ incident, ld }: { incident: Incident; ld: any }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Linked DSAR Cases</h2>
        <button onClick={ld.toggleShowLinkDsar} className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-md hover:bg-brand-700 font-medium">
          {ld.showLinkDsar ? "Cancel" : "Link DSAR"}
        </button>
      </div>

      {ld.showLinkDsar && (
        <div className="mb-6 bg-gray-50 rounded-lg p-4 space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Cases</label>
              <input type="text" value={ld.dsarSearch} onChange={(e: React.ChangeEvent<HTMLInputElement>) => ld.setDsarSearch(e.target.value)} placeholder="Search by case number, subject name..." className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
            </div>
            <button onClick={ld.handleSearchDsars} disabled={ld.dsarSearching} className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
              {ld.dsarSearching ? "Searching..." : "Search"}
            </button>
          </div>

          {ld.dsarOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Case</label>
              <select value={ld.selectedCaseId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => ld.setSelectedCaseId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500">
                <option value="">Choose a case...</option>
                {ld.dsarOptions.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.caseNumber} - {c.dataSubject?.fullName ?? "Unknown"} ({c.status})</option>
                ))}
              </select>
            </div>
          )}

          {ld.selectedCaseId && (
            <form onSubmit={ld.handleLinkDsar} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link Reason</label>
                <input type="text" value={ld.linkReason} onChange={(e: React.ChangeEvent<HTMLInputElement>) => ld.setLinkReason(e.target.value)} placeholder="Reason for linking this DSAR to the incident..." className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={ld.linkingDsar} className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                  {ld.linkingDsar ? "Linking..." : "Link Case"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {incident.linkedDsars.length === 0 ? (
        <p className="text-sm text-gray-500">No DSAR cases linked to this incident yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Case Number", "Type", "Status", "Priority", "Due Date", "Data Subject", "Link Reason", "Actions"].map((h, i) => (
                  <th key={h} className={`px-4 py-2 text-xs font-medium text-gray-500 uppercase ${i === 7 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {incident.linkedDsars.map((linked) => (
                <tr key={linked.id}>
                  <td className="px-4 py-2 text-sm">
                    <Link href={`/cases/${linked.case.id}`} className="text-brand-600 hover:text-brand-700 font-medium">{linked.case.caseNumber}</Link>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">{linked.case.type}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${DSAR_STATUS_COLORS[linked.case.status] ?? "bg-gray-100 text-gray-700"}`}>{linked.case.status}</span>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[linked.case.priority] ?? "bg-gray-100 text-gray-700"}`}>{linked.case.priority}</span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">{formatDate(linked.case.dueDate)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{linked.case.dataSubject?.fullName ?? "—"}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{linked.linkReason ?? "—"}</td>
                  <td className="px-4 py-2 text-sm text-right">
                    <button onClick={() => ld.handleUnlinkDsar(linked.caseId)} disabled={ld.unlinkingCaseId === linked.caseId} className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50">
                      {ld.unlinkingCaseId === linked.caseId ? "Unlinking..." : "Unlink"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SurgeGroupsSection({ incident, ld }: { incident: Incident; ld: any }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Surge Groups</h2>
        <button onClick={() => ld.setShowCreateSurge(!ld.showCreateSurge)} className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-md hover:bg-brand-700 font-medium">
          {ld.showCreateSurge ? "Cancel" : "Create Surge Group"}
        </button>
      </div>

      {ld.showCreateSurge && (
        <form onSubmit={ld.handleCreateSurge} className="mb-4 bg-gray-50 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group Name *</label>
            <input type="text" value={ld.surgeName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => ld.setSurgeName(e.target.value)} required placeholder="e.g. Batch 1 - Affected users" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Case IDs (comma-separated) *</label>
            <input type="text" value={ld.surgeCaseIds} onChange={(e: React.ChangeEvent<HTMLInputElement>) => ld.setSurgeCaseIds(e.target.value)} required placeholder="case-id-1, case-id-2, ..." className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={ld.creatingSurge} className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
              {ld.creatingSurge ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      )}

      {incident.surgeGroups.length === 0 ? (
        <p className="text-sm text-gray-500">No surge groups created yet.</p>
      ) : (
        <div className="space-y-3">
          {incident.surgeGroups.map((sg) => (
            <div key={sg.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">{sg.name}</h3>
                <span className="text-xs text-gray-500">Created {formatDate(sg.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-600">{sg.caseIds.length} case{sg.caseIds.length !== 1 ? "s" : ""}</p>
              {sg.caseIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {sg.caseIds.map((cid) => (
                    <span key={cid} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 font-mono">{cid.substring(0, 8)}...</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
