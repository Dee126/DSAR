"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ── Types ────────────────────────────────────────────────────────────── */

interface CopilotRunItem {
  id: string;
  status: string;
  reason: string;
  totalFindings: number;
  art9Flagged: boolean;
  art9ReviewStatus: string | null;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  case: {
    id: string;
    caseNumber: string;
    dataSubject: { fullName: string };
  };
  createdBy: { name: string };
}

const STATUS_COLORS: Record<string, string> = {
  CREATED: "bg-blue-100 text-blue-700",
  RUNNING: "bg-yellow-100 text-yellow-700 animate-pulse",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

/* ── Component ────────────────────────────────────────────────────────── */

export default function CopilotPage() {
  const [stats, setStats] = useState<{
    totalRuns: number;
    completedRuns: number;
    art9Runs: number;
    totalFindings: number;
    recentRuns: CopilotRunItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/copilot/stats");
        if (res.ok) {
          setStats(await res.json());
        }
      } catch {
        /* silently fail */
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Privacy Copilot</h1>
          <p className="mt-1 text-sm text-gray-500">AI-powered DSAR data discovery across all connected systems.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 w-20 rounded bg-gray-200" />
              <div className="mt-3 h-8 w-12 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Privacy Copilot</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI-powered DSAR data discovery across all connected systems. Start a discovery run from any case&apos;s Copilot tab.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">Total Runs</p>
              <svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalRuns}</p>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">Completed</p>
              <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="mt-2 text-3xl font-bold text-green-600">{stats.completedRuns}</p>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">Total Findings</p>
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <p className="mt-2 text-3xl font-bold text-blue-600">{stats.totalFindings}</p>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">Art. 9 Flagged</p>
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <p className="mt-2 text-3xl font-bold text-red-600">{stats.art9Runs}</p>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">How it Works</h2>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">1</div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Search</h3>
              <p className="mt-1 text-sm text-gray-500">Automated queries across all connected integrations (M365, Exchange, SharePoint, OneDrive) for the data subject.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">2</div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Detect &amp; Classify</h3>
              <p className="mt-1 text-sm text-gray-500">PII pattern detection (IBAN, credit card, email, phone) and GDPR data category classification with Art. 9 special category flagging.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">3</div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Evidence-Based Results</h3>
              <p className="mt-1 text-sm text-gray-500">Structured findings with full audit trail. No hallucinations — every result is linked to real evidence from your systems.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Runs */}
      <div className="card p-0">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Discovery Runs</h2>
        </div>

        {!stats || stats.recentRuns.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No discovery runs yet.</p>
            <p className="mt-1 text-sm text-gray-400">Open a case and navigate to the Copilot tab to start a discovery run.</p>
            <Link href="/cases" className="btn-primary mt-4 inline-flex">
              View Cases
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-3">Case</th>
                  <th className="px-6 py-3">Data Subject</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Findings</th>
                  <th className="px-6 py-3">Art. 9</th>
                  <th className="px-6 py-3">Started By</th>
                  <th className="px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.recentRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                    onClick={() => window.location.href = `/cases/${run.case.id}?tab=copilot`}
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-brand-600">
                      {run.case.caseNumber}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {run.case.dataSubject.fullName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[run.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {run.totalFindings}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {run.art9Flagged ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                          {run.art9ReviewStatus === "APPROVED" ? "Approved" : run.art9ReviewStatus === "BLOCKED" ? "Blocked" : "Pending Review"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {run.createdBy.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </td>
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
