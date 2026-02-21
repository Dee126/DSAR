"use client";

import { useCallback, useEffect, useState } from "react";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface AuditEvent {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "items.auto_proposed": { label: "Auto-Proposed Assets", color: "bg-blue-100 text-blue-700" },
  "item.included": { label: "Item Included", color: "bg-green-100 text-green-700" },
  "item.excluded": { label: "Item Excluded", color: "bg-red-100 text-red-700" },
  "export.evidence_pack": { label: "Evidence Pack Exported", color: "bg-purple-100 text-purple-700" },
};

function formatAction(action: string) {
  const mapped = ACTION_LABELS[action];
  if (mapped) return mapped;
  return { label: action.replace(/[._]/g, " "), color: "bg-gray-100 text-gray-700" };
}

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return "";
  const entries = Object.entries(details)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => {
      const key = k.replace(/([A-Z])/g, " $1").toLowerCase();
      if (Array.isArray(v)) return `${key}: ${v.join(", ")}`;
      if (typeof v === "object") return `${key}: ${JSON.stringify(v)}`;
      return `${key}: ${v}`;
    });
  return entries.join(" | ");
}

/* ── Component ──────────────────────────────────────────────────────────── */

export default function DsarAuditTrailPanel({ caseId }: { caseId: string }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/audit-events`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEvents(data.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
        Failed to load audit trail: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          DSAR Audit Trail
        </h2>
        <p className="text-xs text-gray-500">
          All data-asset actions for this case: proposals, decisions, and exports.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="card py-10 text-center">
          <p className="text-sm text-gray-500">
            No audit events yet. Actions will appear here when data assets are
            proposed, reviewed, or exported.
          </p>
        </div>
      ) : (
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

          {events.map((event) => {
            const { label, color } = formatAction(event.action);
            const detailsStr = formatDetails(event.details);

            return (
              <div key={event.id} className="relative flex gap-4 py-3 pl-10">
                {/* Dot */}
                <div className="absolute left-[11px] top-[18px] h-2.5 w-2.5 rounded-full border-2 border-white bg-gray-400" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${color}`}
                    >
                      {label}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-600">
                    <span className="font-medium">
                      {event.actor?.name ?? "System"}
                    </span>
                    {event.entityType && (
                      <span className="text-gray-400">
                        on {event.entityType}
                        {event.entityId ? ` (${event.entityId.slice(0, 8)}...)` : ""}
                      </span>
                    )}
                  </div>

                  {detailsStr && (
                    <p className="mt-0.5 text-[11px] text-gray-400 truncate">
                      {detailsStr}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
