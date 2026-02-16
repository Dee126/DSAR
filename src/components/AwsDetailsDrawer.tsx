"use client";

import { useEffect, useState, useCallback } from "react";

/* ── Types ────────────────────────────────────────────────────────── */

interface AwsTestResult {
  ok: boolean;
  account?: string;
  arn?: string;
  userId?: string;
  error?: string;
}

interface ScanItem {
  resourceType: string;
  resourceId: string;
  resourceName: string | null;
  region: string | null;
  metaJson: Record<string, unknown> | null;
}

interface ScanRun {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  items: ScanItem[];
}

interface IntegrationBasic {
  id: string;
  name: string;
  provider: string;
  status: string;
  healthStatus: string;
  config: Record<string, unknown>;
  lastSuccessAt: string | null;
  lastHealthCheckAt: string | null;
  lastError: string | null;
}

interface Props {
  integrationId: string;
  onClose: () => void;
}

/* ── Resource type display helpers ────────────────────────────────── */

const RESOURCE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  s3_bucket:      { label: "S3 Bucket",       color: "bg-green-100 text-green-800" },
  rds_instance:   { label: "RDS Instance",     color: "bg-blue-100 text-blue-800" },
  dynamodb_table: { label: "DynamoDB Table",   color: "bg-purple-100 text-purple-800" },
};

/* ── Component ────────────────────────────────────────────────────── */

