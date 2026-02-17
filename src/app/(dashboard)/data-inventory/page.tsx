"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

/* ── Types ────────────────────────────────────────────────────────────── */

interface SystemOwner {
  id: string;
  name: string;
  email: string;
}

interface SystemItem {
  id: string;
  name: string;
  description: string | null;
  criticality: string;
  systemStatus: string;
  automationReadiness: string;
  connectorType: string;
  inScopeForDsar: boolean;
  containsSpecialCategories: boolean;
  ownerUser: SystemOwner | null;
  dataCategories: { id: string; category: string }[];
  processors: { id: string; vendorName: string }[];
  confidenceScore: number;
  _count: { discoveryRules: number; caseSystemLinks: number };
}

/* ── Constants ────────────────────────────────────────────────────────── */

const CRITICALITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-red-100 text-red-700",
};

const AUTOMATION_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  SEMI_AUTOMATED: "Semi-auto",
  API_AVAILABLE: "API",
};

const AUTOMATION_COLORS: Record<string, string> = {
  MANUAL: "bg-gray-100 text-gray-600",
  SEMI_AUTOMATED: "bg-yellow-100 text-yellow-700",
  API_AVAILABLE: "bg-green-100 text-green-700",
};

function confidenceColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-500";
}

const MANAGE_ROLES = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO", "CASE_MANAGER"];

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function DataInventoryPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const canManage = userRole && MANAGE_ROLES.includes(userRole);

  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCriticality, setFilterCriticality] = useState("");

  const fetchSystems = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      if (filterCriticality) params.set("criticality", filterCriticality);
      const res = await fetch(`/api/data-inventory/systems?${params}`);
      if (res.ok) {
        setSystems(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterCriticality]);

  useEffect(() => {
    fetchSystems();
  }, [fetchSystems]);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/data-inventory/systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim() }),
      });
      if (res.ok) {
        setCreateName("");
        setShowCreate(false);
        fetchSystems();
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">
            {systems.length} system{systems.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add System
          </button>
        )}
      </div>

      {/* Quick create modal */}
      {showCreate && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="System name (e.g., Salesforce CRM)"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={creating || !createName.trim()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search systems..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="RETIRED">Retired</option>
        </select>
        <select
          value={filterCriticality}
          onChange={(e) => setFilterCriticality(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="">All criticality</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </div>

      {/* Systems grid */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500">Loading systems...</div>
      ) : systems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No systems registered</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding systems to your data inventory.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {systems.map((system) => (
            <Link
              key={system.id}
              href={`/data-inventory/${system.id}`}
              className="group rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-gray-900 group-hover:text-brand-700">
                    {system.name}
                  </h3>
                  {system.description && (
                    <p className="mt-0.5 truncate text-xs text-gray-500">{system.description}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${CRITICALITY_COLORS[system.criticality] ?? ""}`}>
                  {system.criticality}
                </span>
              </div>

              {/* Badges row */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${AUTOMATION_COLORS[system.automationReadiness] ?? ""}`}>
                  {AUTOMATION_LABELS[system.automationReadiness] ?? system.automationReadiness}
                </span>
                {system.containsSpecialCategories && (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">Art. 9</span>
                )}
                {system.systemStatus === "RETIRED" && (
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">Retired</span>
                )}
                {!system.inScopeForDsar && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">Out of scope</span>
                )}
              </div>

              {/* Stats row */}
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span>{system.dataCategories.length} categor{system.dataCategories.length === 1 ? "y" : "ies"}</span>
                <span>{system.processors.length} vendor{system.processors.length === 1 ? "" : "s"}</span>
                <span>{system._count.discoveryRules} rule{system._count.discoveryRules === 1 ? "" : "s"}</span>
              </div>

              {/* Confidence bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Confidence</span>
                  <span className={`font-semibold ${confidenceColor(system.confidenceScore)}`}>
                    {system.confidenceScore}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      system.confidenceScore >= 80 ? "bg-green-500" : system.confidenceScore >= 60 ? "bg-yellow-500" : "bg-red-400"
                    }`}
                    style={{ width: `${system.confidenceScore}%` }}
                  />
                </div>
              </div>

              {/* Owner */}
              {system.ownerUser && (
                <p className="mt-2 truncate text-xs text-gray-400">
                  Owner: {system.ownerUser.name}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
