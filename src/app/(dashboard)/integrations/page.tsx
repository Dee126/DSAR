"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AwsDetailsDrawer from "@/components/AwsDetailsDrawer";

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
  config?: Record<string, unknown>;
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
  4: { title: "Cloud Infrastructure", badge: "Available" },
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
  // Phase 4 - Cloud Infrastructure
  { provider: "AWS",   name: "AWS",   description: "S3, DynamoDB, RDS",        available: true,  phase: 4 },
  { provider: "AZURE", name: "Azure", description: "Blob Storage, SQL, AD",    available: false, comingSoon: true, phase: 4 },
  { provider: "GCP",   name: "GCP",   description: "Cloud Storage, BigQuery",  available: false, comingSoon: true, phase: 4 },
];

/* -- AWS Regions ----------------------------------------------------------- */

const AWS_REGIONS = [
  "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3", "eu-north-1", "eu-south-1",
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-south-1",
  "sa-east-1", "ca-central-1", "me-south-1", "af-south-1",
];

/* -- Status / health helpers ----------------------------------------------- */

const HEALTH_COLORS: Record<string, string> = {
  HEALTHY:        "bg-green-100 text-green-800",
  DEGRADED:       "bg-yellow-100 text-yellow-800",
  FAILED:         "bg-red-100 text-red-800",
  NOT_CONFIGURED: "bg-gray-100 text-gray-600",
};

