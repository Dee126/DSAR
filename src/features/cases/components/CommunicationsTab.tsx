"use client";

import type { DSARCaseDetail } from "../types";

interface Props {
  caseData: DSARCaseDetail;
  canManage: boolean;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  cm: any;
}

export function CommunicationsTab({ caseData, canManage, cm }: Props) {
  return (
    <div className="space-y-6">
      {canManage && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">Log Communication</h2>
          <form onSubmit={cm.handleAddCommunication} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Direction</label><select value={cm.commDirection} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => cm.setCommDirection(e.target.value)} className="input-field"><option value="OUTBOUND">Outbound</option><option value="INBOUND">Inbound</option></select></div>
              <div><label className="label">Channel</label><select value={cm.commChannel} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => cm.setCommChannel(e.target.value)} className="input-field"><option value="EMAIL">Email</option><option value="LETTER">Letter</option><option value="PORTAL">Portal</option><option value="PHONE">Phone</option></select></div>
            </div>
            <div><label className="label">Subject</label><input type="text" value={cm.commSubject} onChange={(e: React.ChangeEvent<HTMLInputElement>) => cm.setCommSubject(e.target.value)} className="input-field" placeholder="Subject line" /></div>
            <div><label className="label">Body <span className="text-red-500">*</span></label><textarea value={cm.commBody} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => cm.setCommBody(e.target.value)} rows={4} className="input-field resize-y" placeholder="Communication content..." /></div>
            <div className="flex justify-end"><button type="submit" disabled={!cm.commBody.trim() || cm.addingComm} className="btn-primary text-sm">{cm.addingComm ? "Saving..." : "Log Communication"}</button></div>
          </form>
        </div>
      )}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Communication History ({caseData.communicationLogs?.length ?? 0})</h2>
        {!caseData.communicationLogs?.length ? <p className="mt-4 text-sm text-gray-500">No communications logged yet.</p> : (
          <div className="mt-4 space-y-3">
            {caseData.communicationLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${log.direction === "INBOUND" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{log.direction}</span>
                  <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">{log.channel}</span>
                  <span className="text-xs text-gray-400">{new Date(log.sentAt).toLocaleString()}</span>
                </div>
                {log.subject && <p className="mt-2 text-sm font-medium text-gray-900">{log.subject}</p>}
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{log.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