export default function AwsDetailsDrawer({ integrationId, onClose }: Props) {
  const [integration, setIntegration] = useState<IntegrationBasic | null>(null);
  const [callerIdentity, setCallerIdentity] = useState<AwsTestResult | null>(null);
  const [lastRun, setLastRun] = useState<ScanRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [testing, setTesting] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Filter state for resources table
  const [resourceFilter, setResourceFilter] = useState<string>("all");

  /* ── Fetch data ─────────────────────────────────────────────────── */

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch integration details
      const intRes = await fetch(`/api/integrations/${integrationId}`);
      if (!intRes.ok) {
        setError("Failed to load integration details");
        return;
      }
      const intData = await intRes.json();
      setIntegration(intData);

      // Fetch latest scan run (via integration runs)
      try {
        const runsRes = await fetch(`/api/integrations/${integrationId}`);
        if (runsRes.ok) {
          const data = await runsRes.json();
          // The integration detail endpoint may include runs info
          // We'll try to fetch scan data separately
          if (data.lastRun) {
            setLastRun(data.lastRun);
          }
        }
      } catch {
        // Scan data may not be available yet
      }
    } catch {
      setError("Failed to connect to the server");
    } finally {
      setLoading(false);
    }
  }, [integrationId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  /* ── Handlers ───────────────────────────────────────────────────── */

  async function handleTest() {
    setTesting(true);
    setCallerIdentity(null);
    try {
      const res = await fetch(`/api/integrations/aws/${integrationId}/test`, {
        method: "POST",
      });
      const json = await res.json();
      setCallerIdentity(json);

      if (json.ok && integration) {
        setIntegration({
          ...integration,
          healthStatus: "HEALTHY",
          lastSuccessAt: new Date().toISOString(),
          lastHealthCheckAt: new Date().toISOString(),
          lastError: null,
        });
      } else if (!json.ok && integration) {
        setIntegration({
          ...integration,
          healthStatus: "FAILED",
          lastHealthCheckAt: new Date().toISOString(),
          lastError: json.error,
        });
      }
    } catch {
      setCallerIdentity({ ok: false, error: "Failed to connect" });
    } finally {
      setTesting(false);
    }
  }

  async function handleScan() {
    setScanning(true);
    try {
      const res = await fetch(`/api/integrations/aws/${integrationId}/scan`, {
        method: "POST",
      });
      const json = await res.json();

      if (json.status === "COMPLETED") {
        setLastRun({
          id: json.runId,
          status: json.status,
          startedAt: json.startedAt,
          finishedAt: json.finishedAt,
          error: null,
          items: json.items ?? [],
        });
      } else {
        setLastRun({
          id: json.runId,
          status: json.status,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          error: json.error,
          items: [],
        });
      }
    } catch {
      setError("Failed to run scan");
    } finally {
      setScanning(false);
    }
  }

  /* ── Helpers ────────────────────────────────────────────────────── */

  function formatTs(ts: string | null | undefined): string {
    if (!ts) return "Never";
    return new Date(ts).toLocaleString();
  }

  const filteredItems = lastRun?.items.filter(
    (item) => resourceFilter === "all" || item.resourceType === resourceFilter
  ) ?? [];

  const resourceCounts = lastRun?.items.reduce((acc, item) => {
    acc[item.resourceType] = (acc[item.resourceType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  /* ── Render ─────────────────────────────────────────────────────── */

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-gray-900/50 transition-opacity" onClick={onClose} />

      {/* Drawer panel */}
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500 text-sm font-bold text-gray-900">
              AWS
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {integration?.name ?? "AWS Integration"}
              </h2>
              <p className="text-xs text-gray-500">
                {integration?.config?.region ? `Region: ${String(integration.config.region)}` : "AWS Integration Details"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading ? (
            <div className="space-y-4">
              <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
              <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
              <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
            </div>
          ) : error && !integration ? (
            <div className="py-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="mt-3 text-sm text-gray-500">{error}</p>
            </div>
          ) : (
            <>
              {/* Connection Status */}
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Connection Status</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleTest}
                      disabled={testing}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      {testing ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                          </svg>
                          Test
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleScan}
                      disabled={scanning || integration?.healthStatus !== "HEALTHY"}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                      title={integration?.healthStatus !== "HEALTHY" ? "Test connection first" : "Scan resources"}
                    >
                      {scanning ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                          </svg>
                          Run scan
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      integration?.healthStatus === "HEALTHY" ? "bg-green-100 text-green-800"
                      : integration?.healthStatus === "FAILED" ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-600"
                    }`}>
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                        integration?.healthStatus === "HEALTHY" ? "bg-green-500"
                        : integration?.healthStatus === "FAILED" ? "bg-red-500"
                        : "bg-gray-400"
                      }`} />
                      {integration?.healthStatus === "HEALTHY" ? "Connected"
                        : integration?.healthStatus === "FAILED" ? "Error"
                        : "Never tested"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Last Tested</p>
                    <p className="mt-1 text-sm text-gray-900">{formatTs(integration?.lastHealthCheckAt)}</p>
                  </div>
                </div>

                {/* Last error */}
                {integration?.lastError && (
                  <div className="mt-3 rounded-md bg-red-50 px-3 py-2">
                    <p className="text-xs text-red-700">{integration.lastError}</p>
                  </div>
                )}
              </div>

              {/* Caller Identity (from last test) */}
              {callerIdentity && (
                <div className={`rounded-lg border p-4 ${
                  callerIdentity.ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                }`}>
                  <h3 className={`text-sm font-semibold ${callerIdentity.ok ? "text-green-900" : "text-red-900"}`}>
                    {callerIdentity.ok ? "Caller Identity" : "Connection Test Failed"}
                  </h3>
                  {callerIdentity.ok ? (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-700 w-16">Account:</span>
                        <span className="text-sm font-mono text-green-900">{callerIdentity.account}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-700 w-16">ARN:</span>
                        <span className="text-sm font-mono text-green-900 break-all">{callerIdentity.arn}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-700 w-16">User ID:</span>
                        <span className="text-sm font-mono text-green-900">{callerIdentity.userId}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-red-700">{callerIdentity.error}</p>
                  )}
                </div>
              )}

              {/* Last Scan Summary */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Scan Summary</h3>
                {!lastRun ? (
                  <div className="py-6 text-center">
                    <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">No scans performed yet</p>
                    <p className="mt-1 text-xs text-gray-400">Run a scan to discover AWS resources</p>
                  </div>
                ) : lastRun.status === "FAILED" ? (
                  <div className="rounded-md bg-red-50 p-3">
                    <p className="text-sm font-medium text-red-800">Scan Failed</p>
                    <p className="mt-1 text-xs text-red-700">{lastRun.error}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatTs(lastRun.finishedAt)}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-green-50 p-3 text-center">
                        <p className="text-2xl font-bold text-green-700">{resourceCounts["s3_bucket"] ?? 0}</p>
                        <p className="text-xs text-green-600">S3 Buckets</p>
                      </div>
                      <div className="rounded-lg bg-blue-50 p-3 text-center">
                        <p className="text-2xl font-bold text-blue-700">{resourceCounts["rds_instance"] ?? 0}</p>
                        <p className="text-xs text-blue-600">RDS Instances</p>
                      </div>
                      <div className="rounded-lg bg-purple-50 p-3 text-center">
                        <p className="text-2xl font-bold text-purple-700">{resourceCounts["dynamodb_table"] ?? 0}</p>
                        <p className="text-xs text-purple-600">DynamoDB Tables</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>{lastRun.items.length} total resources</span>
                      <span>Scanned {formatTs(lastRun.finishedAt)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Discovered Resources Table */}
              {lastRun && lastRun.items.length > 0 && (
                <div className="rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                    <h3 className="text-sm font-semibold text-gray-900">Discovered Resources</h3>
                    <select
                      value={resourceFilter}
                      onChange={(e) => setResourceFilter(e.target.value)}
                      className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700"
                    >
                      <option value="all">All types ({lastRun.items.length})</option>
                      {Object.entries(resourceCounts).map(([type, count]) => (
                        <option key={type} value={type}>
                          {RESOURCE_TYPE_LABELS[type]?.label ?? type} ({count})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          <th className="px-4 py-2">Type</th>
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2">Region</th>
                          <th className="px-4 py-2">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredItems.map((item, i) => {
                          const typeConfig = RESOURCE_TYPE_LABELS[item.resourceType] ?? {
                            label: item.resourceType,
                            color: "bg-gray-100 text-gray-800",
                          };
                          const isError = item.resourceId === "_error";

                          return (
                            <tr key={`${item.resourceId}-${i}`} className={isError ? "bg-red-50" : "hover:bg-gray-50"}>
                              <td className="whitespace-nowrap px-4 py-2.5">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${typeConfig.color}`}>
                                  {typeConfig.label}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`text-sm ${isError ? "text-red-700" : "text-gray-900"} font-mono`}>
                                  {item.resourceName ?? item.resourceId}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">
                                {item.region ?? "--"}
                              </td>
                              <td className="px-4 py-2.5">
                                {item.metaJson && Object.keys(item.metaJson).length > 0 ? (
                                  <div className="space-y-0.5">
                                    {Object.entries(item.metaJson).map(([key, val]) => (
                                      <div key={key} className="text-xs text-gray-500">
                                        <span className="font-medium text-gray-600">{key}:</span>{" "}
                                        <span className={isError && key === "error" ? "text-red-600" : ""}>
                                          {String(val)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">--</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-gray-200 px-6 py-3 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
