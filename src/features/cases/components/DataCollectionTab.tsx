"use client";

import type { DSARCaseDetail, SystemItem } from "../types";
import { DC_STATUS_COLORS, DC_STATUSES } from "../constants";

interface Props {
  caseData: DSARCaseDetail;
  systems: SystemItem[];
  canManage: boolean;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  dc: any;
}

export function DataCollectionTab({ caseData, systems, canManage, dc }: Props) {
  return (
    <div className="space-y-6">
      {canManage && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">Add Data Source</h2>
          <form onSubmit={dc.handleAddDataCollection} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">System <span className="text-red-500">*</span></label><select value={dc.dcSystem} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dc.setDcSystem(e.target.value)} className="input-field"><option value="">Select system...</option>{systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className="label">Query Spec</label><input type="text" value={dc.dcQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => dc.setDcQuery(e.target.value)} className="input-field" placeholder="e.g., SELECT * WHERE email = ..." /></div>
            </div>
            <div className="flex justify-end"><button type="submit" disabled={!dc.dcSystem || dc.addingDc} className="btn-primary text-sm">{dc.addingDc ? "Adding..." : "Add Data Source"}</button></div>
          </form>
        </div>
      )}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Data Sources ({caseData.dataCollectionItems?.length ?? 0})</h2>
        {!caseData.dataCollectionItems?.length ? <p className="mt-4 text-sm text-gray-500">No data collection items yet.</p> : (
          <div className="mt-4 space-y-3">
            {caseData.dataCollectionItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3"><p className="text-sm font-medium text-gray-900">{item.system.name}</p><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${DC_STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-700"}`}>{item.status.replace(/_/g, " ")}</span></div>
                    {item.system.owner && <p className="mt-0.5 text-xs text-gray-500">Owner: {item.system.owner}</p>}
                    {item.querySpec && <p className="mt-1 text-xs font-mono text-gray-600">{item.querySpec}</p>}
                    {item.findingsSummary && <p className="mt-1 text-sm text-gray-700">{item.findingsSummary}</p>}
                    {item.recordsFound != null && <p className="mt-0.5 text-xs text-gray-500">Records found: {item.recordsFound}</p>}
                    {item.completedAt && <p className="mt-0.5 text-xs text-gray-400">Completed: {new Date(item.completedAt).toLocaleString()}</p>}
                  </div>
                  {canManage && <select value={item.status} onChange={(e) => dc.handleUpdateDcStatus(item.id, e.target.value)} className="ml-4 rounded-md border border-gray-300 py-1 pl-2 pr-7 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">{DC_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
