"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* -- Types ----------------------------------------------------------------- */

interface IntegrationItem {
  id: string;
  provider: string;
  name: string;
  status: string;
  healthStatus: string;
  lastSuccessAt: string | null;
  lastHealthCheckAt: string | null;
  lastError: string | null;
  hasSecret: boolean;
  owner: { id: string; name: string; email: string } | null;
  _count: { dataCollectionItems: number };
  createdAt: string;
}

interface ProviderInfo {
  provider: string;
  name: string;
  description: string;
  available: boolean;
  comingSoon?: boolean;
  phase: number;
}

/* -- Phase configuration --------------------------------------------------- */

const PHASE_HEADERS: Record<number, { title: string; badge?: string }> = {
  1: { title: "Microsoft (Production Ready)" },
  2: { title: "Business Applications (Coming Soon)", badge: "Coming Soon" },
  3: { title: "Collaboration & HR (Planned)", badge: "Planned" },
  4: { title: "Cloud Infrastructure (Planned)", badge: "Planned" },
};

/* -- Provider icon config -------------------------------------------------- */

const PROVIDER_ICON_MAP: Record<string, { label: string; bg: string; text: string }> = {
  M365:                  { label: "M365", bg: "bg-orange-500",  text: "text-white" },
  SHAREPOINT:            { label: "SP",   bg: "bg-teal-600",    text: "text-white" },
  EXCHANGE_ONLINE:       { label: "EXO",  bg: "bg-blue-500",    text: "text-white" },
  ONEDRIVE:              { label: "OD",   bg: "bg-blue-400",    text: "text-white" },
  GOOGLE_WORKSPACE:      { label: "GW",   bg: "bg-red-400",     text: "text-white" },
  GOOGLE:                { label: "GW",   bg: "bg-blue-500",    text: "text-white" },
  SALESFORCE:            { label: "SF",   bg: "bg-sky-500",     text: "text-white" },
  SERVICENOW:            { label: "SN",   bg: "bg-green-600",   text: "text-white" },
  ATLASSIAN_JIRA:        { label: "JRA",  bg: "bg-blue-600",    text: "text-white" },
  ATLASSIAN_CONFLUENCE:  { label: "CFN",  bg: "bg-blue-500",    text: "text-white" },
  WORKDAY:               { label: "WD",   bg: "bg-orange-600",  text: "text-white" },
  SAP_SUCCESSFACTORS:    { label: "SAP",  bg: "bg-blue-800",    text: "text-white" },
  OKTA:                  { label: "OKT",  bg: "bg-indigo-500",  text: "text-white" },
  AWS:                   { label: "AWS",  bg: "bg-yellow-500",  text: "text-gray-900" },
  AZURE:                 { label: "AZ",   bg: "bg-blue-600",    text: "text-white" },
  GCP:                   { label: "GCP",  bg: "bg-red-500",     text: "text-white" },
};

function getProviderIcon(provider: string) {
  const config = PROVIDER_ICON_MAP[provider] ?? {
    label: provider.slice(0, 3).toUpperCase(),
    bg: "bg-gray-500",
    text: "text-white",
  };
  return config;
}

/* -- Fallback providers (all 15, grouped by phase) ------------------------- */

