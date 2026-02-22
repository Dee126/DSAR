"use client";

import { useEffect, useState, useCallback } from "react";

/* -- Types ----------------------------------------------------------------- */

interface ConnectorItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastError: string | null;
  createdAt: string;
  _count: { runs: number; credentials: number };
  runs: {
    id: string;
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    assetsFound: number;
    findingsCount: number;
    errorMessage: string | null;
  }[];
}

/* -- Category config ------------------------------------------------------- */

const CATEGORY_CONFIG: Record<
  string,
  { label: string; description: string; bg: string; text: string; abbr: string }
> = {
  M365: {
    label: "Microsoft 365",
    description: "Exchange, OneDrive, Teams, SharePoint",
    bg: "bg-orange-500",
    text: "text-white",
    abbr: "M365",
  },
  EXCHANGE: {
    label: "Exchange Server",
    description: "On-prem Exchange mailboxes & calendars",
    bg: "bg-blue-500",
    text: "text-white",
    abbr: "EXO",
  },
  SHAREPOINT: {
    label: "SharePoint",
    description: "SharePoint sites & document libraries",
    bg: "bg-teal-600",
    text: "text-white",
    abbr: "SP",
  },
  FILESERVER: {
    label: "File Server",
    description: "On-prem file shares (SMB/NFS)",
    bg: "bg-gray-600",
    text: "text-white",
    abbr: "FS",
  },
  CRM: {
    label: "CRM",
    description: "Customer relationship management systems",
    bg: "bg-purple-500",
    text: "text-white",
    abbr: "CRM",
  },
};

const CATEGORIES = ["M365", "EXCHANGE", "SHAREPOINT", "FILESERVER", "CRM"] as const;

/* -- Status helpers -------------------------------------------------------- */

const RUN_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  RUNNING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

const RUN_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

/* -- Component ------------------------------------------------------------- */

