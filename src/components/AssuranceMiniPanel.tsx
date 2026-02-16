"use client";

import { useEffect, useState } from "react";

interface AccessLogEntry {
  id: string;
  accessType: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  outcome: string;
  user?: { name: string } | null;
}

interface RetentionTimer {
  artifactType: string;
  retentionDays: number;
  deleteMode: string;
  oldestArtifactDate: string | null;
  daysRemaining: number | null;
}

interface LegalHold {
  id: string;
  reason: string;
  enabledAt: string;
}

interface AssuranceData {
  legalHoldActive: boolean;
  legalHold: LegalHold | null;
  recentAccessLogs: AccessLogEntry[];
  retentionTimers: RetentionTimer[];
}

export default function AssuranceMiniPanel({ caseId }: { caseId: string }) {
  const [data, setData] = useState<AssuranceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/assurance/case/${caseId}`);
        if (res.ok) setData(await res.json());
      } catch {
        // Assurance panel is non-blocking
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [caseId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-medium text-gray-900">Assurance</h3>
        <p className="mt-2 text-xs text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Assurance</h3>

      {/* Legal Hold Status */}
      <div>
        {data.legalHoldActive ? (
          <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2">
            <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-xs font-medium text-red-800">Legal Hold Active</p>
              <p className="text-xs text-red-600">{data.legalHold?.reason}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No legal hold active
          </div>
        )}
      </div>

      {/* Recent Access Events */}
      {data.recentAccessLogs.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-700 mb-2">Recent Access</h4>
          <div className="space-y-1">
            {data.recentAccessLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">
                  {log.user?.name || "Public"} - {log.accessType} {log.resourceType.replace(/_/g, " ")}
                </span>
                <span className={log.outcome === "ALLOWED" ? "text-green-600" : "text-red-600"}>
                  {log.outcome}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Retention Timers */}
      {data.retentionTimers.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-700 mb-2">Retention Timers</h4>
          <div className="space-y-2">
            {data.retentionTimers.map((timer, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-xs text-gray-600">{timer.artifactType.replace(/_/g, " ")}</span>
                <span className={`text-xs font-medium ${
                  timer.daysRemaining !== null && timer.daysRemaining <= 30 ? "text-red-600" :
                  timer.daysRemaining !== null && timer.daysRemaining <= 90 ? "text-yellow-600" :
                  "text-gray-600"
                }`}>
                  {timer.daysRemaining !== null ? `${timer.daysRemaining}d remaining` : "-"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