const HEALTH_LABELS: Record<string, string> = {
  HEALTHY:        "Connected",
  DEGRADED:       "Degraded",
  FAILED:         "Error",
  NOT_CONFIGURED: "Never tested",
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
  const [addStep, setAddStep] = useState<1 | 2 | 3>(1);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [integrationName, setIntegrationName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // AWS-specific config form state
  const [awsRegion, setAwsRegion] = useState("eu-central-1");
  const [awsAuthType, setAwsAuthType] = useState<"access_keys" | "assume_role">("access_keys");
  const [awsAccessKeyId, setAwsAccessKeyId] = useState("");
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState("");
  const [awsSessionToken, setAwsSessionToken] = useState("");
  const [awsRoleArn, setAwsRoleArn] = useState("");
  const [awsExternalId, setAwsExternalId] = useState("");
  const [awsFieldErrors, setAwsFieldErrors] = useState<Record<string, string>>({});

  // Test connection state (within modal)
  const [testingInModal, setTestingInModal] = useState(false);
  const [modalTestResult, setModalTestResult] = useState<{ ok: boolean; account?: string; arn?: string; error?: string } | null>(null);

  // Toggle loading tracker (by integration id)
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Action states for individual integrations
  const [testingId, setTestingId] = useState<string | null>(null);
  const [scanningId, setScanningId] = useState<string | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<{ id: number; type: "success" | "error" | "info"; message: string }[]>([]);
  const toastIdRef = useState(0);

  function addToast(type: "success" | "error" | "info", message: string) {
    const id = ++toastIdRef[0];
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }

  function removeToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  // AWS Details drawer
  const [drawerIntegrationId, setDrawerIntegrationId] = useState<string | null>(null);

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

  function resetAwsFields() {
    setAwsRegion("eu-central-1");
    setAwsAuthType("access_keys");
    setAwsAccessKeyId("");
    setAwsSecretAccessKey("");
    setAwsSessionToken("");
    setAwsRoleArn("");
    setAwsExternalId("");
    setAwsFieldErrors({});
    setTestingInModal(false);
    setModalTestResult(null);
  }

  function openAddModal() {
    setShowAddModal(true);
    setAddStep(1);
    setSelectedProvider("");
    setIntegrationName("");
    setCreateError("");
    resetAwsFields();
  }

  function closeAddModal() {
    setShowAddModal(false);
    setAddStep(1);
    setSelectedProvider("");
    setIntegrationName("");
    setCreateError("");
    resetAwsFields();
  }

  function handleSelectProvider(provider: string) {
    setSelectedProvider(provider);
    setIntegrationName("");
    setCreateError("");
    if (provider === "AWS") {
      setAddStep(2); // AWS-specific configure step
    } else {
      setAddStep(3); // Generic name step for other providers
    }
  }

  function handleBackToStep1() {
    setAddStep(1);
    setSelectedProvider("");
    setIntegrationName("");
    setCreateError("");
    resetAwsFields();
  }

  function validateAwsFields(): boolean {
    const errors: Record<string, string> = {};
    if (!integrationName.trim()) errors.name = "Integration name is required";
    if (!awsAccessKeyId.trim()) errors.accessKeyId = "Access Key ID is required";
    if (!awsSecretAccessKey.trim()) errors.secretAccessKey = "Secret Access Key is required";
    if (awsAuthType === "assume_role" && !awsRoleArn.trim()) errors.roleArn = "Role ARN is required";
    setAwsFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleTestConnectionInModal() {
    if (!validateAwsFields()) return;
    setTestingInModal(true);
    setModalTestResult(null);
    setCreateError("");

    try {
      // First create the integration, then test it
      const res = await fetch("/api/integrations/aws", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: integrationName.trim(),
          region: awsRegion,
          authType: awsAuthType,
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
          sessionToken: awsSessionToken || undefined,
          roleArn: awsAuthType === "assume_role" ? awsRoleArn : undefined,
          externalId: awsAuthType === "assume_role" ? awsExternalId || undefined : undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setCreateError(json?.error ?? `Failed to create integration (${res.status})`);
        setTestingInModal(false);
        return;
      }

      const created = await res.json();

      // Now test the connection
      const testRes = await fetch(`/api/integrations/aws/${created.id}/test`, {
        method: "POST",
      });

      const testJson = await testRes.json();
      setModalTestResult(testJson);

      if (testJson.ok) {
        addToast("success", "AWS integration created and connection verified!");
        closeAddModal();
        fetchIntegrations();
        router.push(`/integrations/${created.id}`);
      } else {
        // Integration was created but test failed - still allow continuing
        setModalTestResult(testJson);
        setCreateError("");
        // Store the ID so we can navigate to it
        addToast("info", "Integration saved. Connection test failed - you can fix credentials later.");
        closeAddModal();
        fetchIntegrations();
      }
    } catch {
      setCreateError("An unexpected error occurred.");
    } finally {
      setTestingInModal(false);
    }
  }

  async function handleCreateAwsIntegration(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAwsFields()) return;

    setCreating(true);
    setCreateError("");

    try {
      const res = await fetch("/api/integrations/aws", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: integrationName.trim(),
          region: awsRegion,
          authType: awsAuthType,
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
          sessionToken: awsSessionToken || undefined,
          roleArn: awsAuthType === "assume_role" ? awsRoleArn : undefined,
          externalId: awsAuthType === "assume_role" ? awsExternalId || undefined : undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setCreateError(json?.error ?? `Failed to create integration (${res.status})`);
        return;
      }

      const created = await res.json();
      addToast("success", "AWS integration created successfully!");
      closeAddModal();
      fetchIntegrations();
      router.push(`/integrations/${created.id}`);
    } catch {
      setCreateError("An unexpected error occurred.");
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateGenericIntegration(e: React.FormEvent) {
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

  /* -- Test connection (from list) ----------------------------------------- */

  async function handleTestConnection(integration: IntegrationItem) {
    setTestingId(integration.id);
    try {
      const endpoint = integration.provider === "AWS"
        ? `/api/integrations/aws/${integration.id}/test`
        : `/api/integrations/${integration.id}/test`;

      const res = await fetch(endpoint, { method: "POST" });
      const json = await res.json();

      if (json.ok) {
        addToast("success", `Connection test passed for ${integration.name}`);
        setIntegrations((prev) =>
          prev.map((item) =>
            item.id === integration.id
              ? { ...item, healthStatus: "HEALTHY", lastSuccessAt: new Date().toISOString(), lastHealthCheckAt: new Date().toISOString(), lastError: null }
              : item
          )
        );
      } else {
        addToast("error", `Connection test failed: ${json.error || "Unknown error"}`);
        setIntegrations((prev) =>
          prev.map((item) =>
            item.id === integration.id
              ? { ...item, healthStatus: "FAILED", lastHealthCheckAt: new Date().toISOString(), lastError: json.error }
              : item
          )
        );
      }
    } catch {
      addToast("error", "Failed to test connection.");
    } finally {
      setTestingId(null);
    }
  }

  /* -- Run scan (from list) ------------------------------------------------ */

  async function handleRunScan(integration: IntegrationItem) {
    setScanningId(integration.id);
    try {
      const res = await fetch(`/api/integrations/aws/${integration.id}/scan`, {
        method: "POST",
      });
      const json = await res.json();

      if (json.status === "COMPLETED") {
        addToast("success", `Scan completed: ${json.summary.totalItems} resources found`);
      } else {
        addToast("error", `Scan failed: ${json.error || "Unknown error"}`);
      }
    } catch {
      addToast("error", "Failed to run scan.");
    } finally {
      setScanningId(null);
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
    const fallback = FALLBACK_PROVIDERS.find((p) => p.provider === provider);
    if (fallback) return fallback.name;
    const names: Record<string, string> = {
      M365: "Microsoft 365", SHAREPOINT: "SharePoint", EXCHANGE_ONLINE: "Exchange Online",
      ONEDRIVE: "OneDrive", GOOGLE: "Google Workspace", GOOGLE_WORKSPACE: "Google Workspace",
      SALESFORCE: "Salesforce", SERVICENOW: "ServiceNow",
      ATLASSIAN_JIRA: "Atlassian Jira", ATLASSIAN_CONFLUENCE: "Atlassian Confluence",
      WORKDAY: "Workday", SAP_SUCCESSFACTORS: "SAP SuccessFactors", OKTA: "Okta",
      AWS: "AWS", AZURE: "Azure", GCP: "GCP",
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
                        : phaseConfig.badge === "Available"
                        ? "bg-green-100 text-green-700"
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
                  const isAvailable = p.available;
                  const badgeText = isAvailable
                    ? null
                    : phase === 2
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
                          : "border-gray-150 cursor-not-allowed opacity-60"
                      }`}
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

  /* -- Render: AWS configuration form (modal step 2) ----------------------- */

  function renderAwsConfigForm() {
    return (
      <div>
        {/* Selected provider preview */}
        <div className="mb-5 flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-gray-900">
            AWS
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Amazon Web Services</p>
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

        {/* Modal test result */}
        {modalTestResult && (
          <div className={`mb-4 flex items-start gap-3 rounded-lg border p-4 ${
            modalTestResult.ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
          }`}>
            {modalTestResult.ok ? (
              <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div>
              <p className={`text-sm font-medium ${modalTestResult.ok ? "text-green-800" : "text-red-800"}`}>
                {modalTestResult.ok ? "Connection Successful" : "Connection Failed"}
              </p>
              {modalTestResult.ok && modalTestResult.account && (
                <p className="mt-1 text-sm text-green-700">
                  Account: {modalTestResult.account} | ARN: {modalTestResult.arn}
                </p>
              )}
              {!modalTestResult.ok && modalTestResult.error && (
                <p className="mt-1 text-sm text-red-700">{modalTestResult.error}</p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleCreateAwsIntegration} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="aws-name" className="label">
              Integration Name <span className="text-red-500">*</span>
            </label>
            <input
              id="aws-name"
              type="text"
              value={integrationName}
              onChange={(e) => { setIntegrationName(e.target.value); setAwsFieldErrors((p) => ({ ...p, name: "" })); }}
              className={`input-field ${awsFieldErrors.name ? "border-red-300 focus:border-red-500 focus:ring-red-200" : ""}`}
              placeholder="e.g., Production AWS Account"
              maxLength={200}
              autoFocus
            />
            {awsFieldErrors.name && <p className="mt-1 text-xs text-red-600">{awsFieldErrors.name}</p>}
          </div>

          {/* Region */}
          <div>
            <label htmlFor="aws-region" className="label">
              Region
            </label>
            <select
              id="aws-region"
              value={awsRegion}
              onChange={(e) => setAwsRegion(e.target.value)}
              className="input-field"
            >
              {AWS_REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Primary region for resource discovery</p>
          </div>

          {/* Auth type toggle */}
          <div>
            <label className="label">Authentication Method</label>
            <div className="mt-1 flex rounded-lg border border-gray-200 p-1">
              <button
                type="button"
                onClick={() => setAwsAuthType("access_keys")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  awsAuthType === "access_keys"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Access Keys
              </button>
              <button
                type="button"
                onClick={() => setAwsAuthType("assume_role")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  awsAuthType === "assume_role"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Assume Role
              </button>
            </div>
          </div>

          {/* Access Key ID */}
          <div>
            <label htmlFor="aws-access-key" className="label">
              Access Key ID <span className="text-red-500">*</span>
            </label>
            <input
              id="aws-access-key"
              type="text"
              value={awsAccessKeyId}
              onChange={(e) => { setAwsAccessKeyId(e.target.value); setAwsFieldErrors((p) => ({ ...p, accessKeyId: "" })); }}
              className={`input-field font-mono text-sm ${awsFieldErrors.accessKeyId ? "border-red-300 focus:border-red-500 focus:ring-red-200" : ""}`}
              placeholder="AKIA..."
            />
            {awsFieldErrors.accessKeyId && <p className="mt-1 text-xs text-red-600">{awsFieldErrors.accessKeyId}</p>}
          </div>

          {/* Secret Access Key */}
          <div>
            <label htmlFor="aws-secret-key" className="label">
              Secret Access Key <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="aws-secret-key"
                type="password"
                value={awsSecretAccessKey}
                onChange={(e) => { setAwsSecretAccessKey(e.target.value); setAwsFieldErrors((p) => ({ ...p, secretAccessKey: "" })); }}
                className={`input-field pr-10 font-mono text-sm ${awsFieldErrors.secretAccessKey ? "border-red-300 focus:border-red-500 focus:ring-red-200" : ""}`}
                placeholder="Enter secret access key"
              />
              <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            {awsFieldErrors.secretAccessKey && <p className="mt-1 text-xs text-red-600">{awsFieldErrors.secretAccessKey}</p>}
          </div>

          {/* Session Token (optional) */}
          <div>
            <label htmlFor="aws-session-token" className="label">
              Session Token <span className="text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="aws-session-token"
              type="password"
              value={awsSessionToken}
              onChange={(e) => setAwsSessionToken(e.target.value)}
              className="input-field font-mono text-sm"
              placeholder="Temporary session token"
            />
            <p className="mt-1 text-xs text-gray-500">Only needed for temporary credentials</p>
          </div>

          {/* Assume Role fields */}
          {awsAuthType === "assume_role" && (
            <div className="space-y-4 rounded-lg border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-xs font-medium text-blue-800">
                The access keys above will be used to assume the specified role.
              </p>

              {/* Role ARN */}
              <div>
                <label htmlFor="aws-role-arn" className="label">
                  Role ARN <span className="text-red-500">*</span>
                </label>
                <input
                  id="aws-role-arn"
                  type="text"
                  value={awsRoleArn}
                  onChange={(e) => { setAwsRoleArn(e.target.value); setAwsFieldErrors((p) => ({ ...p, roleArn: "" })); }}
                  className={`input-field font-mono text-sm ${awsFieldErrors.roleArn ? "border-red-300 focus:border-red-500 focus:ring-red-200" : ""}`}
                  placeholder="arn:aws:iam::123456789012:role/RoleName"
                />
                {awsFieldErrors.roleArn && <p className="mt-1 text-xs text-red-600">{awsFieldErrors.roleArn}</p>}
              </div>

              {/* External ID */}
              <div>
                <label htmlFor="aws-external-id" className="label">
                  External ID <span className="text-xs font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  id="aws-external-id"
                  type="text"
                  value={awsExternalId}
                  onChange={(e) => setAwsExternalId(e.target.value)}
                  className="input-field font-mono text-sm"
                  placeholder="External ID for cross-account access"
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={handleBackToStep1}
              className="btn-secondary"
            >
              Back
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnectionInModal}
                disabled={testingInModal || creating}
                className="btn-secondary"
              >
                {testingInModal ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                    Testing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                    Test &amp; Save
                  </span>
                )}
              </button>
              <button
                type="submit"
                disabled={creating || testingInModal}
                className="btn-primary"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </span>
                ) : (
                  "Save Integration"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  /* -- Render: Integration card for AWS ------------------------------------ */

  function renderIntegrationCard(integration: IntegrationItem) {
    const icon = getProviderIcon(integration.provider);
    const isToggling = togglingId === integration.id;
    const isTesting = testingId === integration.id;
    const isScanning = scanningId === integration.id;
    const isAws = integration.provider === "AWS";

    return (
      <div key={integration.id} className="card p-0">
        <div className="flex items-start gap-4 p-5">
          {/* Provider icon */}
          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${icon.bg} ${icon.text} text-sm font-bold`}>
            {icon.label}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900">{integration.name}</h3>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                STATUS_COLORS[integration.status] ?? "bg-gray-100 text-gray-600"
              }`}>
                {integration.status === "ENABLED" ? "Enabled" : "Disabled"}
              </span>
            </div>

            <p className="mt-0.5 text-xs text-gray-500">
              {getProviderDisplayName(integration.provider)}
              {isAws && integration.config?.region ? (
                <span className="ml-2 text-gray-400">({String(integration.config.region)})</span>
              ) : null}
            </p>

            {/* Status row */}
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              {/* Health badge */}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                HEALTH_COLORS[integration.healthStatus] ?? "bg-gray-100 text-gray-600"
              }`}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                  integration.healthStatus === "HEALTHY" ? "bg-green-500"
                  : integration.healthStatus === "DEGRADED" ? "bg-yellow-500"
                  : integration.healthStatus === "FAILED" ? "bg-red-500"
                  : "bg-gray-400"
                }`} />
                {HEALTH_LABELS[integration.healthStatus] ?? integration.healthStatus}
              </span>

              {/* Last tested */}
              {integration.lastHealthCheckAt && (
                <span className="text-xs text-gray-400">
                  Tested {formatTimestamp(integration.lastHealthCheckAt)}
                </span>
              )}
            </div>

            {/* Error */}
            {integration.lastError && (
              <div className="mt-2 rounded-md bg-red-50 px-3 py-1.5">
                <p className="text-xs text-red-700 line-clamp-2">{integration.lastError}</p>
              </div>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-3 flex-wrap">
          <button
            onClick={() => handleTestConnection(integration)}
            disabled={isTesting}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {isTesting ? (
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

          {isAws && (
            <button
              onClick={() => handleRunScan(integration)}
              disabled={isScanning || integration.healthStatus !== "HEALTHY"}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
              title={integration.healthStatus !== "HEALTHY" ? "Test connection first" : "Scan AWS resources"}
            >
              {isScanning ? (
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
          )}

          {isAws && (
            <button
              onClick={() => setDrawerIntegrationId(integration.id)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-600 shadow-sm transition-colors hover:bg-brand-50"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              View details
            </button>
          )}

          <div className="flex-1" />

          <Link
            href={`/integrations/${integration.id}`}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Configure
          </Link>

          <button
            onClick={() => handleToggleStatus(integration)}
            disabled={isToggling}
            className={`text-xs font-medium transition-colors disabled:opacity-50 ${
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
  }

  /* -- Render -------------------------------------------------------------- */

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
              {toast.type === "success" && (
                <svg className="h-5 w-5 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {toast.type === "error" && (
                <svg className="h-5 w-5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {toast.type === "info" && (
                <svg className="h-5 w-5 flex-shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
              )}
              <p className="text-sm font-medium">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-2 flex-shrink-0 text-current opacity-60 hover:opacity-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

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

      {/* Content */}
      {loading ? (
        /* Loading skeletons */
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-0">
              <div className="flex items-start gap-4 p-5">
                <div className="h-12 w-12 animate-pulse rounded-xl bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-32 animate-pulse rounded bg-gray-100" />
                  <div className="h-5 w-24 animate-pulse rounded-full bg-gray-200" />
                </div>
              </div>
              <div className="border-t border-gray-100 px-5 py-3">
                <div className="flex gap-2">
                  <div className="h-7 w-16 animate-pulse rounded bg-gray-100" />
                  <div className="h-7 w-20 animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : integrations.length === 0 ? (
        /* Empty state */
        <div className="card">
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
        </div>
      ) : (
        /* Integration cards grid */
        <div className="grid gap-4 md:grid-cols-2">
          {integrations.map((integration) => renderIntegrationCard(integration))}
        </div>
      )}

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
                    : selectedProvider === "AWS"
                    ? "Configure your AWS connection"
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
                  {selectedProvider === "AWS" ? "Configure AWS" : "Configure"}
                </span>
              </div>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto px-6 py-5 flex-1">
              {addStep === 1 && renderPhaseGroupedProviders()}

              {addStep === 2 && selectedProvider === "AWS" && renderAwsConfigForm()}

              {addStep === 3 && selectedProvider !== "AWS" && (
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

                  <form onSubmit={handleCreateGenericIntegration}>
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

      {/* AWS Details Drawer */}
      {drawerIntegrationId && (
        <AwsDetailsDrawer
          integrationId={drawerIntegrationId}
          onClose={() => setDrawerIntegrationId(null)}
        />
      )}
    </div>
  );
}
