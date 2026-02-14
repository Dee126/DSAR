"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

/* ── Types ────────────────────────────────────────────────────────────── */

interface TenantInfo {
  id: string;
  name: string;
  slaDefaultDays: number;
  dueSoonDays: number;
  retentionDays: number;
  createdAt: string;
  updatedAt: string;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
}

interface SystemItem {
  id: string;
  name: string;
  description: string | null;
  owner: string | null;
  contactEmail: string | null;
  tags: string[] | null;
  createdAt: string;
}

const USER_ROLES = [
  { value: "TENANT_ADMIN", label: "Tenant Admin" },
  { value: "DPO", label: "DPO" },
  { value: "CASE_MANAGER", label: "Case Manager" },
  { value: "CONTRIBUTOR", label: "Contributor" },
  { value: "READ_ONLY", label: "Read Only" },
];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  TENANT_ADMIN: "bg-indigo-100 text-indigo-700",
  DPO: "bg-brand-100 text-brand-700",
  CASE_MANAGER: "bg-cyan-100 text-cyan-700",
  CONTRIBUTOR: "bg-green-100 text-green-700",
  READ_ONLY: "bg-gray-100 text-gray-700",
};

const SETTINGS_ROLES = ["SUPER_ADMIN", "TENANT_ADMIN"];

