"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

/* ── Display helpers ──────────────────────────────────────────────────── */

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  IDENTITY_VERIFICATION: "Identity Verification",
  INTAKE_TRIAGE: "Intake & Triage",
  DATA_COLLECTION: "Data Collection",
  REVIEW_LEGAL: "Legal Review",
  RESPONSE_PREPARATION: "Response Preparation",
  RESPONSE_SENT: "Response Sent",
  CLOSED: "Closed",
  REJECTED: "Rejected",
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  IDENTITY_VERIFICATION: "bg-yellow-100 text-yellow-800",
  INTAKE_TRIAGE: "bg-orange-100 text-orange-800",
  DATA_COLLECTION: "bg-purple-100 text-purple-800",
  REVIEW_LEGAL: "bg-indigo-100 text-indigo-800",
  RESPONSE_PREPARATION: "bg-cyan-100 text-cyan-800",
  RESPONSE_SENT: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
  REJECTED: "bg-red-100 text-red-800",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

function getSlaIndicator(dueDate: string): "ok" | "due_soon" | "overdue" {
  const diff =
    (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "overdue";
  if (diff <= 7) return "due_soon";
  return "ok";
}

/* ── Types ────────────────────────────────────────────────────────────── */

interface CaseUser {
  id: string;
  name: string;
  email: string;
}

interface DSARCase {
  id: string;
  caseNumber: string;
  type: string;
  status: string;
  priority: string;
  dueDate: string;
  receivedAt: string;
  createdAt: string;
  assignedTo: CaseUser | null;
  assignedToUserId: string | null;
  dataSubject: { fullName: string; email?: string };
}

/* ── Component ────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { data: session } = useSession();
  const [cases, setCases] = useState<DSARCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [integrationHealth, setIntegrationHealth] = useState<{
    total: number;
    connected: number;
    issues: number;
    lastSuccessAt: string | null;
  } | null>(null);
  const [copilotStats, setCopilotStats] = useState<{
    totalRuns: number;
    completedRuns: number;
    art9Runs: number;
    totalFindings: number;
    recentRuns: Array<{
      id: string;
      status: string;
      totalFindings: number;
      art9Flagged: boolean;
      art9ReviewStatus: string | null;
      createdAt: string;
      completedAt: string | null;
      case: { id: string; caseNumber: string; dataSubject: { fullName: string } };
      createdBy: { name: string };
    }>;
  } | null>(null);

  useEffect(() => {
    async function fetchCases() {
      try {
        const res = await fetch("/api/cases?limit=100");
        if (res.ok) {
          const json = await res.json();
          setCases(json.data ?? []);
        }
      } catch {
        /* silently fail */
      } finally {
        setLoading(false);
      }
    }
    fetchCases();
  }, []);

  useEffect(() => {
    async function fetchIntegrationHealth() {
      try {
        const res = await fetch("/api/integrations/health");
        if (res.ok) {
          setIntegrationHealth(await res.json());
        }
      } catch {
        /* silently fail */
      }
    }
    fetchIntegrationHealth();
  }, []);

  useEffect(() => {
    async function fetchCopilotStats() {
      try {
        const res = await fetch("/api/copilot/stats");
        if (res.ok) {
          setCopilotStats(await res.json());
        }
      } catch {
        /* silently fail */
      }
    }
    fetchCopilotStats();
  }, []);

  const CLOSED_STATUSES = ["CLOSED", "REJECTED"];
  const openCases = cases.filter((c) => !CLOSED_STATUSES.includes(c.status));
  const dueSoonCases = cases.filter(
    (c) =>
      !CLOSED_STATUSES.includes(c.status) &&
      getSlaIndicator(c.dueDate) === "due_soon"
  );
  const overdueCases = cases.filter(
    (c) =>
      !CLOSED_STATUSES.includes(c.status) &&
      getSlaIndicator(c.dueDate) === "overdue"
  );
  const assignedToMe = cases.filter(
    (c) =>
      !CLOSED_STATUSES.includes(c.status) &&
      c.assignedToUserId === session?.user?.id
  );
  const recentCases = cases.slice(0, 5);

  const stats = [
    {
      label: "Total Cases",
      value: cases.length,
      color: "text-gray-900",
      bg: "bg-white",
      icon: (
        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
      ),
    },
    {
      label: "Open Cases",
      value: openCases.length,
      color: "text-brand-600",
      bg: "bg-white",
      icon: (
        <svg className="h-6 w-6 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
        </svg>
      ),
    },
    {
      label: "Due Soon",
      value: dueSoonCases.length,
      color: "text-yellow-600",
      bg: "bg-white",
      icon: (
        <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      ),
    },
    {
      label: "Overdue",
      value: overdueCases.length,
      color: "text-red-600",
      bg: "bg-white",
      icon: (
        <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      ),
    },
    {
      label: "Assigned to Me",
      value: assignedToMe.length,
      color: "text-brand-600",
      bg: "bg-white",
      icon: (
        <svg className="h-6 w-6 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {session?.user?.name?.split(" ")[0] ?? "User"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here is an overview of your DSAR case activity.
        </p>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 w-20 rounded bg-gray-200" />
              <div className="mt-3 h-8 w-12 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((stat, idx) => (
            <div key={stat.label} className={`card ${stat.bg}`} data-testid={idx === 0 ? "stat-total" : idx === 1 ? "stat-open" : undefined}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  {stat.label}
                </p>
                {stat.icon}
              </div>
              <p className={`mt-2 text-3xl font-bold ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Integration Health Widget */}
      {integrationHealth && integrationHealth.total > 0 && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                integrationHealth.issues > 0 ? "bg-red-100" : "bg-green-100"
              }`}>
                <svg className={`h-5 w-5 ${integrationHealth.issues > 0 ? "text-red-600" : "text-green-600"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Integration Health</h3>
                <div className="mt-0.5 flex items-center gap-4 text-xs text-gray-500">
                  <span>
                    <span className="font-medium text-gray-700">{integrationHealth.connected}</span>/{integrationHealth.total} connected
                  </span>
                  {integrationHealth.issues > 0 && (
                    <span className="font-medium text-red-600">
                      {integrationHealth.issues} issue{integrationHealth.issues !== 1 ? "s" : ""}
                    </span>
                  )}
                  {integrationHealth.lastSuccessAt && (
                    <span>
                      Last sync: {new Date(integrationHealth.lastSuccessAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Link
              href="/integrations"
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Manage Integrations
            </Link>
          </div>
        </div>
      )}

      {/* Privacy Copilot Widget */}
      {copilotStats && copilotStats.totalRuns > 0 && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                <svg className="h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Privacy Copilot</h3>
                <div className="mt-0.5 flex items-center gap-4 text-xs text-gray-500">
                  <span>
                    <span className="font-medium text-gray-700">{copilotStats.completedRuns}</span>/{copilotStats.totalRuns} runs completed
                  </span>
                  <span>
                    <span className="font-medium text-gray-700">{copilotStats.totalFindings}</span> findings
                  </span>
                  {copilotStats.art9Runs > 0 && (
                    <span className="font-medium text-red-600">
                      {copilotStats.art9Runs} Art.&nbsp;9 flagged
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Copilot Runs */}
          {copilotStats.recentRuns.length > 0 && (
            <div className="mt-4 space-y-2">
              {copilotStats.recentRuns.slice(0, 3).map((run) => (
                <Link
                  key={run.id}
                  href={`/cases/${run.case.id}?tab=copilot`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      run.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                      run.status === "RUNNING" ? "bg-yellow-100 text-yellow-700" :
                      run.status === "FAILED" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {run.status}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{run.case.caseNumber}</span>
                    <span className="text-sm text-gray-500">{run.case.dataSubject.fullName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{run.totalFindings} findings</span>
                    {run.art9Flagged && <span className="font-medium text-red-500">Art. 9</span>}
                    <span>{new Date(run.createdAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Cases Table */}
      <div className="card p-0">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Cases</h2>
          <Link
            href="/cases"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            View all
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : recentCases.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">
              No cases yet. Create your first case to get started.
            </p>
            <Link href="/cases/new" className="btn-primary mt-4 inline-flex">
              Create Case
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-3">Case #</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Priority</th>
                  <th className="px-6 py-3">Due Date</th>
                  <th className="px-6 py-3">Assignee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentCases.map((c) => {
                  const sla = getSlaIndicator(c.dueDate);
                  return (
                    <tr
                      key={c.id}
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                      onClick={() =>
                        (window.location.href = `/cases/${c.id}`)
                      }
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-brand-600">
                        {c.caseNumber}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {c.type}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {STATUS_LABELS[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            PRIORITY_COLORS[c.priority] ??
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {c.priority}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span
                          className={`flex items-center gap-1.5 ${
                            sla === "overdue"
                              ? "text-red-600"
                              : sla === "due_soon"
                              ? "text-yellow-600"
                              : "text-gray-700"
                          }`}
                        >
                          {sla === "overdue" && (
                            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                          )}
                          {sla === "due_soon" && (
                            <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
                          )}
                          {new Date(c.dueDate).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {c.assignedTo?.name ?? (
                          <span className="text-gray-400">Unassigned</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
