"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

/* ── Types ────────────────────────────────────────────────────────────── */

interface TenantInfo {
  id: string;
  name: string;
  slaDefaultDays: number;
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
    "tenant" | "users" | "systems"
  >("tenant");

  // Tenant
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);

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
          setTenant(await res.json());
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

  const tabs = [
    { key: "tenant" as const, label: "Tenant Profile" },
    { key: "users" as const, label: "User Management" },
    { key: "systems" as const, label: "Systems (Processor Map)" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your organization settings, users, and integrated systems
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
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

      {/* Tenant Profile Tab */}
      {activeTab === "tenant" && (
        <div className="card max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900">
            Tenant Profile
          </h2>
          {tenantLoading ? (
            <div className="mt-4 space-y-3">
              <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
              <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
            </div>
          ) : tenant ? (
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-gray-500">
                  Organization Name
                </dt>
                <dd className="mt-1 text-lg font-medium text-gray-900">
                  {tenant.name}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">
                  Default SLA (days)
                </dt>
                <dd className="mt-1">
                  <span className="inline-flex items-center rounded-lg bg-brand-50 px-3 py-1 text-lg font-semibold text-brand-700">
                    {tenant.slaDefaultDays}
                  </span>
                  <p className="mt-1 text-xs text-gray-500">
                    Number of days from receipt to respond to a DSAR
                  </p>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              Unable to load tenant information.
            </p>
          )}
        </div>
      )}

      {/* User Management Tab */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Users</h2>
            <button
              onClick={() => setShowAddUser(!showAddUser)}
              className="btn-primary"
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="px-6 py-3">Name</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Role</th>
                      <th className="px-6 py-3">Last Login</th>
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
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              ROLE_COLORS[user.role] ??
                              "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {user.role.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {user.lastLoginAt
                            ? new Date(user.lastLoginAt).toLocaleString()
                            : "Never"}
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

      {/* Systems Tab */}
      {activeTab === "systems" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Systems (Processor Map)
            </h2>
            <button
              onClick={() => setShowAddSystem(!showAddSystem)}
              className="btn-primary"
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
              <div className="overflow-x-auto">
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
