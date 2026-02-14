"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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

const DSAR_TYPES = [
  "ACCESS",
  "ERASURE",
  "RECTIFICATION",
  "RESTRICTION",
  "PORTABILITY",
  "OBJECTION",
];

const CASE_STATUSES = [
  "NEW",
  "IDENTITY_VERIFICATION",
  "INTAKE_TRIAGE",
  "DATA_COLLECTION",
  "REVIEW_LEGAL",
  "RESPONSE_PREPARATION",
  "RESPONSE_SENT",
  "CLOSED",
  "REJECTED",
];

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
  dataSubject: { fullName: string; email?: string };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* ── Component ────────────────────────────────────────────────────────── */

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<DSARCase[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<CaseUser[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      if (assigneeFilter) params.set("assignee", assigneeFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/cases?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setCases(json.data ?? []);
        setPagination(json.pagination ?? pagination);
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, assigneeFilter, search]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const json = await res.json();
          setUsers(Array.isArray(json) ? json : json.data ?? []);
        }
      } catch {
        /* silently fail */
      }
    }
    fetchUsers();
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Cases</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all data subject access requests
          </p>
        </div>
        <Link href="/cases/new" className="btn-primary">
          <svg
            className="mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          New Case
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-auto">
            <label htmlFor="filter-status" className="label">
              Status
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input-field w-full sm:w-48"
            >
              <option value="">All Statuses</option>
              {CASE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s] ?? s}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-auto">
            <label htmlFor="filter-type" className="label">
              Type
            </label>
            <select
              id="filter-type"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="input-field w-full sm:w-44"
            >
              <option value="">All Types</option>
              {DSAR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-auto">
            <label htmlFor="filter-assignee" className="label">
              Assignee
            </label>
            <select
              id="filter-assignee"
              value={assigneeFilter}
              onChange={(e) => {
                setAssigneeFilter(e.target.value);
                setPage(1);
              }}
              className="input-field w-full sm:w-48"
            >
              <option value="">All Assignees</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-end gap-2 w-full sm:w-auto">
            <div className="flex-1 sm:flex-none">
              <label htmlFor="search" className="label">
                Search
              </label>
              <input
                id="search"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Case #, subject name, email..."
                className="input-field w-full sm:w-64"
              />
            </div>
            <button type="submit" className="btn-secondary">
              Search
            </button>
          </form>

          {(statusFilter || typeFilter || assigneeFilter || search) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("");
                setTypeFilter("");
                setAssigneeFilter("");
                setSearch("");
                setSearchInput("");
                setPage(1);
              }}
              className="text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded bg-gray-100"
              />
            ))}
          </div>
        ) : cases.length === 0 ? (
          <div className="px-6 py-16 text-center">
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
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">
              No cases found. Adjust your filters or create a new case.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3">Case #</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Subject</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Priority</th>
                    <th className="px-6 py-3">Due Date</th>
                    <th className="px-6 py-3">Assignee</th>
                    <th className="px-6 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {cases.map((c) => {
                    const sla = getSlaIndicator(c.dueDate);
                    return (
                      <tr
                        key={c.id}
                        className="cursor-pointer transition-colors hover:bg-gray-50"
                        onClick={() => router.push(`/cases/${c.id}`)}
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-brand-600">
                          {c.caseNumber}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                          {c.type}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {c.dataSubject.fullName}
                          </div>
                          {c.dataSubject.email && (
                            <div className="text-xs text-gray-500">
                              {c.dataSubject.email}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              STATUS_COLORS[c.status] ??
                              "bg-gray-100 text-gray-800"
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
                                ? "font-medium text-red-600"
                                : sla === "due_soon"
                                ? "font-medium text-yellow-600"
                                : "text-gray-700"
                            }`}
                          >
                            {sla !== "ok" && (
                              <span
                                className={`inline-block h-2 w-2 rounded-full ${
                                  sla === "overdue"
                                    ? "bg-red-500"
                                    : "bg-yellow-500"
                                }`}
                              />
                            )}
                            {new Date(c.dueDate).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                          {c.assignedTo?.name ?? (
                            <span className="text-gray-400">Unassigned</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="divide-y divide-gray-200 md:hidden">
              {cases.map((c) => {
                const sla = getSlaIndicator(c.dueDate);
                return (
                  <div
                    key={c.id}
                    className="cursor-pointer p-4 transition-colors hover:bg-gray-50 relative"
                    onClick={() => router.push(`/cases/${c.id}`)}
                  >
                    <div className="pr-6">
                      {/* Line 1: Case Number + Status */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-sm font-medium text-brand-600">
                          {c.caseNumber}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            STATUS_COLORS[c.status] ??
                            "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {STATUS_LABELS[c.status] ?? c.status}
                        </span>
                      </div>

                      {/* Line 2: Subject Name */}
                      <div className="mb-2">
                        <div className="text-sm font-medium text-gray-900">
                          {c.dataSubject.fullName}
                        </div>
                        {c.dataSubject.email && (
                          <div className="text-xs text-gray-500">
                            {c.dataSubject.email}
                          </div>
                        )}
                      </div>

                      {/* Line 3: Type + Priority */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-600">
                          {c.type}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            PRIORITY_COLORS[c.priority] ??
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {c.priority}
                        </span>
                      </div>

                      {/* Line 4: Due Date + Assignee */}
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`flex items-center gap-1.5 ${
                            sla === "overdue"
                              ? "font-medium text-red-600"
                              : sla === "due_soon"
                              ? "font-medium text-yellow-600"
                              : "text-gray-600"
                          }`}
                        >
                          {sla !== "ok" && (
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${
                                sla === "overdue"
                                  ? "bg-red-500"
                                  : "bg-yellow-500"
                              }`}
                            />
                          )}
                          Due: {new Date(c.dueDate).toLocaleDateString()}
                        </span>
                        <span className="text-gray-600">
                          {c.assignedTo?.name ?? (
                            <span className="text-gray-400">Unassigned</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Chevron */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 px-6 py-4">
            <p className="text-sm text-gray-500">
              Showing{" "}
              <span className="font-medium">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium">
                {Math.min(
                  pagination.page * pagination.limit,
                  pagination.total
                )}
              </span>{" "}
              of <span className="font-medium">{pagination.total}</span> results
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary text-sm"
              >
                Previous
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
