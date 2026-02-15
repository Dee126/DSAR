"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

/* ── Types ────────────────────────────────────────────────────────────── */

interface SlaConfig {
  id?: string;
  initialDeadlineDays: number;
  extensionMaxDays: number;
  useBusinessDays: boolean;
  timezone: string;
  yellowThresholdDays: number;
  redThresholdDays: number;
  milestoneIdvDays: number;
  milestoneCollectionDays: number;
  milestoneDraftDays: number;
  milestoneLegalDays: number;
  escalationYellowRoles: string[];
  escalationRedRoles: string[];
  escalationOverdueRoles: string[];
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  locale: string;
}

const DEFAULT_CONFIG: SlaConfig = {
  initialDeadlineDays: 30,
  extensionMaxDays: 60,
  useBusinessDays: false,
  timezone: "Europe/Berlin",
  yellowThresholdDays: 14,
  redThresholdDays: 7,
  milestoneIdvDays: 7,
  milestoneCollectionDays: 14,
  milestoneDraftDays: 21,
  milestoneLegalDays: 25,
  escalationYellowRoles: ["DPO", "CASE_MANAGER"],
  escalationRedRoles: ["DPO", "TENANT_ADMIN"],
  escalationOverdueRoles: ["DPO", "TENANT_ADMIN", "SUPER_ADMIN"],
};

const ROLE_OPTIONS = [
  "SUPER_ADMIN",
  "TENANT_ADMIN",
  "DPO",
  "CASE_MANAGER",
  "ANALYST",
  "AUDITOR",
  "CONTRIBUTOR",
];

const ADMIN_ROLES = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO"];

const TIMEZONE_OPTIONS = [
  "Europe/Berlin",
  "Europe/London",
  "Europe/Paris",
  "Europe/Amsterdam",
  "Europe/Dublin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Zurich",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
];

/* ── Page Component ───────────────────────────────────────────────────── */

