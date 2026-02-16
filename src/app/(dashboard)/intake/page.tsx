"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Submission {
  id: string;
  reference: string;
  channel: string;
  status: string;
  preferredLanguage: string;
  requestTypes: string[] | null;
  subjectType: string | null;
  subjectEmail: string | null;
  subjectName: string | null;
  receivedAt: string;
  case: { id: string; caseNumber: string; status: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  PROCESSED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  SPAM: "bg-gray-100 text-gray-800",
};

const CHANNEL_ICONS: Record<string, string> = {
  WEB: "W",
  EMAIL: "E",
  MANUAL: "M",
};

export default function IntakeInboxPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));
      if (statusFilter) params.set("status", statusFilter);
      if (channelFilter) params.set("channel", channelFilter);

      const res = await fetch(`/api/intake/submissions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSubmissions(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Failed to load submissions:", err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, channelFilter]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  async function handleMarkSpam(id: string) {
    if (!confirm("Mark this submission as spam?")) return;
    try {
      await fetch(`/api/intake/submissions/${id}/spam`, { method: "POST" });
      fetchSubmissions();
    } catch (err) {
      console.error("Failed to mark spam:", err);
    }
  }

  async function handleCreateCase(id: string) {
    try {
      const res = await fetch(`/api/intake/submissions/${id}/create-case`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to create case");
        return;
      }
      const result = await res.json();
      alert(`Case ${result.caseNumber} created${result.dedupeCount > 0 ? ` (${result.dedupeCount} potential duplicate(s) detected)` : ""}`);
      fetchSubmissions();
    } catch (err) {
      console.error("Failed to create case:", err);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Intake Inbox</h1>
          <p className="text-sm text-gray-500">DSAR submissions from web portal, email, and manual entry</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{pagination.total} submission{pagination.total !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="NEW">New</option>
          <option value="PROCESSED">Processed</option>
          <option value="REJECTED">Rejected</option>
          <option value="SPAM">Spam</option>
        </select>

        <select
          value={channelFilter}
          onChange={(e) => {
            setChannelFilter(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All channels</option>
          <option value="WEB">Web Portal</option>
          <option value="EMAIL">Email</option>
          <option value="MANUAL">Manual</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Reference</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Channel</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Subject</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type(s)</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Received</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Case</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">Loading...</td>
              </tr>
            ) : submissions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No submissions found</td>
              </tr>
            ) : (
              submissions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link href={`/intake/${s.id}`} className="font-mono text-sm font-medium text-blue-600 hover:text-blue-800">
                      {s.reference}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-xs font-bold text-gray-700" title={s.channel}>
                      {CHANNEL_ICONS[s.channel] || "?"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div>{s.subjectName || "---"}</div>
                    <div className="text-xs text-gray-500">{s.subjectEmail || ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(s.requestTypes || []).map((t: string) => (
                        <span key={t} className="inline-block rounded bg-purple-50 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status] || ""}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {new Date(s.receivedAt).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {s.case ? (
                      <Link href={`/cases/${s.case.id}`} className="text-blue-600 hover:text-blue-800">
                        {s.case.caseNumber}
                      </Link>
                    ) : (
                      <span className="text-gray-400">---</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      {s.status === "NEW" && !s.case && (
                        <>
                          <button
                            onClick={() => handleCreateCase(s.id)}
                            className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                          >
                            Create Case
                          </button>
                          <button
                            onClick={() => handleMarkSpam(s.id)}
                            className="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300"
                          >
                            Spam
                          </button>
                        </>
                      )}
                      <Link
                        href={`/intake/${s.id}`}
                        className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
