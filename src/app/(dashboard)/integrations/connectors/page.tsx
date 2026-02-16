"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

interface ConnectorItem {
  id: string;
  type: string;
  name: string;
  status: string;
  configJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  _count: { runs: number; secrets: number };
}

interface ConnectorRun {
  id: string;
  runType: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  caseId: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  M365: "Microsoft 365",
  GOOGLE: "Google Workspace",
  CUSTOM: "Custom",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  DISABLED: "bg-gray-100 text-gray-800",
};

const RUN_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  RUNNING: "bg-blue-100 text-blue-800",
  SUCCESS: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

export default function ConnectorsPage() {
  const { data: session } = useSession();
  const [connectors, setConnectors] = useState<ConnectorItem[]>([]);
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [runs, setRuns] = useState<ConnectorRun[]>([]);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newConnector, setNewConnector] = useState({ type: "M365", name: "", mock_mode: true });

  const fetchConnectors = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/connectors");
      if (res.ok) {
        const json = await res.json();
        setConnectors(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRuns = useCallback(async (connectorId: string) => {
    try {
      const res = await fetch(`/api/v1/connectors/${connectorId}/runs`);
      if (res.ok) {
        const json = await res.json();
        setRuns(json.data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => { fetchConnectors(); }, [fetchConnectors]);

  useEffect(() => {
    if (selectedConnector) fetchRuns(selectedConnector);
  }, [selectedConnector, fetchRuns]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/v1/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newConnector.type,
          name: newConnector.name,
          config: { mock_mode: newConnector.mock_mode },
        }),
      });
      if (res.ok) {
        setNewConnector({ type: "M365", name: "", mock_mode: true });
        await fetchConnectors();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleTest = async (connectorId: string) => {
    setTestResult(null);
    try {
      const res = await fetch(`/api/v1/connectors/${connectorId}/test`, { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setTestResult(json.data);
      }
    } catch {
      setTestResult({ ok: false, message: "Network error" });
    }
  };

  const handleRun = async (connectorId: string, runType: string) => {
    try {
      const res = await fetch(`/api/v1/connectors/${connectorId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runType }),
      });
      if (res.ok) {
        await fetchRuns(connectorId);
      }
    } catch {
      // ignore
    }
  };

  const isAdmin = session?.user?.role === "TENANT_ADMIN" || session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "DPO";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Connectors</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage data source connectors for automated DSAR processing
          </p>
        </div>
      </div>

      {/* Create Connector Form */}
      {isAdmin && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Add Connector</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select
              value={newConnector.type}
              onChange={(e) => setNewConnector((p) => ({ ...p, type: e.target.value }))}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="M365">Microsoft 365</option>
              <option value="GOOGLE">Google Workspace</option>
              <option value="CUSTOM">Custom</option>
            </select>
            <input
              type="text"
              placeholder="Connector name"
              value={newConnector.name}
              onChange={(e) => setNewConnector((p) => ({ ...p, name: e.target.value }))}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newConnector.mock_mode}
                onChange={(e) => setNewConnector((p) => ({ ...p, mock_mode: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Mock Mode</span>
            </label>
            <button
              onClick={handleCreate}
              disabled={creating || !newConnector.name}
              className="inline-flex justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Add Connector"}
            </button>
          </div>
        </div>
      )}

      {/* Connectors List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Runs</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">Loading...</td></tr>
            ) : connectors.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No connectors configured</td></tr>
            ) : connectors.map((c) => (
              <tr key={c.id} className={selectedConnector === c.id ? "bg-blue-50" : ""}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{TYPE_LABELS[c.type] || c.type}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${STATUS_COLORS[c.status]}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c._count.runs}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {(c.configJson as any)?.mock_mode ? (
                    <span className="text-amber-600 font-medium">Mock</span>
                  ) : (
                    <span className="text-green-600 font-medium">Live</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                  <button
                    onClick={() => setSelectedConnector(c.id === selectedConnector ? null : c.id)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    {selectedConnector === c.id ? "Hide" : "History"}
                  </button>
                  <button onClick={() => handleTest(c.id)} className="text-green-600 hover:text-green-900">
                    Test
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handleRun(c.id, "IDENTITY_LOOKUP")}
                      className="text-purple-600 hover:text-purple-900"
                    >
                      Lookup
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => handleRun(c.id, "DATA_EXPORT")}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Export
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`p-4 rounded-lg ${testResult.ok ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${testResult.ok ? "text-green-800" : "text-red-800"}`}>
              {testResult.ok ? "Connection successful" : "Connection failed"}
            </span>
            <button onClick={() => setTestResult(null)} className="ml-auto text-gray-400 hover:text-gray-600 text-xs">
              Dismiss
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-600">{testResult.message}</p>
        </div>
      )}

      {/* Run History */}
      {selectedConnector && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Run History</h3>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Case</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Finished</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {runs.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No runs yet</td></tr>
              ) : runs.map((r) => (
                <tr key={r.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.runType}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${RUN_STATUS_COLORS[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.caseId?.substring(0, 8) || "—"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {r.startedAt ? new Date(r.startedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {r.finishedAt ? new Date(r.finishedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
