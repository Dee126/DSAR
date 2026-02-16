"use client";

import { useEffect, useState, useCallback } from "react";

interface WebhookEndpointItem {
  id: string;
  url: string;
  enabled: boolean;
  subscribedEvents: string[];
  failureCount: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  createdAt: string;
  _count: { deliveries: number };
}

const EVENT_TYPES = [
  "case.created", "case.updated", "case.status_changed", "case.due_soon", "case.overdue",
  "vendor_request.created", "vendor_request.overdue", "vendor_request.responded",
  "response.approved", "response.sent",
  "delivery.downloaded",
  "incident.created", "incident.updated",
];

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpointItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [newEndpoint, setNewEndpoint] = useState({ url: "", subscribedEvents: ["case.created", "case.status_changed"] });

  const fetchEndpoints = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/webhooks");
      if (res.ok) {
        const json = await res.json();
        setEndpoints(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEndpoints(); }, [fetchEndpoints]);

  const handleCreate = async () => {
    setCreating(true);
    setCreatedSecret(null);
    try {
      const res = await fetch("/api/v1/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEndpoint),
      });
      if (res.ok) {
        const json = await res.json();
        setCreatedSecret(json.data.secret);
        setNewEndpoint({ url: "", subscribedEvents: ["case.created", "case.status_changed"] });
        await fetchEndpoints();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await fetch(`/api/v1/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    await fetchEndpoints();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this webhook endpoint? All delivery history will be lost.")) return;
    await fetch(`/api/v1/webhooks/${id}`, { method: "DELETE" });
    await fetchEndpoints();
  };

  const handleDeliver = async () => {
    const res = await fetch("/api/jobs/webhooks/deliver", { method: "POST" });
    if (res.ok) {
      const json = await res.json();
      alert(`Processed ${json.data.processed} deliveries: ${json.data.succeeded} succeeded, ${json.data.failed} failed`);
      await fetchEndpoints();
    }
  };

  const toggleEvent = (evt: string) => {
    setNewEndpoint((prev) => ({
      ...prev,
      subscribedEvents: prev.subscribedEvents.includes(evt)
        ? prev.subscribedEvents.filter((e) => e !== evt)
        : [...prev.subscribedEvents, evt],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="mt-1 text-sm text-gray-500">Configure webhook endpoints to receive real-time event notifications</p>
        </div>
        <button
          onClick={handleDeliver}
          className="inline-flex items-center rounded-md bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500"
        >
          Process Pending Deliveries
        </button>
      </div>

      {/* Created Secret Alert */}
      {createdSecret && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-800">
            Webhook signing secret (HMAC). Store securely — shown only once!
          </p>
          <code className="mt-2 block bg-amber-100 p-2 rounded text-sm font-mono break-all">{createdSecret}</code>
        </div>
      )}

      {/* Create Form */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">Add Endpoint</h2>
        <div className="space-y-4">
          <input
            type="url"
            placeholder="https://your-app.example.com/webhooks/privacy-pilot"
            value={newEndpoint.url}
            onChange={(e) => setNewEndpoint((p) => ({ ...p, url: e.target.value }))}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {EVENT_TYPES.map((evt) => (
                <label key={evt} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={newEndpoint.subscribedEvents.includes(evt)}
                    onChange={() => toggleEvent(evt)}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm text-gray-600">{evt}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newEndpoint.url || newEndpoint.subscribedEvents.length === 0}
            className="inline-flex justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Add Endpoint"}
          </button>
        </div>
      </div>

      {/* Endpoints Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Events</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deliveries</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Failures</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">Loading...</td></tr>
            ) : endpoints.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No webhook endpoints configured</td></tr>
            ) : endpoints.map((ep) => (
              <tr key={ep.id}>
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{ep.url}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <span className="text-xs">{ep.subscribedEvents.length} events</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {ep.enabled ? (
                    <span className="inline-flex rounded-full bg-green-100 px-2 text-xs font-semibold leading-5 text-green-800">Enabled</span>
                  ) : (
                    <span className="inline-flex rounded-full bg-gray-100 px-2 text-xs font-semibold leading-5 text-gray-800">Disabled</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ep._count.deliveries}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {ep.failureCount > 5 ? (
                    <span className="text-red-600 font-medium">{ep.failureCount}</span>
                  ) : (
                    <span className="text-gray-500">{ep.failureCount}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                  <button
                    onClick={() => handleToggle(ep.id, ep.enabled)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    {ep.enabled ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => handleDelete(ep.id)} className="text-red-600 hover:text-red-900">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
