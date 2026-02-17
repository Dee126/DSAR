"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { PageState } from "@/components/ui/PageState";
import { DataBadge } from "@/components/ui/DataBadge";
import { FilterBar, FilterConfig } from "@/components/ui/FilterBar";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";

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

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* ── SLA cell helper ──────────────────────────────────────────────────── */

function SlaCell({ dueDate }: { dueDate: string }) {
  const sla = getSlaIndicator(dueDate);
  return (
    <span
      className={`flex items-center gap-1.5 text-sm ${
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
            sla === "overdue" ? "bg-red-500" : "bg-yellow-500"
          }`}
          aria-hidden="true"
        />
      )}
      {new Date(dueDate).toLocaleDateString()}
    </span>
  );
}

/* ── Column Definitions ───────────────────────────────────────────────── */

const columns: ColumnDef<DSARCase>[] = [
  {
    key: "caseNumber",
    header: "Case #",
    cell: (c) => (
      <span className="whitespace-nowrap text-sm font-medium text-brand-600">
        {c.caseNumber}
      </span>
    ),
  },
  {
    key: "type",
    header: "Type",
    cell: (c) => <DataBadge label={c.type} variant="type" />,
    hideOnMobile: true,
  },
  {
    key: "subject",
    header: "Subject",
    cell: (c) => (
      <div>
        <div className="text-sm font-medium text-gray-900">
          {c.dataSubject.fullName}
        </div>
        {c.dataSubject.email && (
          <div className="text-xs text-gray-500">{c.dataSubject.email}</div>
        )}
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (c) => <DataBadge label={c.status} variant="status" />,
  },
  {
    key: "priority",
    header: "Priority",
    cell: (c) => <DataBadge label={c.priority} variant="priority" />,
    hideOnMobile: true,
  },
  {
    key: "dueDate",
    header: "Due Date",
    cell: (c) => <SlaCell dueDate={c.dueDate} />,
    hideOnMobile: true,
  },
  {
    key: "assignee",
    header: "Assignee",
    cell: (c) => (
      <span className="whitespace-nowrap text-sm text-gray-700">
        {c.assignedTo?.name ?? (
          <span className="text-gray-400">Unassigned</span>
        )}
      </span>
    ),
    hideOnMobile: true,
  },
  {
    key: "createdAt",
    header: "Created",
    cell: (c) => (
      <span className="whitespace-nowrap text-sm text-gray-500">
        {new Date(c.createdAt).toLocaleDateString()}
      </span>
    ),
    hideOnMobile: true,
  },
];

/* ── Mobile Card ──────────────────────────────────────────────────────── */

function CaseMobileCard({
  c,
  onClick,
}: {
  c: DSARCase;
  onClick: () => void;
}) {
  const sla = getSlaIndicator(c.dueDate);
  return (
    <div
      className="cursor-pointer p-4 transition-colors hover:bg-gray-50 relative"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      role="link"
    >
      <div className="pr-6">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-sm font-medium text-brand-600">
            {c.caseNumber}
          </span>
          <DataBadge label={c.status} variant="status" />
        </div>
        <div className="mb-2">
          <div className="text-sm font-medium text-gray-900">
            {c.dataSubject.fullName}
          </div>
          {c.dataSubject.email && (
            <div className="text-xs text-gray-500">{c.dataSubject.email}</div>
          )}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <DataBadge label={c.type} variant="type" />
          <DataBadge label={c.priority} variant="priority" />
        </div>
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
                  sla === "overdue" ? "bg-red-500" : "bg-yellow-500"
                }`}
                aria-hidden="true"
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
      <div className="absolute right-4 top-1/2 -translate-y-1/2" aria-hidden="true">
        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </div>
  );
}

/* ── Component ────────────────────────────────────────────────────────── */

export default function CasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { error: showError } = useToast();

  const [cases, setCases] = useState<DSARCase[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<CaseUser[]>([]);

  // Read filters from URL
  const statusFilter = searchParams.get("status") ?? "";
  const typeFilter = searchParams.get("type") ?? "";
  const assigneeFilter = searchParams.get("assignee") ?? "";
  const searchQuery = searchParams.get("q") ?? "";
  const page = Number(searchParams.get("page") ?? "1");

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "20");
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (assigneeFilter) params.set("assignee", assigneeFilter);
    if (searchQuery) params.set("search", searchQuery);

    const result = await api.get<DSARCase[]>(`/api/cases?${params.toString()}`);

    if (result.error) {
      setError(result.error.message);
      showError("Failed to load cases", result.error.message);
    } else {
      // The API wraps data in { data, pagination }
      const raw = result.data as unknown as { data?: DSARCase[]; pagination?: PaginationData } | DSARCase[];
      if (Array.isArray(raw)) {
        setCases(raw);
      } else {
        setCases(raw?.data ?? []);
        if (raw?.pagination) setPagination(raw.pagination);
      }
    }
    setLoading(false);
  }, [page, statusFilter, typeFilter, assigneeFilter, searchQuery, showError]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  useEffect(() => {
    async function fetchUsers() {
      const result = await api.get<CaseUser[]>("/api/users");
      if (result.data) {
        const data = result.data as unknown as { data?: CaseUser[] } | CaseUser[];
        setUsers(Array.isArray(data) ? data : data?.data ?? []);
      }
    }
    fetchUsers();
  }, []);

  // Build filter config with loaded users
  const filters: FilterConfig[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      placeholder: "All Statuses",
      options: CASE_STATUSES.map((s) => ({
        value: s,
        label: STATUS_LABELS[s] ?? s,
      })),
      width: "sm:w-48",
    },
    {
      key: "type",
      label: "Type",
      type: "select",
      placeholder: "All Types",
      options: DSAR_TYPES.map((t) => ({ value: t, label: t })),
      width: "sm:w-44",
    },
    {
      key: "assignee",
      label: "Assignee",
      type: "select",
      placeholder: "All Assignees",
      options: users.map((u) => ({ value: u.id, label: u.name })),
      width: "sm:w-48",
    },
    {
      key: "q",
      label: "Search",
      type: "search",
      placeholder: "Case #, subject name, email...",
      width: "sm:w-64",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            Cases
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all data subject access requests
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton
            endpoint="/api/cases/export"
            body={{
              format: "csv",
              filters: { status: statusFilter, type: typeFilter, assignee: assigneeFilter, search: searchQuery },
            }}
            filename="dsar-cases.csv"
          />
          <Link href="/cases/new" className="btn-primary">
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Case
          </Link>
        </div>
      </div>

      {/* Filter Bar — URL-persisted */}
      <FilterBar filters={filters} />

      {/* Table with loading/error/empty states */}
      <PageState
        loading={loading}
        error={error}
        empty={!loading && !error && cases.length === 0}
        onRetry={fetchCases}
        loadingVariant="table"
        loadingRows={8}
        emptyTitle="No cases found"
        emptyDescription="Adjust your filters or create a new case."
        emptyIcon={
          <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        }
        emptyAction={
          <Link href="/cases/new" className="btn-primary text-sm">
            Create New Case
          </Link>
        }
      >
        <DataTable
          columns={columns}
          data={cases}
          rowKey={(c) => c.id}
          onRowClick={(c) => router.push(`/cases/${c.id}`)}
          pagination={{
            page: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            totalPages: pagination.totalPages,
          }}
          mobileCard={(c) => (
            <CaseMobileCard c={c} onClick={() => router.push(`/cases/${c.id}`)} />
          )}
        />
      </PageState>
    </div>
  );
}
