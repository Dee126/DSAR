"use client";

import { useEffect, useState, useCallback } from "react";

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  scopesJson: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  creator: { name: string; email: string };
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState({ name: "", scopes: ["cases:read"] });
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const AVAILABLE_SCOPES = [
    "cases:read", "cases:write", "systems:read", "vendors:write",
    "webhooks:write", "connectors:run", "documents:read", "incidents:read", "admin:all",
  ];

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/api-keys");
      if (res.ok) {
        const json = await res.json();
        setKeys(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleCreate = async () => {
    setCreating(true);
    setCreatedKey(null);
    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKey),
      });
      if (res.ok) {
        const json = await res.json();
        setCreatedKey(json.data.key);
        setNewKey({ name: "", scopes: ["cases:read"] });
        await fetchKeys();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    await fetch(`/api/v1/api-keys/${id}`, { method: "DELETE" });
    await fetchKeys();
  };

  const toggleScope = (scope: string) => {
    setNewKey((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
        <p className="mt-1 text-sm text-gray-500">Manage API keys for the public REST API (v1)</p>
      </div>

      {/* Created Key Alert */}
      {createdKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-800">
            API key created. Copy it now — it will not be shown again!
          </p>
          <code className="mt-2 block bg-amber-100 p-2 rounded text-sm font-mono break-all">{createdKey}</code>
          <button
            onClick={() => { navigator.clipboard?.writeText(createdKey); }}
            className="mt-2 text-sm text-amber-700 hover:text-amber-900 underline"
          >
            Copy to clipboard
          </button>
        </div>
      )}

      {/* Create Form */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">Create API Key</h2>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Key name (e.g., 'CI/CD Pipeline')"
            value={newKey.name}
            onChange={(e) => setNewKey((p) => ({ ...p, name: e.target.value }))}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Scopes</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <label key={scope} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={newKey.scopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm text-gray-600">{scope}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newKey.name || newKey.scopes.length === 0}
            className="inline-flex justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create API Key"}
          </button>
        </div>
      </div>

      {/* Keys Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prefix</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scopes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Used</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-4 text-center text-gray-500">Loading...</td></tr>
            ) : keys.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-4 text-center text-gray-500">No API keys created</td></tr>
            ) : keys.map((k) => (
              <tr key={k.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{k.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{k.prefix}...</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <div className="flex flex-wrap gap-1">
                    {(k.scopesJson || []).map((s) => (
                      <span key={s} className="inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-xs">{s}</span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(k.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {k.revokedAt ? (
                    <span className="inline-flex rounded-full bg-red-100 px-2 text-xs font-semibold leading-5 text-red-800">Revoked</span>
                  ) : (
                    <span className="inline-flex rounded-full bg-green-100 px-2 text-xs font-semibold leading-5 text-green-800">Active</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  {!k.revokedAt && (
                    <button
                      onClick={() => handleRevoke(k.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