const FALLBACK_PROVIDERS: ProviderInfo[] = [
  // Phase 1 - Microsoft (Production Ready)
  { provider: "M365",              name: "Microsoft 365",        description: "Exchange, OneDrive, Teams",    available: true,  phase: 1 },
  { provider: "SHAREPOINT",        name: "SharePoint",           description: "Sites, document libraries",    available: true,  phase: 1 },
  { provider: "EXCHANGE_ONLINE",   name: "Exchange Online",      description: "Mailboxes, calendars",         available: true,  phase: 1 },
  { provider: "ONEDRIVE",          name: "OneDrive",             description: "Personal cloud storage",       available: true,  phase: 1 },
  // Phase 2 - Business Applications (Coming Soon)
  { provider: "SALESFORCE",        name: "Salesforce",           description: "CRM data, contacts",           available: false, comingSoon: true, phase: 2 },
  { provider: "SERVICENOW",        name: "ServiceNow",           description: "ITSM, CMDB records",          available: false, comingSoon: true, phase: 2 },
  { provider: "GOOGLE_WORKSPACE",  name: "Google Workspace",     description: "Gmail, Drive, Calendar",       available: false, comingSoon: true, phase: 2 },
  // Phase 3 - Collaboration & HR (Planned)
  { provider: "ATLASSIAN_JIRA",       name: "Atlassian Jira",       description: "Issues, projects, boards",     available: false, comingSoon: true, phase: 3 },
  { provider: "ATLASSIAN_CONFLUENCE", name: "Atlassian Confluence", description: "Pages, spaces, wikis",         available: false, comingSoon: true, phase: 3 },
  { provider: "WORKDAY",              name: "Workday",              description: "HR, payroll, talent",           available: false, comingSoon: true, phase: 3 },
  { provider: "SAP_SUCCESSFACTORS",   name: "SAP SuccessFactors",   description: "HR, employee records",         available: false, comingSoon: true, phase: 3 },
  { provider: "OKTA",                 name: "Okta",                 description: "Identity, SSO, directory",     available: false, comingSoon: true, phase: 3 },
  // Phase 4 - Cloud Infrastructure (Planned)
  { provider: "AWS",   name: "AWS",   description: "S3, DynamoDB, RDS",        available: false, comingSoon: true, phase: 4 },
  { provider: "AZURE", name: "Azure", description: "Blob Storage, SQL, AD",    available: false, comingSoon: true, phase: 4 },
  { provider: "GCP",   name: "GCP",   description: "Cloud Storage, BigQuery",  available: false, comingSoon: true, phase: 4 },
];

/* -- Status / health helpers ----------------------------------------------- */

const HEALTH_COLORS: Record<string, string> = {
  HEALTHY:        "bg-green-100 text-green-800",
  DEGRADED:       "bg-yellow-100 text-yellow-800",
  FAILED:         "bg-red-100 text-red-800",
  NOT_CONFIGURED: "bg-gray-100 text-gray-600",
};

const HEALTH_LABELS: Record<string, string> = {
  HEALTHY:        "Healthy",
  DEGRADED:       "Degraded",
  FAILED:         "Failed",
  NOT_CONFIGURED: "Not Configured",
};

const STATUS_COLORS: Record<string, string> = {
  ENABLED:  "bg-green-100 text-green-800",
  DISABLED: "bg-gray-100 text-gray-600",
};

/* -- Helper: group providers by phase -------------------------------------- */

function groupByPhase(list: ProviderInfo[]): Record<number, ProviderInfo[]> {
  const grouped: Record<number, ProviderInfo[]> = {};
  for (const p of list) {
    const phase = p.phase ?? 1;
    if (!grouped[phase]) grouped[phase] = [];
    grouped[phase].push(p);
  }
  return grouped;
}

/* -- Component ------------------------------------------------------------- */