export default function SlaConfigPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";
  const isAdmin = ADMIN_ROLES.includes(userRole);

  const [config, setConfig] = useState<SlaConfig>(DEFAULT_CONFIG);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Holiday form
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [addingHoliday, setAddingHoliday] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [configRes, holidaysRes] = await Promise.all([
        fetch("/api/sla-config"),
        fetch("/api/holidays"),
      ]);
      if (configRes.ok) {
        const data = await configRes.json();
        setConfig(data);
      }
      if (holidaysRes.ok) {
        setHolidays(await holidaysRes.json());
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/sla-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setConfig(await res.json());
        setSuccess("SLA configuration saved. Changes apply to new cases and risk recalculations.");
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to save SLA config.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddHoliday() {
    if (!newHolidayDate || !newHolidayName) return;
    setAddingHoliday(true);
    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newHolidayDate, name: newHolidayName }),
      });
      if (res.ok) {
        setNewHolidayDate("");
        setNewHolidayName("");
        const holidaysRes = await fetch("/api/holidays");
        if (holidaysRes.ok) setHolidays(await holidaysRes.json());
      }
    } catch {
      /* silently fail */
    } finally {
      setAddingHoliday(false);
    }
  }

  async function handleDeleteHoliday(id: string) {
    try {
      const res = await fetch(`/api/holidays?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setHolidays((h) => h.filter((hol) => hol.id !== id));
      }
    } catch {
      /* silently fail */
    }
  }

  function toggleRole(field: "escalationYellowRoles" | "escalationRedRoles" | "escalationOverdueRoles", role: string) {
    const current = config[field];
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    setConfig({ ...config, [field]: next });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">SLA Configuration</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  const canEdit = isAdmin;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/governance" className="hover:text-brand-600">Governance</Link>
            <span>/</span>
            <span className="text-gray-900">SLA Configuration</span>
          </div>
          <h1 className="mt-1 text-xl font-bold text-gray-900 md:text-2xl">SLA Configuration</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure GDPR Art. 12 deadline thresholds, milestones, and escalation recipients.
          </p>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      {!canEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You have read-only access. Only DPO, Tenant Admin, or Super Admin can modify SLA settings.
        </div>
      )}

      {/* Section 1: Deadline Defaults */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Deadline Defaults</h3>
        <p className="mt-1 text-xs text-gray-500">GDPR Art. 12 requires a response within 1 month. Extension up to 2 additional months for complex requests.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Initial deadline (days)</label>
            <input type="number" value={config.initialDeadlineDays} min={1} max={365} disabled={!canEdit}
              onChange={(e) => setConfig({ ...config, initialDeadlineDays: Number(e.target.value) })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Max extension (days total)</label>
            <input type="number" value={config.extensionMaxDays} min={0} max={365} disabled={!canEdit}
              onChange={(e) => setConfig({ ...config, extensionMaxDays: Number(e.target.value) })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-500" />
          </div>
        </div>

        <div className="mt-4 flex items-start gap-3 sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">Use business days</p>
            <p className="text-xs text-gray-500">Count only working days (Mon-Fri excluding holidays) instead of calendar days.</p>
          </div>
          <button type="button" role="switch" aria-checked={config.useBusinessDays} disabled={!canEdit}
            onClick={() => canEdit && setConfig({ ...config, useBusinessDays: !config.useBusinessDays })}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              config.useBusinessDays ? "bg-brand-600" : "bg-gray-200"
            } ${!canEdit ? "cursor-not-allowed opacity-50" : ""}`}>
            <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
              config.useBusinessDays ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">Tenant timezone</label>
          <select value={config.timezone} disabled={!canEdit}
            onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-500 sm:w-64">
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Section 2: Risk Thresholds */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Risk Thresholds</h3>
        <p className="mt-1 text-xs text-gray-500">
          Cases are color-coded by proximity to their deadline. These thresholds determine when risk escalates.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" />
              Yellow threshold (days remaining)
            </label>
            <input type="number" value={config.yellowThresholdDays} min={1} max={90} disabled={!canEdit}
              onChange={(e) => setConfig({ ...config, yellowThresholdDays: Number(e.target.value) })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
              Red threshold (days remaining)
            </label>
            <input type="number" value={config.redThresholdDays} min={1} max={90} disabled={!canEdit}
              onChange={(e) => setConfig({ ...config, redThresholdDays: Number(e.target.value) })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-500" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />Green: &gt; {config.yellowThresholdDays} days</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500" />Yellow: {config.redThresholdDays + 1}–{config.yellowThresholdDays} days</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Red: &le; {config.redThresholdDays} days</span>
        </div>
      </div>

      {/* Section 3: Milestone Schedule */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Milestone Schedule</h3>
        <p className="mt-1 text-xs text-gray-500">
          Internal milestones for tracking case progress. Days are counted from the case received date.
        </p>
        <div className="mt-4 space-y-3">
          {[
            { key: "milestoneIdvDays" as const, label: "Identity Verification complete", icon: "IDV" },
            { key: "milestoneCollectionDays" as const, label: "Data Collection complete", icon: "COL" },
            { key: "milestoneDraftDays" as const, label: "Draft Response ready", icon: "DFT" },
            { key: "milestoneLegalDays" as const, label: "Legal Review done", icon: "LGL" },
          ].map((ms) => (
            <div key={ms.key} className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-xs font-bold text-brand-700">{ms.icon}</span>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">{ms.label}</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" value={config[ms.key]} min={1} max={180} disabled={!canEdit}
                  onChange={(e) => setConfig({ ...config, [ms.key]: Number(e.target.value) })}
                  className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-center shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-500" />
                <span className="text-xs text-gray-500">days</span>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-green-50 text-xs font-bold text-green-700">RSP</span>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Response Sent</label>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 rounded-md bg-gray-50 px-2 py-1.5 text-sm text-center text-gray-500">{config.initialDeadlineDays}</span>
              <span className="text-xs text-gray-500">days (= deadline)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Escalation Recipients */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Escalation Recipients</h3>
        <p className="mt-1 text-xs text-gray-500">
          Select which roles receive notifications when a case reaches each risk level.
        </p>
        <div className="mt-4 space-y-5">
          {[
            { key: "escalationYellowRoles" as const, label: "Yellow Warning", color: "bg-yellow-500", description: "Case approaching deadline" },
            { key: "escalationRedRoles" as const, label: "Red Alert", color: "bg-red-500", description: "Case critically close to deadline" },
            { key: "escalationOverdueRoles" as const, label: "Overdue Breach", color: "bg-red-700", description: "Case past deadline (GDPR breach)" },
          ].map((esc) => (
            <div key={esc.key}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`h-2.5 w-2.5 rounded-full ${esc.color}`} />
                <span className="text-sm font-medium text-gray-700">{esc.label}</span>
                <span className="text-xs text-gray-400">— {esc.description}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((role) => {
                  const selected = config[esc.key].includes(role);
                  return (
                    <button key={role} type="button" disabled={!canEdit}
                      onClick={() => canEdit && toggleRole(esc.key, role)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? "bg-brand-100 text-brand-700 ring-1 ring-brand-300"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      } ${!canEdit ? "cursor-not-allowed opacity-50" : ""}`}>
                      {role.replace(/_/g, " ")}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 5: Holiday Calendar */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900">Holiday Calendar</h3>
        <p className="mt-1 text-xs text-gray-500">
          Holidays are excluded when business-day counting is enabled. Add public holidays for your jurisdiction.
        </p>

        {canEdit && (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500">Date</label>
              <input type="date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)}
                className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Name</label>
              <input type="text" value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} placeholder="e.g. Christmas Day"
                className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <button onClick={handleAddHoliday} disabled={addingHoliday || !newHolidayDate || !newHolidayName}
              className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {addingHoliday ? "Adding..." : "Add Holiday"}
            </button>
          </div>
        )}

        {holidays.length === 0 ? (
          <div className="mt-4 rounded-md bg-gray-50 py-6 text-center">
            <p className="text-sm text-gray-500">No holidays configured.</p>
            <p className="mt-1 text-xs text-gray-400">Add public holidays for accurate business-day calculations.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-1">
            {holidays.sort((a, b) => a.date.localeCompare(b.date)).map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-500">{new Date(h.date).toLocaleDateString()}</span>
                  <span className="text-gray-900">{h.name}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{h.locale}</span>
                </div>
                {canEdit && (
                  <button onClick={() => handleDeleteHoliday(h.id)}
                    className="text-xs text-red-600 hover:text-red-700">Remove</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Bar */}
      {canEdit && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-400">Changes are recorded in the audit trail and apply to risk recalculations.</p>
          <div className="flex gap-3">
            <button onClick={() => setConfig(DEFAULT_CONFIG)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Reset Defaults
            </button>
            <button onClick={handleSave} disabled={saving}
              className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