/* ── Component ────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const userRole = session?.user?.role ?? "";

  const [activeTab, setActiveTab] = useState<
    "tenant" | "users" | "systems" | "developer"
  >("tenant");

  // Developer / Demo Data
  const [demoIntensity, setDemoIntensity] = useState<"small" | "medium" | "large">("medium");
  const [demoSpecialCat, setDemoSpecialCat] = useState(true);
  const [demoCopilotRuns, setDemoCopilotRuns] = useState(true);
  const [demoExports, setDemoExports] = useState(true);
  const [demoPopulating, setDemoPopulating] = useState(false);
  const [demoResetting, setDemoResetting] = useState(false);
  const [demoMessage, setDemoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Tenant
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenantEditing, setTenantEditing] = useState(false);
  const [tenantSaving, setTenantSaving] = useState(false);
  const [tenantError, setTenantError] = useState("");
  const [tenantSuccess, setTenantSuccess] = useState("");
  const [editName, setEditName] = useState("");
  const [editSlaDays, setEditSlaDays] = useState(30);
  const [editDueSoonDays, setEditDueSoonDays] = useState(7);
  const [editRetentionDays, setEditRetentionDays] = useState(365);

  // Users
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("READ_ONLY");
  const [addingUser, setAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserRole, setEditingUserRole] = useState("");

  // Systems
  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(true);
  const [showAddSystem, setShowAddSystem] = useState(false);
  const [newSystemName, setNewSystemName] = useState("");
  const [newSystemDescription, setNewSystemDescription] = useState("");
  const [newSystemOwner, setNewSystemOwner] = useState("");
  const [newSystemContact, setNewSystemContact] = useState("");
  const [newSystemTags, setNewSystemTags] = useState("");
  const [addingSystem, setAddingSystem] = useState(false);
  const [addSystemError, setAddSystemError] = useState("");

  // Guard: only SUPER_ADMIN and TENANT_ADMIN can access
  useEffect(() => {
    if (session && !SETTINGS_ROLES.includes(userRole)) {
      router.push("/dashboard");
    }
  }, [session, userRole, router]);

  // Fetch tenant
  useEffect(() => {
    async function fetchTenant() {
      try {
        const res = await fetch("/api/tenant");
        if (res.ok) {
          const data = await res.json();
          setTenant(data);
          setEditName(data.name);
          setEditSlaDays(data.slaDefaultDays);
          setEditDueSoonDays(data.dueSoonDays ?? 7);
          setEditRetentionDays(data.retentionDays ?? 365);
        }
      } catch {
        /* silently fail */
      } finally {
        setTenantLoading(false);
      }
    }
    fetchTenant();
  }, []);

  // Fetch users
  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const json = await res.json();
        setUsers(Array.isArray(json) ? json : json.data ?? []);
      }
    } catch {
      /* silently fail */
    } finally {
      setUsersLoading(false);
    }
  }

  // Fetch systems
  useEffect(() => {
    fetchSystems();
  }, []);

  async function fetchSystems() {
    setSystemsLoading(true);
    try {
      const res = await fetch("/api/systems");
      if (res.ok) {
        const json = await res.json();
        setSystems(Array.isArray(json) ? json : json.data ?? []);
      }
    } catch {
      /* silently fail */
    } finally {
      setSystemsLoading(false);
    }
  }

  function startEditTenant() {
    if (tenant) {
      setEditName(tenant.name);
      setEditSlaDays(tenant.slaDefaultDays);
      setEditDueSoonDays(tenant.dueSoonDays ?? 7);
      setEditRetentionDays(tenant.retentionDays ?? 365);
    }
    setTenantEditing(true);
    setTenantError("");
    setTenantSuccess("");
  }

  async function handleSaveTenant(e: FormEvent) {
    e.preventDefault();
    setTenantSaving(true);
    setTenantError("");
    setTenantSuccess("");

    try {
      const res = await fetch("/api/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          slaDefaultDays: editSlaDays,
          dueSoonDays: editDueSoonDays,
          retentionDays: editRetentionDays,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setTenantError(json?.error ?? `Failed to update (${res.status})`);
        return;
      }

      const updated = await res.json();
      setTenant(updated);
      setTenantEditing(false);
      setTenantSuccess("Settings saved successfully.");
      setTimeout(() => setTenantSuccess(""), 3000);
    } catch {
      setTenantError("An unexpected error occurred.");
    } finally {
      setTenantSaving(false);
    }
  }

  async function handleUpdateUserRole(userId: string, newRole: string) {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
      }
    } catch {
      /* silently fail */
    }
    setEditingUserId(null);
  }

  async function handleAddUser(e: FormEvent) {
    e.preventDefault();
    setAddUserError("");
    setAddingUser(true);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setAddUserError(json?.error ?? `Failed to create user (${res.status})`);
        return;
      }

      setShowAddUser(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("READ_ONLY");
      await fetchUsers();
    } catch {
      setAddUserError("An unexpected error occurred.");
    } finally {
      setAddingUser(false);
    }
  }

  async function handleAddSystem(e: FormEvent) {
    e.preventDefault();
    setAddSystemError("");
    setAddingSystem(true);

    try {
      const tags = newSystemTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSystemName,
          description: newSystemDescription || undefined,
          owner: newSystemOwner || undefined,
          contactEmail: newSystemContact || undefined,
          tags: tags.length > 0 ? tags : undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setAddSystemError(
          json?.error ?? `Failed to create system (${res.status})`
        );
        return;
      }

      setShowAddSystem(false);
      setNewSystemName("");
      setNewSystemDescription("");
      setNewSystemOwner("");
      setNewSystemContact("");
      setNewSystemTags("");
      await fetchSystems();
    } catch {
      setAddSystemError("An unexpected error occurred.");
    } finally {
      setAddingSystem(false);
    }
  }

  if (!SETTINGS_ROLES.includes(userRole)) {
    return null;
  }

  async function handlePopulateDemo() {
    setDemoPopulating(true);
    setDemoMessage(null);
    try {
      const res = await fetch("/api/demo-data/populate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intensity: demoIntensity,
          includeSpecialCategory: demoSpecialCat,
          generateCopilotRuns: demoCopilotRuns,
          generateExports: demoExports,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setDemoMessage({ type: "error", text: json.error ?? `Failed (${res.status})` });
        return;
      }
      const r = json.result;
      setDemoMessage({
        type: "success",
        text: `Populated ${r.casesProcessed} cases: ${r.evidenceItemsCreated} evidence items, ${r.findingsCreated} findings, ${r.copilotRunsCreated} copilot runs, ${r.tasksCreated} tasks, ${r.dataCollectionItemsCreated} data collections, ${r.documentsCreated} documents.`,
      });
    } catch {
      setDemoMessage({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setDemoPopulating(false);
    }
  }

  async function handleResetDemo() {
    setDemoResetting(true);
    setDemoMessage(null);
    try {
      const res = await fetch("/api/demo-data/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) {
        setDemoMessage({ type: "error", text: json.error ?? `Failed (${res.status})` });
        return;
      }
      const r = json.result;
      const total =
        r.exportArtifactsDeleted + r.copilotSummariesDeleted + r.detectorResultsDeleted +
        r.findingsDeleted + r.evidenceItemsDeleted + r.copilotQueriesDeleted +
        r.copilotRunsDeleted + r.dataCollectionItemsDeleted + r.documentsDeleted +
        r.auditLogsDeleted;
      setDemoMessage({
        type: "success",
        text: `Reset complete. Removed ${total} demo artifacts. Cases preserved.`,
      });
    } catch {
      setDemoMessage({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setDemoResetting(false);
    }
  }

  const tabs = [
    { key: "tenant" as const, label: "Tenant Profile" },
    { key: "users" as const, label: "User Management" },
    { key: "systems" as const, label: "Systems (Processor Map)" },
    { key: "developer" as const, label: "Developer / Test" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your organization settings, users, and integrated systems
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
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

      {/* ── Tenant Profile Tab ─────────────────────────────────────────── */}
      {activeTab === "tenant" && (
        <div className="max-w-full md:max-w-2xl space-y-4">
          {tenantSuccess && (
            <div className="rounded-md bg-green-50 p-3">
              <p className="text-sm text-green-700">{tenantSuccess}</p>
            </div>
          )}
          {tenantError && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-700">{tenantError}</p>
            </div>
          )}

          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Organization Settings
              </h2>
              {!tenantEditing && tenant && (
                <button
                  onClick={startEditTenant}
                  className="btn-primary text-sm"
                >
                  Edit Settings
                </button>
              )}
            </div>

            {tenantLoading ? (
              <div className="mt-4 space-y-3">
                <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
                <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
              </div>
            ) : tenant && !tenantEditing ? (
              <dl className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Organization Name
                  </dt>
                  <dd className="mt-1 text-lg font-medium text-gray-900">
                    {tenant.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Default SLA (days)
                  </dt>
                  <dd className="mt-1">
                    <span className="inline-flex items-center rounded-lg bg-brand-50 px-3 py-1 text-lg font-semibold text-brand-700">
                      {tenant.slaDefaultDays}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Due Soon Warning (days)
                  </dt>
                  <dd className="mt-1">
                    <span className="inline-flex items-center rounded-lg bg-yellow-50 px-3 py-1 text-lg font-semibold text-yellow-700">
                      {tenant.dueSoonDays ?? 7}
                    </span>
                    <p className="mt-1 text-xs text-gray-500">
                      Cases within this many days of their deadline are flagged
                    </p>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Data Retention (days)
                  </dt>
                  <dd className="mt-1">
                    <span className="inline-flex items-center rounded-lg bg-gray-50 px-3 py-1 text-lg font-semibold text-gray-700">
                      {tenant.retentionDays ?? 365}
                    </span>
                    <p className="mt-1 text-xs text-gray-500">
                      Closed case data retained for this duration
                    </p>
                  </dd>
                </div>
              </dl>
            ) : tenant && tenantEditing ? (
              <form onSubmit={handleSaveTenant} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="tenant-name" className="label">
                    Organization Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="tenant-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input-field max-w-md"
                    required
                    minLength={1}
                    maxLength={200}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="tenant-sla" className="label">
                      Default SLA (days)
                    </label>
                    <input
                      id="tenant-sla"
                      type="number"
                      value={editSlaDays}
                      onChange={(e) => setEditSlaDays(Number(e.target.value))}
                      className="input-field"
                      min={1}
                      max={365}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      GDPR default: 30 days
                    </p>
                  </div>
                  <div>
                    <label htmlFor="tenant-due-soon" className="label">
                      Due Soon Warning (days)
                    </label>
                    <input
                      id="tenant-due-soon"
                      type="number"
                      value={editDueSoonDays}
                      onChange={(e) =>
                        setEditDueSoonDays(Number(e.target.value))
                      }
                      className="input-field"
                      min={1}
                      max={90}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Flag cases approaching deadline
                    </p>
                  </div>
                  <div>
                    <label htmlFor="tenant-retention" className="label">
                      Data Retention (days)
                    </label>
                    <input
                      id="tenant-retention"
                      type="number"
                      value={editRetentionDays}
                      onChange={(e) =>
                        setEditRetentionDays(Number(e.target.value))
                      }
                      className="input-field"
                      min={30}
                      max={3650}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      How long to keep closed case data
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={tenantSaving}
                    className="btn-primary"
                  >
                    {tenantSaving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTenantEditing(false);
                      setTenantError("");
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                Unable to load tenant information.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── User Management Tab ────────────────────────────────────────── */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Users</h2>
              <p className="text-sm text-gray-500">
                {users.length} user{users.length !== 1 ? "s" : ""} in your
                organization
              </p>
            </div>
            <button
              onClick={() => setShowAddUser(!showAddUser)}
              className="btn-primary w-full sm:w-auto"
            >
              {showAddUser ? (
                "Cancel"
              ) : (
                <>
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
                  Add User
                </>
              )}
            </button>
          </div>

          {showAddUser && (
            <div className="card">
              <h3 className="text-base font-semibold text-gray-900">
                Add New User
              </h3>

              {addUserError && (
                <div className="mt-3 rounded-md bg-red-50 p-3">
                  <p className="text-sm text-red-700">{addUserError}</p>
                </div>
              )}

              <form
                onSubmit={handleAddUser}
                className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                <div>
                  <label htmlFor="user-name" className="label">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="user-name"
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="input-field"
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="user-email" className="label">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="user-email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="input-field"
                    placeholder="john@example.com"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="user-password" className="label">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="user-password"
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="input-field"
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="user-role" className="label">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="user-role"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="input-field"
                  >
                    {USER_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end sm:col-span-2">
                  <button
                    type="submit"
                    disabled={addingUser}
                    className="btn-primary"
                  >
                    {addingUser ? (
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
                      "Create User"
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="card p-0">
            {usersLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded bg-gray-100"
                  />
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-gray-500">No users found.</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Email</th>
                        <th className="px-6 py-3">Role</th>
                        <th className="px-6 py-3">Last Login</th>
                        <th className="px-6 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                                {user.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </div>
                              <span className="text-sm font-medium text-gray-900">
                                {user.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {user.email}
                          </td>
                          <td className="px-6 py-4">
                            {editingUserId === user.id ? (
                              <select
                                value={editingUserRole}
                                onChange={(e) => {
                                  setEditingUserRole(e.target.value);
                                  handleUpdateUserRole(user.id, e.target.value);
                                }}
                                className="rounded-md border border-gray-300 py-1 pl-2 pr-7 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                onBlur={() => setEditingUserId(null)}
                                autoFocus
                              >
                                {USER_ROLES.map((r) => (
                                  <option key={r.value} value={r.value}>
                                    {r.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  ROLE_COLORS[user.role] ??
                                  "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {user.role.replace(/_/g, " ")}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                            {user.lastLoginAt
                              ? new Date(user.lastLoginAt).toLocaleString()
                              : "Never"}
                          </td>
                          <td className="px-6 py-4">
                            {editingUserId !== user.id && (
                              <button
                                onClick={() => {
                                  setEditingUserId(user.id);
                                  setEditingUserRole(user.role);
                                }}
                                className="text-sm font-medium text-brand-600 hover:text-brand-700"
                              >
                                Change Role
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="divide-y divide-gray-200 md:hidden">
                  {users.map((user) => (
                    <div key={user.id} className="px-4 py-4 space-y-3">
                      {/* Avatar + Name */}
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                          {user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <span className="text-base font-medium text-gray-900">
                          {user.name}
                        </span>
                      </div>

                      {/* Email */}
                      <div>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>

                      {/* Role badge */}
                      <div>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {user.role.replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Last login */}
                      <div>
                        <p className="text-xs text-gray-500">
                          Last login:{" "}
                          {user.lastLoginAt
                            ? new Date(user.lastLoginAt).toLocaleString()
                            : "Never"}
                        </p>
                      </div>

                      {/* Change Role button */}
                      <div>
                        {editingUserId === user.id ? (
                          <select
                            value={editingUserRole}
                            onChange={(e) => {
                              setEditingUserRole(e.target.value);
                              handleUpdateUserRole(user.id, e.target.value);
                            }}
                            className="w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            onBlur={() => setEditingUserId(null)}
                            autoFocus
                          >
                            {USER_ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingUserId(user.id);
                              setEditingUserRole(user.role);
                            }}
                            className="text-sm font-medium text-brand-600 hover:text-brand-700"
                          >
                            Change Role
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Systems Tab ────────────────────────────────────────────────── */}
      {activeTab === "systems" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Systems (Processor Map)
              </h2>
              <p className="text-sm text-gray-500">
                {systems.length} system{systems.length !== 1 ? "s" : ""}{" "}
                registered
              </p>
            </div>
            <button
              onClick={() => setShowAddSystem(!showAddSystem)}
              className="btn-primary w-full sm:w-auto"
            >
              {showAddSystem ? (
                "Cancel"
              ) : (
                <>
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
                  Add System
                </>
              )}
            </button>
          </div>

          {showAddSystem && (
            <div className="card">
              <h3 className="text-base font-semibold text-gray-900">
                Add New System
              </h3>

              {addSystemError && (
                <div className="mt-3 rounded-md bg-red-50 p-3">
                  <p className="text-sm text-red-700">{addSystemError}</p>
                </div>
              )}

              <form
                onSubmit={handleAddSystem}
                className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                <div>
                  <label htmlFor="system-name" className="label">
                    System Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="system-name"
                    type="text"
                    value={newSystemName}
                    onChange={(e) => setNewSystemName(e.target.value)}
                    className="input-field"
                    placeholder="e.g., Salesforce CRM"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="system-owner" className="label">
                    Owner
                  </label>
                  <input
                    id="system-owner"
                    type="text"
                    value={newSystemOwner}
                    onChange={(e) => setNewSystemOwner(e.target.value)}
                    className="input-field"
                    placeholder="e.g., Sales Team"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="system-description" className="label">
                    Description
                  </label>
                  <textarea
                    id="system-description"
                    value={newSystemDescription}
                    onChange={(e) => setNewSystemDescription(e.target.value)}
                    rows={2}
                    className="input-field resize-y"
                    placeholder="Describe what this system does..."
                  />
                </div>
                <div>
                  <label htmlFor="system-contact" className="label">
                    Contact Email
                  </label>
                  <input
                    id="system-contact"
                    type="email"
                    value={newSystemContact}
                    onChange={(e) => setNewSystemContact(e.target.value)}
                    className="input-field"
                    placeholder="contact@vendor.com"
                  />
                </div>
                <div>
                  <label htmlFor="system-tags" className="label">
                    Tags
                  </label>
                  <input
                    id="system-tags"
                    type="text"
                    value={newSystemTags}
                    onChange={(e) => setNewSystemTags(e.target.value)}
                    className="input-field"
                    placeholder="Comma-separated: CRM, PII, EU"
                  />
                </div>
                <div className="flex items-end sm:col-span-2">
                  <button
                    type="submit"
                    disabled={addingSystem}
                    className="btn-primary"
                  >
                    {addingSystem ? (
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
                      "Create System"
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="card p-0">
            {systemsLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded bg-gray-100"
                  />
                ))}
              </div>
            ) : systems.length === 0 ? (
              <div className="px-6 py-12 text-center">
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
                    d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z"
                  />
                </svg>
                <p className="mt-2 text-sm text-gray-500">
                  No systems configured. Add your first system to build your
                  processor map.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Owner</th>
                        <th className="px-6 py-3">Contact</th>
                        <th className="px-6 py-3">Tags</th>
                        <th className="px-6 py-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {systems.map((sys) => (
                        <tr key={sys.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {sys.name}
                              </p>
                              {sys.description && (
                                <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">
                                  {sys.description}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                            {sys.owner || (
                              <span className="text-gray-400">--</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                            {sys.contactEmail || (
                              <span className="text-gray-400">--</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {sys.tags &&
                            Array.isArray(sys.tags) &&
                            sys.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {sys.tags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">--</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                            {new Date(sys.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="divide-y divide-gray-200 md:hidden">
                  {systems.map((sys) => (
                    <div key={sys.id} className="px-4 py-4 space-y-2">
                      {/* System name + description */}
                      <div>
                        <p className="text-base font-medium text-gray-900">
                          {sys.name}
                        </p>
                        {sys.description && (
                          <p className="mt-1 text-sm text-gray-500">
                            {sys.description}
                          </p>
                        )}
                      </div>

                      {/* Owner */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">Owner:</span>
                        <span className="text-sm text-gray-700">
                          {sys.owner || <span className="text-gray-400">--</span>}
                        </span>
                      </div>

                      {/* Contact email */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">Contact:</span>
                        <span className="text-sm text-gray-500">
                          {sys.contactEmail || <span className="text-gray-400">--</span>}
                        </span>
                      </div>

                      {/* Tags */}
                      {sys.tags && Array.isArray(sys.tags) && sys.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {sys.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Created date */}
                      <div>
                        <p className="text-xs text-gray-500">
                          Created: {new Date(sys.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Developer / Test Tab ───────────────────────────────────────── */}
      {activeTab === "developer" && (
        <div className="space-y-6 max-w-full md:max-w-3xl">
          {/* Warning banner */}
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="flex gap-3">
              <svg className="h-5 w-5 shrink-0 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-yellow-800">Developer / Test Mode</h3>
                <p className="mt-1 text-sm text-yellow-700">
                  These tools generate synthetic demo data for testing. All data is fictional — no real personal data is created. Use in development and demo environments only.
                </p>
              </div>
            </div>
          </div>

          {/* Status message */}
          {demoMessage && (
            <div className={`rounded-md p-4 ${demoMessage.type === "success" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <p className={`text-sm ${demoMessage.type === "success" ? "text-green-700" : "text-red-700"}`}>
                {demoMessage.text}
              </p>
            </div>
          )}

          {/* Populate Card */}
          <div className="card space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Populate Cases with Demo Evidence</h2>
              <p className="mt-1 text-sm text-gray-500">
                Fills existing DSAR cases with synthetic evidence items, findings, copilot runs, data collection results, and audit events.
              </p>
            </div>

            {/* Intensity */}
            <div>
              <label htmlFor="demo-intensity" className="label">Evidence Intensity</label>
              <select
                id="demo-intensity"
                value={demoIntensity}
                onChange={(e) => setDemoIntensity(e.target.value as "small" | "medium" | "large")}
                className="input-field max-w-xs"
              >
                <option value="small">Small (5-10 items per case)</option>
                <option value="medium">Medium (15-25 items per case)</option>
                <option value="large">Large (30-50 items per case)</option>
              </select>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={demoSpecialCat}
                  onChange={(e) => setDemoSpecialCat(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Include Special Category (Art. 9) cases</span>
                  <p className="text-xs text-gray-500">Injects health/medical keyword findings into ~40% of cases, triggers legal review gates</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={demoCopilotRuns}
                  onChange={(e) => setDemoCopilotRuns(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Generate Copilot Runs automatically</span>
                  <p className="text-xs text-gray-500">Creates completed copilot runs with queries, evidence items, findings, summaries, and detector results</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={demoExports}
                  onChange={(e) => setDemoExports(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Generate Export artifacts (respect legal gate)</span>
                  <p className="text-xs text-gray-500">Creates export artifacts — blocked for Art. 9 cases, allowed for others</p>
                </div>
              </label>
            </div>

            {/* Populate button */}
            <button
              onClick={handlePopulateDemo}
              disabled={demoPopulating || demoResetting}
              className="btn-primary w-full sm:w-auto"
            >
              {demoPopulating ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Populating cases...
                </span>
              ) : (
                <>
                  <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
                  </svg>
                  Populate existing cases with demo evidence
                </>
              )}
            </button>
          </div>

          {/* Reset Card */}
          <div className="card space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Reset Demo Evidence</h2>
              <p className="mt-1 text-sm text-gray-500">
                Removes all synthetic demo artifacts (evidence, findings, copilot runs, demo documents) while preserving the cases themselves.
              </p>
            </div>

            <button
              onClick={handleResetDemo}
              disabled={demoPopulating || demoResetting}
              className="btn-danger w-full sm:w-auto"
            >
              {demoResetting ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Resetting...
                </span>
              ) : (
                <>
                  <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Reset demo evidence for all cases
                </>
              )}
            </button>
          </div>

          {/* Info */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-700">What gets created?</h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              <li>&#8226; <strong>Evidence Items</strong>: Email, file, and record evidence from M365, Exchange, SharePoint, OneDrive</li>
              <li>&#8226; <strong>Detector Results</strong>: PII detection (email, phone, IBAN, address, IPs) with masked previews</li>
              <li>&#8226; <strong>Findings</strong>: Categorized by data type (Identification, Contact, Payment, HR, etc.) with severity levels</li>
              <li>&#8226; <strong>Data Collection Items</strong>: Per-source collection status and result metadata</li>
              <li>&#8226; <strong>Copilot Runs</strong>: Completed runs with queries, summaries, and export artifacts</li>
              <li>&#8226; <strong>Tasks</strong>: Case-type-specific tasks (legal review, verification, collection)</li>
              <li>&#8226; <strong>Art. 9 Flags</strong>: Special category detection triggers legal gates and export blocks</li>
              <li>&#8226; <strong>Audit Trail</strong>: Full audit log entries for all demo actions</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