export default function ConnectorsPanel() {
  const [connectors, setConnectors] = useState<ConnectorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<string>("M365");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Run scan state
  const [runningId, setRunningId] = useState<string | null>(null);

  // Detail panel
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<ConnectorItem | null>(null);

  /* -- Fetch connectors ---------------------------------------------------- */

  const fetchConnectors = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/connectors");
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? `Failed to load connectors (${res.status})`);
        return;
      }
      const json = await res.json();
      setConnectors(json.data ?? []);
    } catch {
      setError("An unexpected error occurred while loading connectors.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  /* -- Create connector ---------------------------------------------------- */

  function openAddModal() {
    setShowAddModal(true);
    setNewName("");
    setNewDescription("");
    setNewCategory("M365");
    setCreateError("");
  }

  function closeAddModal() {
    setShowAddModal(false);
    setNewName("");
    setNewDescription("");
    setCreateError("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          category: newCategory,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setCreateError(json?.error ?? `Failed to create connector (${res.status})`);
        return;
      }
      closeAddModal();
      fetchConnectors();
    } catch {
      setCreateError("An unexpected error occurred.");
    } finally {
      setCreating(false);
    }
  }

  /* -- Run scan ------------------------------------------------------------ */

  async function handleRunScan(connector: ConnectorItem) {
    setRunningId(connector.id);
    try {
      const res = await fetch(`/api/connectors/${connector.id}/run`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        alert(json?.error ?? "Failed to start scan");
        return;
      }
      // Refresh to show results
      fetchConnectors();
      // If detail panel is open for this connector, refresh it
      if (selectedConnector === connector.id) {
        fetchDetail(connector.id);
      }
    } catch {
      alert("An unexpected error occurred while starting scan");
    } finally {
      setRunningId(null);
    }
  }

  /* -- Toggle enable/disable ----------------------------------------------- */

  async function handleToggle(connector: ConnectorItem) {
    try {
      const res = await fetch(`/api/connectors/${connector.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !connector.enabled }),
      });
      if (res.ok) {
        setConnectors((prev) =>
          prev.map((c) =>
            c.id === connector.id ? { ...c, enabled: !c.enabled } : c,
          ),
        );
      }
    } catch {
      /* silently fail */
    }
  }

  /* -- Delete -------------------------------------------------------------- */

  async function handleDelete(connector: ConnectorItem) {
    if (!confirm(`Delete connector "${connector.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/connectors/${connector.id}`, { method: "DELETE" });
      if (res.ok) {
        setConnectors((prev) => prev.filter((c) => c.id !== connector.id));
        if (selectedConnector === connector.id) {
          setSelectedConnector(null);
          setDetailData(null);
        }
      }
    } catch {
      /* silently fail */
    }
  }

  /* -- Fetch detail -------------------------------------------------------- */

  async function fetchDetail(id: string) {
    try {
      const res = await fetch(`/api/connectors/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailData(data);
      }
    } catch {
      /* silently fail */
    }
  }

  function openDetail(connector: ConnectorItem) {
    setSelectedConnector(connector.id);
    fetchDetail(connector.id);
  }

  /* -- Helpers ------------------------------------------------------------- */

  function formatTimestamp(ts: string | null): string {
    if (!ts) return "--";
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getLastRun(connector: ConnectorItem) {
    return connector.runs?.[0] ?? null;
  }

  /* -- Render -------------------------------------------------------------- */

  return (
    <>
      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {connectors.length} connector{connectors.length !== 1 ? "s" : ""} configured
        </p>
        <button onClick={openAddModal} className="btn-primary">
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Connector
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <svg className="h-5 w-5 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button onClick={fetchConnectors} className="text-sm font-medium text-red-700 underline hover:text-red-600">
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex gap-6">
        {/* Connector list */}
        <div className={`${selectedConnector ? "w-1/2" : "w-full"} transition-all`}>
          <div className="card p-0">
            {loading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
                      <div className="h-3 w-32 animate-pulse rounded bg-gray-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : connectors.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
                </svg>
                <h3 className="mt-3 text-sm font-semibold text-gray-900">No connectors configured</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add a connector to start scanning data sources for personal data.
                </p>
                <button onClick={openAddModal} className="btn-primary mt-4">
                  Add Connector
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {connectors.map((connector) => {
                  const cat = CATEGORY_CONFIG[connector.category] ?? {
                    label: connector.category,
                    bg: "bg-gray-500",
                    text: "text-white",
                    abbr: connector.category.slice(0, 3),
                  };
                  const lastRun = getLastRun(connector);
                  const isRunning = runningId === connector.id;
                  const isSelected = selectedConnector === connector.id;

                  return (
                    <div
                      key={connector.id}
                      className={`flex items-center gap-4 p-4 transition-colors cursor-pointer hover:bg-gray-50 ${
                        isSelected ? "bg-brand-50 border-l-2 border-brand-600" : ""
                      }`}
                      onClick={() => openDetail(connector)}
                    >
                      {/* Category icon */}
                      <div className="flex-shrink-0">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full ${cat.bg} ${cat.text} text-xs font-bold`}
                        >
                          {cat.abbr}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {connector.name}
                          </span>
                          {!connector.enabled && (
                            <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                              Disabled
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">{cat.label}</div>

                        {/* Last run status */}
                        <div className="mt-1 flex items-center gap-2">
                          {lastRun ? (
                            <>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  RUN_STATUS_COLORS[lastRun.status] ?? "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {lastRun.status === "RUNNING" && (
                                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                )}
                                {RUN_STATUS_LABELS[lastRun.status] ?? lastRun.status}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {lastRun.assetsFound} assets, {lastRun.findingsCount} findings
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] text-gray-400">No runs yet</span>
                          )}
                        </div>

                        {/* Error */}
                        {connector.lastError && (
                          <div className="mt-1 text-[10px] text-red-600 truncate">
                            {connector.lastError}
                          </div>
                        )}
                      </div>

                      {/* Last run time */}
                      <div className="hidden sm:block flex-shrink-0 text-right">
                        <div className="text-xs text-gray-500">
                          {formatTimestamp(connector.lastRunAt)}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {connector._count.runs} run{connector._count.runs !== 1 ? "s" : ""}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleRunScan(connector)}
                          disabled={isRunning || !connector.enabled}
                          className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!connector.enabled ? "Enable connector first" : "Run scan"}
                        >
                          {isRunning ? (
                            <>
                              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Scanning...
                            </>
                          ) : (
                            <>
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                              </svg>
                              Run Scan
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selectedConnector && detailData && (
          <div className="w-1/2">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{detailData.name}</h3>
                <button
                  onClick={() => { setSelectedConnector(null); setDetailData(null); }}
                  className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Connector info */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Category</span>
                  <span className="font-medium text-gray-900">
                    {CATEGORY_CONFIG[detailData.category]?.label ?? detailData.category}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status</span>
                  <span className={`font-medium ${detailData.enabled ? "text-green-600" : "text-gray-500"}`}>
                    {detailData.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Credentials</span>
                  <span className="font-medium text-gray-900">
                    {detailData._count.credentials > 0
                      ? `${detailData._count.credentials} stored`
                      : "None"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Last Run</span>
                  <span className="text-gray-700">{formatTimestamp(detailData.lastRunAt)}</span>
                </div>
                {detailData.description && (
                  <div className="text-sm">
                    <span className="text-gray-500">Description</span>
                    <p className="mt-1 text-gray-700">{detailData.description}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => handleToggle(detailData)}
                  className="btn-secondary text-xs"
                >
                  {detailData.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => handleDelete(detailData)}
                  className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Delete
                </button>
              </div>

              {/* Run history */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-900">Recent Runs</h4>
                {detailData.runs && detailData.runs.length > 0 ? (
                  <div className="space-y-2">
                    {detailData.runs.map((run) => (
                      <div key={run.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              RUN_STATUS_COLORS[run.status] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {RUN_STATUS_LABELS[run.status] ?? run.status}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {formatTimestamp(run.startedAt)}
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs text-gray-600">
                          <span>{run.assetsFound} assets</span>
                          <span>{run.findingsCount} findings</span>
                          {run.finishedAt && run.startedAt && (
                            <span>
                              {Math.round(
                                (new Date(run.finishedAt).getTime() -
                                  new Date(run.startedAt).getTime()) /
                                  1000,
                              )}s
                            </span>
                          )}
                        </div>
                        {run.errorMessage && (
                          <p className="mt-1 text-[10px] text-red-600">{run.errorMessage}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No runs yet. Click &quot;Run Scan&quot; to start.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* -- Add Connector Modal ---------------------------------------------- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-gray-900/50 transition-opacity" onClick={closeAddModal} />
          <div className="relative z-10 mx-4 w-full max-w-lg rounded-lg bg-white shadow-xl sm:mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Add Connector</h2>
              <button onClick={closeAddModal} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              {createError && (
                <div className="rounded-md bg-red-50 p-3">
                  <p className="text-sm text-red-700">{createError}</p>
                </div>
              )}

              {/* Category selection */}
              <div>
                <label className="label">
                  Connector Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-5 gap-2 mt-1">
                  {CATEGORIES.map((cat) => {
                    const config = CATEGORY_CONFIG[cat];
                    const isSelected = newCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewCategory(cat)}
                        className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all ${
                          isSelected
                            ? "border-brand-300 bg-brand-50 ring-1 ring-brand-300"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${config.bg} ${config.text} text-[10px] font-bold`}
                        >
                          {config.abbr}
                        </div>
                        <span className="text-[10px] font-medium text-gray-700">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name */}
              <div>
                <label htmlFor="connector-name" className="label">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="connector-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input-field"
                  placeholder={`e.g., Production ${CATEGORY_CONFIG[newCategory]?.label ?? ""}`}
                  required
                  maxLength={200}
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="connector-desc" className="label">
                  Description
                </label>
                <textarea
                  id="connector-desc"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="input-field"
                  rows={2}
                  placeholder="Optional description..."
                  maxLength={1000}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={closeAddModal} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={creating || !newName.trim()} className="btn-primary">
                  {creating ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    "Create Connector"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
