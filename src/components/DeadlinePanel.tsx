"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface Deadline {
  id: string;
  receivedAt: string;
  legalDueAt: string;
  extendedDueAt: string | null;
  effectiveDueAt: string;
  extensionDays: number | null;
  extensionReason: string | null;
  extensionNotificationRequired: boolean;
  extensionNotificationSentAt: string | null;
  pausedAt: string | null;
  pauseReason: string | null;
  totalPausedDays: number;
  currentRisk: "GREEN" | "YELLOW" | "RED";
  riskReasons: string[];
  daysRemaining: number;
}

interface Milestone {
  id: string;
  milestoneType: string;
  plannedDueAt: string;
  completedAt: string | null;
}

interface DeadlineEvent {
  id: string;
  eventType: string;
  description: string;
  actor?: { name: string } | null;
  createdAt: string;
}

interface Escalation {
  id: string;
  severity: string;
  reason: string;
  acknowledged: boolean;
  createdAt: string;
}

const RISK_COLORS = {
  GREEN: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500", border: "border-green-200" },
  YELLOW: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500", border: "border-yellow-200" },
  RED: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500", border: "border-red-200" },
};

const MILESTONE_LABELS: Record<string, string> = {
  IDV_COMPLETE: "Identity Verification",
  COLLECTION_COMPLETE: "Data Collection",
  DRAFT_READY: "Draft Response",
  LEGAL_REVIEW_DONE: "Legal Review",
  RESPONSE_SENT: "Response Sent",
};

