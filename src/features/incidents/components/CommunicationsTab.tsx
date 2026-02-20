"use client";

import type { Incident } from "../types";
import { useCommunicationsTab } from "../hooks/useCommunicationsTab";
import { COMMUNICATION_CHANNELS, COMMUNICATION_DIRECTIONS } from "../constants";
import { formatDate } from "@/shared/utils";

interface Props {
  incident: Incident;
  incidentId: string;
  onRefresh: () => Promise<unknown>;
}

export function CommunicationsTab({ incident, incidentId, onRefresh }: Props) {
  const cm = useCommunicationsTab(incidentId, onRefresh);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Communications</h2>
          <button onClick={() => cm.setShowAddComm(!cm.showAddComm)} className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-md hover:bg-brand-700 font-medium">
            {cm.showAddComm ? "Cancel" : "Add Communication"}
          </button>
        </div>

        {cm.showAddComm && (
          <form onSubmit={cm.handleAddComm} className="mb-6 bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
                <select value={cm.commDirection} onChange={(e) => cm.setCommDirection(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500">
                  {COMMUNICATION_DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                <select value={cm.commChannel} onChange={(e) => cm.setCommChannel(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500">
                  {COMMUNICATION_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient</label>
                <input type="text" value={cm.commRecipient} onChange={(e) => cm.setCommRecipient(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input type="text" value={cm.commSubject} onChange={(e) => cm.setCommSubject(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
              <textarea value={cm.commBody} onChange={(e) => cm.setCommBody(e.target.value)} rows={4} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={cm.addingComm} className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                {cm.addingComm ? "Sending..." : "Add Communication"}
              </button>
            </div>
          </form>
        )}

        {incident.communications.length === 0 ? (
          <p className="text-sm text-gray-500">No communications recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Direction", "Channel", "Recipient", "Subject", "Date"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {incident.communications.map((comm) => (
                  <tr key={comm.id}>
                    <td className="px-4 py-2 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${comm.direction === "INBOUND" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                        {comm.direction}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{comm.channel}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{comm.recipient ?? "—"}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{comm.subject ?? "—"}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{formatDate(comm.sentAt)}</td>
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