export default function IntegrationsPage() {
  const router = useRouter();

  // Data
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add integration modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [integrationName, setIntegrationName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Toggle loading tracker (by integration id)
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /* -- Fetch integrations -------------------------------------------------- */

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/integrations");
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? `Failed to load integrations (${res.status})`);
        return;
      }
      const json = await res.json();
      setIntegrations(json.data ?? []);
      setProviders(json.providers ?? []);
    } catch {
      setError("An unexpected error occurred while loading integrations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  /* -- Add integration ----------------------------------------------------- */

  function openAddModal() {
    setShowAddModal(true);
    setAddStep(1);
    setSelectedProvider("");
    setIntegrationName("");
    setCreateError("");
  }

  function closeAddModal() {
    setShowAddModal(false);
    setAddStep(1);
    setSelectedProvider("");
    setIntegrationName("");
    setCreateError("");
  }

  function handleSelectProvider(provider: string) {
    setSelectedProvider(provider);
    setIntegrationName("");
    setCreateError("");
    setAddStep(2);
  }

  function handleBackToStep1() {
    setAddStep(1);
    setSelectedProvider("");
    setIntegrationName("");
    setCreateError("");
  }

  async function handleCreateIntegration(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProvider || !integrationName.trim()) return;

    setCreating(true);
    setCreateError("");

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          name: integrationName.trim(),
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setCreateError(json?.error ?? `Failed to create integration (${res.status})`);
        return;
      }

      const created = await res.json();
      closeAddModal();
      router.push(`/integrations/${created.id}`);
    } catch {
      setCreateError("An unexpected error occurred.");
    } finally {
      setCreating(false);
    }
  }

  /* -- Toggle enable/disable ----------------------------------------------- */

  async function handleToggleStatus(integration: IntegrationItem) {
    const newStatus = integration.status === "ENABLED" ? "DISABLED" : "ENABLED";
    setTogglingId(integration.id);

    try {
      const res = await fetch(`/api/integrations/${integration.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setIntegrations((prev) =>
          prev.map((item) =>
            item.id === integration.id ? { ...item, status: newStatus } : item
          )
        );
      }
    } catch {
      /* silently fail */
    } finally {
      setTogglingId(null);
    }
  }

  /* -- Helpers ------------------------------------------------------------- */

  function formatTimestamp(ts: string | null): string {
    if (!ts) return "--";
    const date = new Date(ts);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getProviderDisplayName(provider: string): string {
    const found = providers.find((p) => p.provider === provider);
    if (found) return found.name;
    // Check fallback list
    const fallback = FALLBACK_PROVIDERS.find((p) => p.provider === provider);
    if (fallback) return fallback.name;
    // Last-resort fallback
    const names: Record<string, string> = {
      M365: "Microsoft 365",
      SHAREPOINT: "SharePoint",
      EXCHANGE_ONLINE: "Exchange Online",
      ONEDRIVE: "OneDrive",
      GOOGLE: "Google Workspace",
      GOOGLE_WORKSPACE: "Google Workspace",
      SALESFORCE: "Salesforce",
      SERVICENOW: "ServiceNow",
      ATLASSIAN_JIRA: "Atlassian Jira",
      ATLASSIAN_CONFLUENCE: "Atlassian Confluence",
      WORKDAY: "Workday",
      SAP_SUCCESSFACTORS: "SAP SuccessFactors",
      OKTA: "Okta",
      AWS: "AWS",
      AZURE: "Azure",
      GCP: "GCP",
    };
    return names[provider] ?? provider;
  }

  /* -- Render: Phase-grouped provider selection for modal step 1 ----------- */

  function renderPhaseGroupedProviders() {
    const providerList = providers.length > 0 ? providers : FALLBACK_PROVIDERS;
    const grouped = groupByPhase(providerList);
    const sortedPhases = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b);

    return (
      <div className="space-y-6">
        {sortedPhases.map((phase) => {
          const phaseConfig = PHASE_HEADERS[phase] ?? {
            title: `Phase ${phase}`,
          };
          const phaseProviders = grouped[phase];
          const isDimmed = phase >= 2;

          return (
            <div key={phase}>
              {/* Phase section header */}
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  {phaseConfig.title}
                </h3>
                {phaseConfig.badge && (
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      phaseConfig.badge === "Coming Soon"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {phaseConfig.badge}
                  </span>
                )}
              </div>

              {/* Provider cards grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {phaseProviders.map((p) => {
                  const icon = getProviderIcon(p.provider);
                  const isAvailable = p.available && phase === 1;
                  const badgeText =
                    phase === 2
                      ? "Coming Soon"
                      : phase >= 3
                      ? "Planned"
                      : null;

                  return (
                    <button
                      key={p.provider}
                      type="button"
                      onClick={() => {
                        if (isAvailable) handleSelectProvider(p.provider);
                      }}
                      disabled={!isAvailable}
                      className={`group relative flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all ${
                        isAvailable
                          ? "border-gray-200 hover:border-brand-300 hover:bg-brand-50 hover:shadow-sm cursor-pointer"
                          : "border-gray-150 cursor-not-allowed"
                      } ${isDimmed ? "opacity-60" : ""}`}
                    >
                      {badgeText && (
                        <span
                          className={`absolute -right-1 -top-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            badgeText === "Coming Soon"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {badgeText}
                        </span>
                      )}
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${icon.bg} ${icon.text} text-xs font-bold ${
                          isAvailable
                            ? "transition-transform group-hover:scale-110"
                            : ""
                        }`}
                      >
                        {icon.label}
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          isAvailable ? "text-gray-900" : "text-gray-500"
                        }`}
                      >
                        {p.name}
                      </span>
                      <span className="text-xs text-gray-500 line-clamp-2">
                        {p.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* -- Render -------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage data source connections for automated data collection
          </p>
        </div>
        <button onClick={openAddModal} className="btn-primary">
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
          Add Integration
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <svg
              className="h-5 w-5 flex-shrink-0 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={fetchIntegrations}
                className="text-sm font-medium text-red-700 underline hover:text-red-600"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card p-0">
        {loading ? (
          /* Loading skeletons */
          <div className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-32 animate-pulse rounded bg-gray-100" />
                </div>
                <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
                <div className="h-6 w-24 animate-pulse rounded-full bg-gray-200" />
                <div className="h-4 w-36 animate-pulse rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : integrations.length === 0 ? (
          /* Empty state */
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
                d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
              />
            </svg>
            <h3 className="mt-3 text-sm font-semibold text-gray-900">
              No integrations configured
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by adding your first data source connection.
            </p>
            <button onClick={openAddModal} className="btn-primary mt-4">
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
              Add Integration
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3">Provider</th>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Health</th>
                    <th className="px-6 py-3">Last Success</th>
                    <th className="px-6 py-3">Owner</th>
                    <th className="px-6 py-3">Collections</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {integrations.map((integration) => {
                    const icon = getProviderIcon(integration.provider);
                    const isToggling = togglingId === integration.id;

                    return (
                      <tr
                        key={integration.id}
                        className="transition-colors hover:bg-gray-50"
                      >
                        {/* Provider */}
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-full ${icon.bg} ${icon.text} text-xs font-bold`}
                            >
                              {icon.label}
                            </div>
                            <span className="text-sm text-gray-700">
                              {getProviderDisplayName(integration.provider)}
                            </span>
                          </div>
                        </td>

                        {/* Name */}
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900">
                            {integration.name}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="whitespace-nowrap px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              STATUS_COLORS[integration.status] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {integration.status === "ENABLED" ? "Enabled" : "Disabled"}
                          </span>
                        </td>

                        {/* Health */}
                        <td className="whitespace-nowrap px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              HEALTH_COLORS[integration.healthStatus] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {/* Health dot indicator */}
                            <span
                              className={`inline-block h-1.5 w-1.5 rounded-full ${
                                integration.healthStatus === "HEALTHY"
                                  ? "bg-green-500"
                                  : integration.healthStatus === "DEGRADED"
                                  ? "bg-yellow-500"
                                  : integration.healthStatus === "FAILED"
                                  ? "bg-red-500"
                                  : "bg-gray-400"
                              }`}
                            />
                            {HEALTH_LABELS[integration.healthStatus] ?? integration.healthStatus}
                          </span>
                        </td>

                        {/* Last Success */}
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {formatTimestamp(integration.lastSuccessAt)}
                        </td>

                        {/* Owner */}
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                          {integration.owner?.name ?? (
                            <span className="text-gray-400">Unassigned</span>
                          )}
                        </td>

                        {/* Data Collection Count */}
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                          <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                            {integration._count.dataCollectionItems}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/integrations/${integration.id}`}
                              className="text-sm font-medium text-brand-600 hover:text-brand-700"
                            >
                              Configure
                            </Link>
                            <button
                              onClick={() => handleToggleStatus(integration)}
                              disabled={isToggling}
                              className={`text-sm font-medium transition-colors disabled:opacity-50 ${
                                integration.status === "ENABLED"
                                  ? "text-gray-500 hover:text-gray-700"
                                  : "text-green-600 hover:text-green-700"
                              }`}
                            >
                              {isToggling
                                ? "..."
                                : integration.status === "ENABLED"
                                ? "Disable"
                                : "Enable"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="divide-y divide-gray-200 md:hidden">
              {integrations.map((integration) => {
                const icon = getProviderIcon(integration.provider);
                const isToggling = togglingId === integration.id;

                return (
                  <div key={integration.id} className="flex items-center gap-4 p-4">
                    {/* Left: Provider icon */}
                    <div className="flex-shrink-0">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${icon.bg} ${icon.text} text-xs font-bold`}
                      >
                        {icon.label}
                      </div>
                    </div>

                    {/* Middle: Info */}
                    <div className="min-w-0 flex-1">
                      {/* Line 1: Provider display name + Integration name */}
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {getProviderDisplayName(integration.provider)}
                        </span>
                        <span className="text-sm text-gray-500 truncate">
                          {integration.name}
                        </span>
                      </div>

                      {/* Line 2: Health status badge + Status badge */}
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            HEALTH_COLORS[integration.healthStatus] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full ${
                              integration.healthStatus === "HEALTHY"
                                ? "bg-green-500"
                                : integration.healthStatus === "DEGRADED"
                                ? "bg-yellow-500"
                                : integration.healthStatus === "FAILED"
                                ? "bg-red-500"
                                : "bg-gray-400"
                            }`}
                          />
                          {HEALTH_LABELS[integration.healthStatus] ?? integration.healthStatus}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            STATUS_COLORS[integration.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {integration.status === "ENABLED" ? "Enabled" : "Disabled"}
                        </span>
                      </div>

                      {/* Line 3: Last success timestamp */}
                      <div className="mt-1 text-xs text-gray-500">
                        Last: {formatTimestamp(integration.lastSuccessAt)}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <Link
                        href={`/integrations/${integration.id}`}
                        className="text-sm font-medium text-brand-600 hover:text-brand-700 min-h-[44px] flex items-center"
                      >
                        Configure
                      </Link>
                      <button
                        onClick={() => handleToggleStatus(integration)}
                        disabled={isToggling}
                        className={`text-sm font-medium transition-colors disabled:opacity-50 min-h-[44px] px-3 ${
                          integration.status === "ENABLED"
                            ? "text-gray-500 hover:text-gray-700"
                            : "text-green-600 hover:text-green-700"
                        }`}
                      >
                        {isToggling
                          ? "..."
                          : integration.status === "ENABLED"
                          ? "Disable"
                          : "Enable"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* -- Add Integration Modal ------------------------------------------ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-900/50 transition-opacity"
            onClick={closeAddModal}
          />

          {/* Modal panel */}
          <div className="relative z-10 mx-4 w-full max-w-2xl max-h-[90vh] rounded-lg bg-white shadow-xl sm:mx-auto md:mx-auto flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Add Integration
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {addStep === 1
                    ? "Choose a data source provider"
                    : "Name your integration"}
                </p>
              </div>
              <button
                onClick={closeAddModal}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Step indicator */}
            <div className="border-b border-gray-200 px-6 py-3 flex-shrink-0">
              <div className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    addStep >= 1
                      ? "bg-brand-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  1
                </span>
                <span
                  className={
                    addStep >= 1
                      ? "font-medium text-gray-900"
                      : "text-gray-500"
                  }
                >
                  Select Provider
                </span>
                <svg
                  className="h-4 w-4 text-gray-300"
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
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    addStep >= 2
                      ? "bg-brand-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  2
                </span>
                <span
                  className={
                    addStep >= 2
                      ? "font-medium text-gray-900"
                      : "text-gray-500"
                  }
                >
                  Name Integration
                </span>
              </div>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto px-6 py-5 flex-1">
              {addStep === 1 && renderPhaseGroupedProviders()}

              {addStep === 2 && (
                <div>
                  {/* Selected provider preview */}
                  <div className="mb-5 flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
                    {(() => {
                      const icon = getProviderIcon(selectedProvider);
                      return (
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full ${icon.bg} ${icon.text} text-xs font-bold`}
                        >
                          {icon.label}
                        </div>
                      );
                    })()}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {getProviderDisplayName(selectedProvider)}
                      </p>
                      <button
                        type="button"
                        onClick={handleBackToStep1}
                        className="text-xs text-brand-600 hover:text-brand-700"
                      >
                        Change provider
                      </button>
                    </div>
                  </div>

                  {createError && (
                    <div className="mb-4 rounded-md bg-red-50 p-3">
                      <p className="text-sm text-red-700">{createError}</p>
                    </div>
                  )}

                  <form onSubmit={handleCreateIntegration}>
                    <div>
                      <label htmlFor="integration-name" className="label">
                        Integration Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="integration-name"
                        type="text"
                        value={integrationName}
                        onChange={(e) => setIntegrationName(e.target.value)}
                        className="input-field"
                        placeholder={`e.g., Production ${getProviderDisplayName(selectedProvider)}`}
                        required
                        minLength={1}
                        maxLength={200}
                        autoFocus
                      />
                      <p className="mt-1.5 text-xs text-gray-500">
                        Give this integration a descriptive name to identify it later.
                      </p>
                    </div>

                    <div className="mt-5 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={handleBackToStep1}
                        className="btn-secondary"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={creating || !integrationName.trim()}
                        className="btn-primary"
                      >
                        {creating ? (
                          <span className="flex items-center gap-2">
                            <svg
                              className="h-4 w-4 animate-spin"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                            Creating...
                          </span>
                        ) : (
                          "Create & Configure"
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