export default function DeadlinePanel({ caseId, userRole }: { caseId: string; userRole?: string }) {
  const { data: session } = useSession();
  const [deadline, setDeadline] = useState<Deadline | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [events, setEvents] = useState<DeadlineEvent[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);

  // Extension modal
  const [showExtend, setShowExtend] = useState(false);
  const [extDays, setExtDays] = useState(14);
  const [extReason, setExtReason] = useState("");
  const [extending, setExtending] = useState(false);

  // Pause modal
  const [showPause, setShowPause] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [pausing, setPausing] = useState(false);

  const canExtend = userRole && ["SUPER_ADMIN", "TENANT_ADMIN", "DPO", "CASE_MANAGER"].includes(userRole);
  const canPause = userRole && ["SUPER_ADMIN", "TENANT_ADMIN"].includes(userRole);

  const fetchDeadline = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/deadline`);
      if (res.ok) {
        const data = await res.json();
        setDeadline(data.deadline);
        setMilestones(data.milestones ?? []);
        setEvents(data.events ?? []);
        setEscalations(data.escalations ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchDeadline(); }, [fetchDeadline]);

  const handleInitialize = async () => {
    setInitializing(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/deadline`, { method: "POST" });
      if (res.ok) await fetchDeadline();
    } finally {
      setInitializing(false);
    }
  };

  const handleExtend = async () => {
    if (!extReason.trim()) return;
    setExtending(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/deadline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "extend", extensionDays: extDays, reason: extReason }),
      });
      if (res.ok) {
        setShowExtend(false);
        setExtReason("");
        await fetchDeadline();
      }
    } finally {
      setExtending(false);
    }
  };

  const handlePause = async () => {
    if (!pauseReason.trim()) return;
    setPausing(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/deadline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause", reason: pauseReason }),
      });
      if (res.ok) {
        setShowPause(false);
        setPauseReason("");
        await fetchDeadline();
      }
    } finally {
      setPausing(false);
    }
  };

  const handleResume = async () => {
    const res = await fetch(`/api/cases/${caseId}/deadline`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resume" }),
    });
    if (res.ok) await fetchDeadline();
  };

  const handleMarkNotified = async () => {
    const res = await fetch(`/api/cases/${caseId}/deadline`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_notified" }),
    });
    if (res.ok) await fetchDeadline();
  };

  if (loading) {
    return <div className="card animate-pulse"><div className="h-40 rounded bg-gray-100" /></div>;
  }

  if (!deadline) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No deadline tracking</h3>
          <p className="mt-1 text-sm text-gray-500">Initialize deadline tracking for this case.</p>
          <button onClick={handleInitialize} disabled={initializing}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {initializing ? "Initializing..." : "Initialize Deadlines"}
          </button>
        </div>
      </div>
    );
  }

  const rc = RISK_COLORS[deadline.currentRisk];
  const isPaused = !!deadline.pausedAt;
  const extensionPending = deadline.extensionDays && deadline.extensionDays > 0 &&
    deadline.extensionNotificationRequired && !deadline.extensionNotificationSentAt;

  return (
    <div className="space-y-4">
      {/* Risk Banner */}
      <div className={`rounded-lg border p-4 ${rc.border} ${rc.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${rc.dot} ${isPaused ? "animate-pulse" : ""}`} />
            <span className={`text-sm font-semibold ${rc.text}`}>
              {isPaused ? "PAUSED" : deadline.currentRisk} Risk
            </span>
          </div>
          <span className={`text-lg font-bold ${rc.text}`}>
            {isPaused ? "Paused" : `${deadline.daysRemaining}d remaining`}
          </span>
        </div>
        {deadline.riskReasons.length > 0 && (
          <ul className={`mt-2 text-xs ${rc.text} space-y-0.5`}>
            {deadline.riskReasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
      </div>

      {/* Key Dates */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700">Key Dates</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs font-medium text-gray-500">Received</dt>
            <dd className="text-gray-900">{new Date(deadline.receivedAt).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Legal Due</dt>
            <dd className="text-gray-900">{new Date(deadline.legalDueAt).toLocaleDateString()}</dd>
          </div>
          {deadline.extendedDueAt && (
            <div>
              <dt className="text-xs font-medium text-gray-500">Extended Due</dt>
              <dd className="text-gray-900">{new Date(deadline.extendedDueAt).toLocaleDateString()}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium text-gray-500">Effective Due</dt>
            <dd className="font-semibold text-gray-900">{new Date(deadline.effectiveDueAt).toLocaleDateString()}</dd>
          </div>
        </dl>

        {/* Extension Info */}
        {deadline.extensionDays && deadline.extensionDays > 0 && (
          <div className="mt-3 rounded-md bg-blue-50 p-3">
            <p className="text-xs font-medium text-blue-800">
              Extension: +{deadline.extensionDays} days
              {deadline.extensionReason && <span className="font-normal"> — {deadline.extensionReason}</span>}
            </p>
            {extensionPending && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-amber-700">Data subject notification required</span>
                <button onClick={handleMarkNotified}
                  className="text-xs font-medium text-blue-700 underline hover:text-blue-900">
                  Mark as sent
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pause Info */}
        {isPaused && (
          <div className="mt-3 rounded-md bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800">
              Clock paused {deadline.pauseReason && <span className="font-normal">— {deadline.pauseReason}</span>}
            </p>
            {canPause && (
              <button onClick={handleResume} className="mt-2 text-xs font-medium text-amber-700 underline hover:text-amber-900">
                Resume clock
              </button>
            )}
          </div>
        )}
        {deadline.totalPausedDays > 0 && !isPaused && (
          <p className="mt-2 text-xs text-gray-500">Total paused: {deadline.totalPausedDays} day(s)</p>
        )}
      </div>

      {/* Actions */}
      {(canExtend || canPause) && (
        <div className="flex flex-wrap gap-2">
          {canExtend && !isPaused && (
            <button onClick={() => setShowExtend(true)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Request Extension
            </button>
          )}
          {canPause && !isPaused && (
            <button onClick={() => setShowPause(true)} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50">
              Pause Clock
            </button>
          )}
        </div>
      )}

      {/* Extension Modal */}
      {showExtend && (
        <div className="card border-2 border-brand-200">
          <h3 className="text-sm font-semibold text-gray-900">Request Extension</h3>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Extension days</label>
              <input type="number" value={extDays} onChange={(e) => setExtDays(parseInt(e.target.value) || 0)} min={1} max={60}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Reason (required for GDPR Art. 12)</label>
              <textarea value={extReason} onChange={(e) => setExtReason(e.target.value)} rows={2} placeholder="Complexity of request, number of requests..."
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleExtend} disabled={extending || !extReason.trim()}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {extending ? "Applying..." : "Apply Extension"}
              </button>
              <button onClick={() => setShowExtend(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {showPause && (
        <div className="card border-2 border-amber-200">
          <h3 className="text-sm font-semibold text-gray-900">Pause Clock</h3>
          <p className="mt-1 text-xs text-gray-500">Only TENANT_ADMIN can pause. This is exceptional and requires justification.</p>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Reason</label>
              <textarea value={pauseReason} onChange={(e) => setPauseReason(e.target.value)} rows={2} placeholder="Awaiting court order..."
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={handlePause} disabled={pausing || !pauseReason.trim()}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                {pausing ? "Pausing..." : "Pause Clock"}
              </button>
              <button onClick={() => setShowPause(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Milestones */}
      {milestones.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700">Milestones</h3>
          <div className="mt-3 space-y-2">
            {milestones.map((m) => {
              const isOverdue = !m.completedAt && new Date(m.plannedDueAt) < new Date();
              const isDone = !!m.completedAt;
              return (
                <div key={m.id} className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${isDone ? "bg-green-50" : isOverdue ? "bg-red-50" : "bg-gray-50"}`}>
                  <div className="flex items-center gap-2">
                    {isDone ? (
                      <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ) : isOverdue ? (
                      <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                    )}
                    <span className={isDone ? "text-green-800 line-through" : isOverdue ? "font-medium text-red-800" : "text-gray-900"}>
                      {MILESTONE_LABELS[m.milestoneType] ?? m.milestoneType}
                    </span>
                  </div>
                  <span className={`text-xs ${isDone ? "text-green-600" : isOverdue ? "text-red-600" : "text-gray-500"}`}>
                    {isDone ? `Done ${new Date(m.completedAt!).toLocaleDateString()}` : `Due ${new Date(m.plannedDueAt).toLocaleDateString()}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Events */}
      {events.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700">Deadline History</h3>
          <div className="mt-3 space-y-2">
            {events.slice(0, 5).map((ev) => (
              <div key={ev.id} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                <div>
                  <p className="text-gray-700">{ev.description}</p>
                  <p className="text-gray-400">
                    {ev.actor?.name ?? "System"} — {new Date(ev.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Escalations */}
      {escalations.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700">Escalations</h3>
          <div className="mt-3 space-y-2">
            {escalations.map((esc) => (
              <div key={esc.id} className={`rounded-md px-3 py-2 text-xs ${esc.severity === "OVERDUE_BREACH" ? "bg-red-50 text-red-800" : esc.severity === "RED_ALERT" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-800"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{esc.severity.replace(/_/g, " ")}</span>
                  <span className="text-gray-500">{new Date(esc.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="mt-0.5">{esc.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
