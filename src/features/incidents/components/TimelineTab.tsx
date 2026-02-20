"use client";

import type { Incident } from "../types";
import { useTimelineTab } from "../hooks/useTimelineTab";
import { TIMELINE_EVENT_TYPES, TIMELINE_EVENT_LABELS, TIMELINE_EVENT_COLORS } from "../constants";
import { formatDateTime } from "@/shared/utils";

interface Props {
  incident: Incident;
  incidentId: string;
  onRefresh: () => Promise<unknown>;
}

export function TimelineTab({ incident, incidentId, onRefresh }: Props) {
  const tl = useTimelineTab(incidentId, onRefresh);

  const sortedEvents = [...incident.timeline].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Incident Timeline</h2>
          <button
            onClick={() => tl.setShowAddTimeline(!tl.showAddTimeline)}
            className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-md hover:bg-brand-700 font-medium"
          >
            {tl.showAddTimeline ? "Cancel" : "Add Event"}
          </button>
        </div>

        {tl.showAddTimeline && (
          <form onSubmit={tl.handleAddTimeline} className="mb-6 bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Type *</label>
                <select value={tl.tlEventType} onChange={(e) => tl.setTlEventType(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500">
                  {TIMELINE_EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>{TIMELINE_EVENT_LABELS[t] ?? t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Occurred At</label>
                <input type="datetime-local" value={tl.tlOccurredAt} onChange={(e) => tl.setTlOccurredAt(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea value={tl.tlDescription} onChange={(e) => tl.setTlDescription(e.target.value)} required rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={tl.addingTimeline} className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                {tl.addingTimeline ? "Adding..." : "Add Event"}
              </button>
            </div>
          </form>
        )}

        {sortedEvents.length === 0 ? (
          <p className="text-sm text-gray-500">No timeline events recorded yet.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-6">
              {sortedEvents.map((ev) => (
                <div key={ev.id} className="relative flex items-start ml-4 pl-6">
                  <div className={`absolute -left-[7px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${TIMELINE_EVENT_COLORS[ev.eventType] ?? "bg-gray-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white ${TIMELINE_EVENT_COLORS[ev.eventType] ?? "bg-gray-500"}`}>
                        {TIMELINE_EVENT_LABELS[ev.eventType] ?? ev.eventType}
                      </span>
                      <span className="text-xs text-gray-500">{formatDateTime(ev.occurredAt)}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{ev.description}</p>
                    {ev.createdBy && <p className="text-xs text-gray-400 mt-1">by {ev.createdBy.name}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
