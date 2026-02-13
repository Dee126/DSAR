"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

/* ── Types ────────────────────────────────────────────────────────────── */

interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "textarea" | "select";
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: { label: string; value: string }[];
  isSecret?: boolean;
}

interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  scopeFields?: ConfigField[];
  defaultScope?: Record<string, unknown>;
  fields?: ConfigField[]; // legacy compat
}

interface AuditEvent {
  id: string;
  action: string;
  createdAt: string;
  details: Record<string, unknown> | null;
  actor: { id: string; name: string; email: string } | null;
}

interface IntegrationDetail {
  id: string;
  provider: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
  healthStatus: string;
  lastSuccessAt: string | null;
  lastHealthCheckAt: string | null;
  lastError: string | null;
  hasSecret: boolean;
  owner: { id: string; name: string; email: string } | null;
  _count: { dataCollectionItems: number };
  createdAt: string;
  updatedAt: string;
  configFields: ConfigField[];
  queryTemplates: QueryTemplate[];
  auditEvents: AuditEvent[];
}

interface TestResult {
  healthy: boolean;
  message?: string;
  error?: string;
}

interface Toast {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

type TabKey = "configuration" | "health" | "permissions";

/* ── Health status helpers ─────────────────────────────────────────────── */

const HEALTH_COLORS: Record<string, string> = {
  HEALTHY: "bg-green-100 text-green-800 border-green-200",
  UNHEALTHY: "bg-red-100 text-red-800 border-red-200",
  DEGRADED: "bg-yellow-100 text-yellow-800 border-yellow-200",
  UNKNOWN: "bg-gray-100 text-gray-800 border-gray-200",
};

const HEALTH_LABELS: Record<string, string> = {
  HEALTHY: "Healthy",
  UNHEALTHY: "Unhealthy",
  DEGRADED: "Degraded",
  UNKNOWN: "Unknown",
};

const STATUS_COLORS: Record<string, string> = {
  ENABLED: "bg-green-100 text-green-800",
  DISABLED: "bg-gray-100 text-gray-600",
  ERROR: "bg-red-100 text-red-800",
};

/* ── SVG Icons (inline, no external library) ──────────────────────────── */

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ExclamationTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function LockClosedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

/* ── Component ────────────────────────────────────────────────────────── */

export default function IntegrationDetailPage() {
  const params = useParams();
  const integrationId = params.id as string;

  const [integration, setIntegration] = useState<IntegrationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("configuration");

  // Configuration form state
  const [name, setName] = useState("");
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Toggle enable/disable
  const [toggling, setToggling] = useState(false);

  // Test connection
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useState(0);

  function addToast(type: Toast["type"], message: string) {
    const id = ++toastIdRef[0];
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }

  function removeToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  /* ── Data fetching ───────────────────────────────────────────────── */

  const fetchIntegration = useCallback(async () => {
    try {
      const res = await fetch(`/api/integrations/${integrationId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Integration not found.");
        } else {
          const body = await res.json().catch(() => null);
          setError(body?.error || `Failed to load integration (${res.status}).`);
        }
        return;
      }
      const data: IntegrationDetail = await res.json();
      setIntegration(data);
      setError(null);

      // Initialize form state from fetched data
      setName(data.name);
      const cfg: Record<string, string> = {};
      const sec: Record<string, string> = {};
      for (const field of data.configFields) {
        if (field.isSecret) {
          sec[field.key] = "";
        } else {
          cfg[field.key] = String(data.config[field.key] ?? "");
        }
      }
      setConfigValues(cfg);
      setSecretValues(sec);
    } catch {
      setError("Failed to connect to the server.");
    } finally {
      setLoading(false);
    }
  }, [integrationId]);

  useEffect(() => {
    fetchIntegration();
  }, [fetchIntegration]);

  /* ── Handlers ────────────────────────────────────────────────────── */

  async function handleSaveConfiguration(e: FormEvent) {
    e.preventDefault();
    if (!integration) return;
    setSaving(true);
    try {
      // Build config and secrets payloads
      const config: Record<string, unknown> = {};
      const secrets: Record<string, string> = {};

      for (const field of integration.configFields) {
        if (field.isSecret) {
          if (secretValues[field.key]) {
            secrets[field.key] = secretValues[field.key];
          }
        } else {
          config[field.key] = configValues[field.key];
        }
      }

      const res = await fetch(`/api/integrations/${integrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, config, secrets }),
      });

      if (res.ok) {
        addToast("success", "Configuration saved successfully.");
        // Clear secret fields after successful save
        const clearedSecrets: Record<string, string> = {};
        for (const key of Object.keys(secretValues)) {
          clearedSecrets[key] = "";
        }
        setSecretValues(clearedSecrets);
        await fetchIntegration();
      } else {
        const body = await res.json().catch(() => null);
        addToast("error", body?.error || "Failed to save configuration.");
      }
    } catch {
      addToast("error", "Failed to connect to the server.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!integration) return;
    setToggling(true);
    const newStatus = integration.status === "ENABLED" ? "DISABLED" : "ENABLED";
    try {
      const res = await fetch(`/api/integrations/${integrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        addToast("success", `Integration ${newStatus === "ENABLED" ? "enabled" : "disabled"} successfully.`);
        await fetchIntegration();
      } else {
        const body = await res.json().catch(() => null);
        addToast("error", body?.error || "Failed to update status.");
      }
    } catch {
      addToast("error", "Failed to connect to the server.");
    } finally {
      setToggling(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/integrations/${integrationId}/test`, {
        method: "POST",
      });

      if (res.ok) {
        const result: TestResult = await res.json();
        setTestResult(result);
        if (result.healthy) {
          addToast("success", "Connection test passed.");
        } else {
          addToast("error", result.error || "Connection test failed.");
        }
      } else {
        const body = await res.json().catch(() => null);
        setTestResult({ healthy: false, error: body?.error || "Test request failed." });
        addToast("error", body?.error || "Connection test request failed.");
      }
    } catch {
      setTestResult({ healthy: false, error: "Failed to connect to the server." });
      addToast("error", "Failed to connect to the server.");
    } finally {
      setTesting(false);
    }
  }

  function handleConfigChange(key: string, value: string) {
    setConfigValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSecretChange(key: string, value: string) {
    setSecretValues((prev) => ({ ...prev, [key]: value }));
  }

  /* ── Loading State ───────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="card h-16 animate-pulse" />
        <div className="card h-64 animate-pulse" />
      </div>
    );
  }

  /* ── Error State ─────────────────────────────────────────────────── */

  if (error || !integration) {
    return (
      <div className="py-16 text-center">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-4 text-gray-500">{error || "Integration not found."}</p>
        <Link href="/integrations" className="btn-primary mt-4 inline-flex">
          Back to Integrations
        </Link>
      </div>
    );
  }

  /* ── Tab definitions ─────────────────────────────────────────────── */

  const tabs: { key: TabKey; label: string }[] = [
    { key: "configuration", label: "Configuration" },
    { key: "health", label: "Health & Logs" },
    { key: "permissions", label: "Permissions" },
  ];

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed right-4 top-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg transition-all ${
                toast.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : toast.type === "error"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-blue-200 bg-blue-50 text-blue-800"
              }`}
            >
              {toast.type === "success" && <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-green-500" />}
              {toast.type === "error" && <XCircleIcon className="h-5 w-5 flex-shrink-0 text-red-500" />}
              {toast.type === "info" && <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 text-blue-500" />}
              <p className="text-sm font-medium">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-2 flex-shrink-0 text-current opacity-60 hover:opacity-100"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/integrations"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{integration.name}</h1>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  STATUS_COLORS[integration.status] ?? "bg-gray-100 text-gray-800"
                }`}
              >
                {integration.status}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  HEALTH_COLORS[integration.healthStatus] ?? HEALTH_COLORS.UNKNOWN
                }`}
              >
                {integration.healthStatus === "HEALTHY" && <CheckCircleIcon className="h-3 w-3" />}
                {integration.healthStatus === "UNHEALTHY" && <XCircleIcon className="h-3 w-3" />}
                {integration.healthStatus === "DEGRADED" && <ExclamationTriangleIcon className="h-3 w-3" />}
                {HEALTH_LABELS[integration.healthStatus] ?? "Unknown"}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Provider: {integration.provider}
              {integration._count.dataCollectionItems > 0 && (
                <span className="ml-3">
                  {integration._count.dataCollectionItems} data collection{" "}
                  {integration._count.dataCollectionItems === 1 ? "item" : "items"}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Configuration Tab ────────────────────────────────────────── */}
      {activeTab === "configuration" && (
        <div className="space-y-6">
          {/* Actions bar */}
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <BoltIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Integration Status</p>
                  <p className="text-xs text-gray-500">
                    {integration.status === "ENABLED"
                      ? "This integration is currently active and processing requests."
                      : "This integration is currently disabled."}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="btn-secondary"
                >
                  {testing ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                      Testing...
                    </span>
                  ) : (
                    "Test Connection"
                  )}
                </button>
                <button
                  onClick={handleToggleStatus}
                  disabled={toggling}
                  className={
                    integration.status === "ENABLED" ? "btn-danger" : "btn-primary"
                  }
                >
                  {toggling
                    ? "Updating..."
                    : integration.status === "ENABLED"
                      ? "Disable"
                      : "Enable"}
                </button>
              </div>
            </div>

            {/* Test result feedback */}
            {testResult && (
              <div
                className={`mt-4 flex items-start gap-3 rounded-lg border p-4 ${
                  testResult.healthy
                    ? "border-green-200 bg-green-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                {testResult.healthy ? (
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                ) : (
                  <XCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                )}
                <div>
                  <p
                    className={`text-sm font-medium ${
                      testResult.healthy ? "text-green-800" : "text-red-800"
                    }`}
                  >
                    {testResult.healthy ? "Connection Successful" : "Connection Failed"}
                  </p>
                  <p
                    className={`mt-1 text-sm ${
                      testResult.healthy ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {testResult.healthy
                      ? testResult.message || "The integration is reachable and responding correctly."
                      : testResult.error || "Could not establish a connection to the integration."}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Configuration form */}
          <form onSubmit={handleSaveConfiguration} className="card">
            <h2 className="text-lg font-semibold text-gray-900">Configuration</h2>
            <p className="mt-1 text-sm text-gray-500">
              Configure the connection settings for this {integration.provider} integration.
            </p>

            <div className="mt-6 space-y-5">
              {/* Integration name */}
              <div>
                <label htmlFor="integration-name" className="label">
                  Integration Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="integration-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  required
                  placeholder="Enter a descriptive name"
                />
                <p className="mt-1 text-xs text-gray-400">
                  A friendly name to identify this integration within your organization.
                </p>
              </div>

              {/* Provider info (read-only) */}
              <div>
                <label className="label">Provider</label>
                <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <BoltIcon className="h-4 w-4 text-gray-400" />
                  {integration.provider}
                </div>
              </div>

              {/* Dynamic config fields */}
              {integration.configFields.length > 0 && (
                <div className="border-t border-gray-200 pt-5">
                  <h3 className="text-sm font-semibold text-gray-700">Provider Settings</h3>
                  <div className="mt-4 space-y-4">
                    {integration.configFields.map((field) => (
                      <div key={field.key}>
                        <label htmlFor={`field-${field.key}`} className="label">
                          {field.label}
                          {field.required && <span className="text-red-500"> *</span>}
                        </label>

                        {field.isSecret ? (
                          /* Secret field */
                          <div className="relative">
                            <input
                              id={`field-${field.key}`}
                              type="password"
                              value={secretValues[field.key] ?? ""}
                              onChange={(e) => handleSecretChange(field.key, e.target.value)}
                              className="input-field pr-10"
                              placeholder={
                                integration.hasSecret && !secretValues[field.key]
                                  ? "Secret configured"
                                  : field.placeholder || ""
                              }
                              required={field.required && !integration.hasSecret}
                            />
                            <LockClosedIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            {integration.hasSecret && !secretValues[field.key] && (
                              <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                                <CheckCircleIcon className="h-3 w-3" />
                                Secret configured. Leave empty to keep current value.
                              </p>
                            )}
                          </div>
                        ) : field.type === "textarea" ? (
                          /* Textarea field */
                          <textarea
                            id={`field-${field.key}`}
                            value={configValues[field.key] ?? ""}
                            onChange={(e) => handleConfigChange(field.key, e.target.value)}
                            className="input-field resize-y"
                            rows={3}
                            placeholder={field.placeholder || ""}
                            required={field.required}
                          />
                        ) : field.type === "select" ? (
                          /* Select field */
                          <select
                            id={`field-${field.key}`}
                            value={configValues[field.key] ?? ""}
                            onChange={(e) => handleConfigChange(field.key, e.target.value)}
                            className="input-field"
                            required={field.required}
                          >
                            <option value="">Select...</option>
                            {field.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : field.type === "password" ? (
                          /* Password field (non-secret) */
                          <input
                            id={`field-${field.key}`}
                            type="password"
                            value={configValues[field.key] ?? ""}
                            onChange={(e) => handleConfigChange(field.key, e.target.value)}
                            className="input-field"
                            placeholder={field.placeholder || ""}
                            required={field.required}
                          />
                        ) : (
                          /* Text field */
                          <input
                            id={`field-${field.key}`}
                            type="text"
                            value={configValues[field.key] ?? ""}
                            onChange={(e) => handleConfigChange(field.key, e.target.value)}
                            className="input-field"
                            placeholder={field.placeholder || ""}
                            required={field.required}
                          />
                        )}

                        {field.description && (
                          <p className="mt-1 text-xs text-gray-400">{field.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Query templates (read-only info) */}
              {integration.queryTemplates.length > 0 && (
                <div className="border-t border-gray-200 pt-5">
                  <h3 className="text-sm font-semibold text-gray-700">Query Templates</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    These templates are available for data collection requests using this integration.
                  </p>
                  <div className="mt-3 space-y-2">
                    {integration.queryTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                      >
                        <p className="text-sm font-medium text-gray-900">{template.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{template.description}</p>
                        {(template.scopeFields ?? template.fields ?? []).length > 0 && (
                          <p className="mt-1 text-xs text-gray-400">
                            Scope fields: {(template.scopeFields ?? template.fields ?? []).map((f) => f.label).join(", ")}
                          </p>
                        )}
                        {template.defaultScope && Object.keys(template.defaultScope).length > 0 && (
                          <p className="mt-1 text-xs text-gray-400">
                            Default scope: {Object.entries(template.defaultScope).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Save button */}
            <div className="mt-6 flex items-center justify-end border-t border-gray-200 pt-4">
              <button type="submit" disabled={saving || !name.trim()} className="btn-primary">
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving...
                  </span>
                ) : (
                  "Save Configuration"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Health & Logs Tab ────────────────────────────────────────── */}
      {activeTab === "health" && (
        <div className="space-y-6">
          {/* Health overview */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900">Health Status</h2>
            <div className="mt-4 flex flex-wrap items-start gap-6">
              {/* Large health badge */}
              <div
                className={`flex items-center gap-3 rounded-xl border-2 px-6 py-4 ${
                  HEALTH_COLORS[integration.healthStatus] ?? HEALTH_COLORS.UNKNOWN
                }`}
              >
                {integration.healthStatus === "HEALTHY" && (
                  <CheckCircleIcon className="h-8 w-8 text-green-500" />
                )}
                {integration.healthStatus === "UNHEALTHY" && (
                  <XCircleIcon className="h-8 w-8 text-red-500" />
                )}
                {integration.healthStatus === "DEGRADED" && (
                  <ExclamationTriangleIcon className="h-8 w-8 text-yellow-500" />
                )}
                {!["HEALTHY", "UNHEALTHY", "DEGRADED"].includes(integration.healthStatus) && (
                  <ExclamationTriangleIcon className="h-8 w-8 text-gray-400" />
                )}
                <div>
                  <p className="text-lg font-bold">
                    {HEALTH_LABELS[integration.healthStatus] ?? "Unknown"}
                  </p>
                  <p className="text-xs opacity-75">Current Status</p>
                </div>
              </div>

              {/* Health details */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-700">Last Health Check:</span>
                  <span className="text-gray-600">
                    {integration.lastHealthCheckAt
                      ? new Date(integration.lastHealthCheckAt).toLocaleString()
                      : "Never"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircleIcon className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-700">Last Success:</span>
                  <span className="text-gray-600">
                    {integration.lastSuccessAt
                      ? new Date(integration.lastSuccessAt).toLocaleString()
                      : "Never"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-700">Created:</span>
                  <span className="text-gray-600">
                    {new Date(integration.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-700">Last Updated:</span>
                  <span className="text-gray-600">
                    {new Date(integration.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Last error */}
          {integration.lastError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <XCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                <div>
                  <h3 className="text-sm font-semibold text-red-800">Last Error</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-red-700">
                    {integration.lastError}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Audit events log */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900">
              Audit Events ({integration.auditEvents.length})
            </h2>
            {integration.auditEvents.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">No audit events recorded yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="pb-2 pr-4">Timestamp</th>
                      <th className="pb-2 pr-4">Actor</th>
                      <th className="pb-2 pr-4">Action</th>
                      <th className="pb-2">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {integration.auditEvents.map((event) => (
                      <tr key={event.id}>
                        <td className="whitespace-nowrap py-2.5 pr-4 text-gray-500">
                          {new Date(event.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-4">
                          {event.actor ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-600">
                                {event.actor.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </div>
                              <span className="text-gray-900">{event.actor.name}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">System</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                            {event.action}
                          </span>
                        </td>
                        <td className="py-2.5 text-gray-600">
                          {event.details ? (
                            <span className="max-w-xs truncate text-xs">
                              {Object.entries(event.details)
                                .map(([k, v]) => `${k}: ${String(v)}`)
                                .join(", ")}
                            </span>
                          ) : (
                            <span className="text-gray-400">--</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Permissions Tab ──────────────────────────────────────────── */}
      {activeTab === "permissions" && (
        <div className="space-y-6">
          {/* Owner info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900">Integration Owner</h2>
            <div className="mt-4">
              {integration.owner ? (
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                    {integration.owner.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{integration.owner.name}</p>
                    <p className="text-sm text-gray-500">{integration.owner.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No owner assigned to this integration.</p>
              )}
            </div>
          </div>

          {/* RBAC information */}
          <div className="card">
            <div className="flex items-center gap-3">
              <ShieldCheckIcon className="h-5 w-5 text-brand-600" />
              <h2 className="text-lg font-semibold text-gray-900">Role-Based Access</h2>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Access to this integration is governed by the platform&apos;s role-based access control (RBAC) system.
              Permissions are enforced server-side on every request.
            </p>

            <div className="mt-6 space-y-4">
              {/* Tenant Admin + DPO */}
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100">
                    <ShieldCheckIcon className="h-4 w-4 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Tenant Admin &amp; DPO</p>
                    <p className="text-xs text-gray-500">Full configuration access</p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 pl-11">
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-green-500" />
                    Create, edit, and delete integrations
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-green-500" />
                    Configure connection settings and secrets
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-green-500" />
                    Enable or disable integrations
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-green-500" />
                    Test connections and view health status
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-green-500" />
                    View audit logs
                  </li>
                </ul>
              </div>

              {/* Case Manager */}
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                    <UserIcon className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Case Manager</p>
                    <p className="text-xs text-gray-500">Operational access</p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 pl-11">
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-green-500" />
                    View integration details and health status
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-green-500" />
                    Initiate data collection requests through integrations
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <XCircleIcon className="h-4 w-4 flex-shrink-0 text-red-400" />
                    Cannot modify configuration or secrets
                  </li>
                </ul>
              </div>

              {/* Contributor */}
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                    <UserIcon className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Contributor</p>
                    <p className="text-xs text-gray-500">Task-level access</p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 pl-11">
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-green-500" />
                    Work on assigned data collection items
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <XCircleIcon className="h-4 w-4 flex-shrink-0 text-red-400" />
                    Cannot view integration configuration
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <XCircleIcon className="h-4 w-4 flex-shrink-0 text-red-400" />
                    Cannot initiate new data collection requests
                  </li>
                </ul>
              </div>

              {/* Read-Only */}
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                    <EyeIcon className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Read-Only</p>
                    <p className="text-xs text-gray-500">View-only access</p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 pl-11">
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-green-500" />
                    View integration name and health status
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <XCircleIcon className="h-4 w-4 flex-shrink-0 text-red-400" />
                    Cannot view configuration details or secrets
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <XCircleIcon className="h-4 w-4 flex-shrink-0 text-red-400" />
                    Cannot initiate any actions
                  </li>
                </ul>
              </div>
            </div>

            {/* Info note */}
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <LockClosedIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-blue-800">Server-Side Enforcement</p>
                <p className="mt-1 text-sm text-blue-700">
                  All permissions are enforced server-side. The UI may hide certain elements based on
                  your role, but the API will reject unauthorized requests regardless of the client
                  interface used. All access attempts are recorded in the audit log.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
