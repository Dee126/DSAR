"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface VendorDetail {
  id: string;
  name: string;
  shortCode: string | null;
  status: string;
  website: string | null;
  headquartersCountry: string | null;
  dpaOnFile: boolean;
  dpaExpiresAt: string | null;
  contractReference: string | null;
  notes: string | null;
  contacts: Array<{ id: string; name: string; email: string; phone: string | null; role: string | null; isPrimary: boolean }>;
  dpas: Array<{ id: string; title: string; signedAt: string | null; expiresAt: string | null; sccsIncluded: boolean }>;
  slaConfig: { defaultDueDays: number; reminderAfterDays: number; escalationAfterDays: number; maxReminders: number; autoEscalate: boolean } | null;
  systemProcessors: Array<{ id: string; vendorName: string; role: string; system: { id: string; name: string; criticality: string } }>;
  escalations: Array<{ id: string; severity: string; reason: string; acknowledged: boolean; createdAt: string; resolvedAt: string | null }>;
  _count: { requests: number; systemProcessors: number };
}

type TabKey = "overview" | "contacts" | "dpas" | "systems" | "escalations" | "sla";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "contacts", label: "Contacts" },
  { key: "dpas", label: "DPAs" },
  { key: "systems", label: "Systems" },
  { key: "escalations", label: "Escalations" },
  { key: "sla", label: "SLA Config" },
];

const SEVERITY_COLORS: Record<string, string> = {
  WARNING: "bg-yellow-100 text-yellow-700",
  CRITICAL: "bg-red-100 text-red-700",
  BREACH: "bg-red-200 text-red-800",
};

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("overview");
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddDpa, setShowAddDpa] = useState(false);

  async function fetchVendor() {
    try {
      const res = await fetch(`/api/vendors/${vendorId}`);
      if (res.ok) setVendor(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  }

  useEffect(() => {
    fetchVendor();
  }, [vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/vendors/${vendorId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_contact",
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone") || undefined,
          role: form.get("role") || undefined,
          isPrimary: form.get("isPrimary") === "on",
        }),
      });
      if (res.ok) {
        setShowAddContact(false);
        fetchVendor();
      }
    } catch { /* silent */ }
  }

  async function handleAddDpa(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/vendors/${vendorId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_dpa",
          title: form.get("title"),
          signedAt: form.get("signedAt") ? new Date(form.get("signedAt") as string).toISOString() : undefined,
          expiresAt: form.get("expiresAt") ? new Date(form.get("expiresAt") as string).toISOString() : undefined,
          sccsIncluded: form.get("sccsIncluded") === "on",
        }),
      });
      if (res.ok) {
        setShowAddDpa(false);
        fetchVendor();
      }
    } catch { /* silent */ }
  }

  async function handleAckEscalation(escalationId: string) {
    try {
      const res = await fetch(`/api/vendors/${vendorId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ack_escalation", escalationId }),
      });
      if (res.ok) fetchVendor();
    } catch { /* silent */ }
  }

  async function handleResolveEscalation(escalationId: string) {
    try {
      const res = await fetch(`/api/vendors/${vendorId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve_escalation", escalationId }),
      });
      if (res.ok) fetchVendor();
    } catch { /* silent */ }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 rounded bg-gray-200" />
        <div className="h-64 rounded bg-gray-100" />
      </div>
    );
  }

  if (!vendor) {
    return <div className="card text-center py-12"><p className="text-sm text-gray-500">Vendor not found.</p></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/governance/vendors" className="text-sm text-gray-400 hover:text-gray-600">&larr; Vendors</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">{vendor.name}</h1>
        {vendor.shortCode && <span className="text-sm text-gray-400">({vendor.shortCode})</span>}
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
          vendor.status === "ACTIVE" ? "bg-green-100 text-green-700" :
          vendor.status === "INACTIVE" ? "bg-gray-100 text-gray-500" :
          "bg-yellow-100 text-yellow-700"
        }`}>
          {vendor.status}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Details</h3>
            <dl className="space-y-2 text-sm">
              {vendor.website && <div><dt className="text-gray-500">Website</dt><dd className="text-gray-900">{vendor.website}</dd></div>}
              {vendor.headquartersCountry && <div><dt className="text-gray-500">HQ Country</dt><dd className="text-gray-900">{vendor.headquartersCountry}</dd></div>}
              {vendor.contractReference && <div><dt className="text-gray-500">Contract</dt><dd className="text-gray-900">{vendor.contractReference}</dd></div>}
              <div><dt className="text-gray-500">DPA on file</dt><dd className={vendor.dpaOnFile ? "text-green-700" : "text-red-700"}>{vendor.dpaOnFile ? "Yes" : "No"}</dd></div>
              {vendor.notes && <div><dt className="text-gray-500">Notes</dt><dd className="text-gray-900">{vendor.notes}</dd></div>}
            </dl>
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Statistics</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                <p className="text-lg font-bold text-gray-900">{vendor._count.systemProcessors}</p>
                <p className="text-xs text-gray-600">Systems</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                <p className="text-lg font-bold text-gray-900">{vendor._count.requests}</p>
                <p className="text-xs text-gray-600">Requests</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                <p className="text-lg font-bold text-gray-900">{vendor.contacts.length}</p>
                <p className="text-xs text-gray-600">Contacts</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                <p className="text-lg font-bold text-gray-900">{vendor.dpas.length}</p>
                <p className="text-xs text-gray-600">DPAs</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "contacts" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddContact(!showAddContact)} className="btn-primary text-sm">Add Contact</button>
          </div>
          {showAddContact && (
            <form onSubmit={handleAddContact} className="card border-brand-200 bg-brand-50 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input name="name" placeholder="Name *" required className="input" />
              <input name="email" placeholder="Email *" type="email" required className="input" />
              <input name="phone" placeholder="Phone" className="input" />
              <input name="role" placeholder="Role (e.g. DPO)" className="input" />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="isPrimary" className="rounded" />
                Primary contact
              </label>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowAddContact(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Add</button>
              </div>
            </form>
          )}
          {vendor.contacts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No contacts added yet.</p>
          ) : (
            <div className="space-y-2">
              {vendor.contacts.map((c) => (
                <div key={c.id} className="card flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{c.name}</span>
                      {c.isPrimary && <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-brand-100 text-brand-700">Primary</span>}
                      {c.role && <span className="text-xs text-gray-400">{c.role}</span>}
                    </div>
                    <p className="text-sm text-gray-500">{c.email} {c.phone && `· ${c.phone}`}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "dpas" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddDpa(!showAddDpa)} className="btn-primary text-sm">Add DPA</button>
          </div>
          {showAddDpa && (
            <form onSubmit={handleAddDpa} className="card border-brand-200 bg-brand-50 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input name="title" placeholder="DPA Title *" required className="input sm:col-span-2" />
              <div>
                <label className="text-xs text-gray-600">Signed At</label>
                <input name="signedAt" type="date" className="input" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Expires At</label>
                <input name="expiresAt" type="date" className="input" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="sccsIncluded" className="rounded" />
                SCCs included
              </label>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowAddDpa(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Add</button>
              </div>
            </form>
          )}
          {vendor.dpas.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No DPAs recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {vendor.dpas.map((dpa) => (
                <div key={dpa.id} className="card">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{dpa.title}</span>
                    {dpa.sccsIncluded && <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">SCCs</span>}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {dpa.signedAt && <span>Signed: {new Date(dpa.signedAt).toLocaleDateString()}</span>}
                    {dpa.expiresAt && <span className="ml-3">Expires: {new Date(dpa.expiresAt).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "systems" && (
        <div className="space-y-2">
          {vendor.systemProcessors.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No linked systems. Link this vendor to systems via Data Inventory.</p>
          ) : (
            vendor.systemProcessors.map((sp) => (
              <div key={sp.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{sp.system.name}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    sp.role === "SUBPROCESSOR" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"
                  }`}>
                    {sp.role}
                  </span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    sp.system.criticality === "HIGH" ? "bg-red-100 text-red-700" :
                    sp.system.criticality === "MEDIUM" ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {sp.system.criticality}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "escalations" && (
        <div className="space-y-2">
          {vendor.escalations.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No escalations recorded.</p>
          ) : (
            vendor.escalations.map((esc) => (
              <div key={esc.id} className={`card ${!esc.acknowledged ? "border-red-200 bg-red-50" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      SEVERITY_COLORS[esc.severity] || "bg-gray-100 text-gray-700"
                    }`}>
                      {esc.severity}
                    </span>
                    <span className="text-sm text-gray-900">{esc.reason}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">{new Date(esc.createdAt).toLocaleDateString()}</span>
                    {esc.resolvedAt ? (
                      <span className="text-green-600">Resolved</span>
                    ) : esc.acknowledged ? (
                      <button onClick={() => handleResolveEscalation(esc.id)} className="text-brand-600 hover:text-brand-700 font-medium">
                        Resolve
                      </button>
                    ) : (
                      <button onClick={() => handleAckEscalation(esc.id)} className="text-red-600 hover:text-red-700 font-medium">
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "sla" && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">SLA Configuration</h3>
          {vendor.slaConfig ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-gray-500">Default Due Days</dt><dd className="font-medium text-gray-900">{vendor.slaConfig.defaultDueDays}</dd></div>
              <div><dt className="text-gray-500">Reminder After Days</dt><dd className="font-medium text-gray-900">{vendor.slaConfig.reminderAfterDays}</dd></div>
              <div><dt className="text-gray-500">Escalation After Days</dt><dd className="font-medium text-gray-900">{vendor.slaConfig.escalationAfterDays}</dd></div>
              <div><dt className="text-gray-500">Max Reminders</dt><dd className="font-medium text-gray-900">{vendor.slaConfig.maxReminders}</dd></div>
              <div><dt className="text-gray-500">Auto-Escalate</dt><dd className={vendor.slaConfig.autoEscalate ? "text-green-700" : "text-gray-500"}>{vendor.slaConfig.autoEscalate ? "Enabled" : "Disabled"}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-gray-500">No SLA configuration set. Default vendor SLA (14 days) applies.</p>
          )}
        </div>
      )}
    </div>
  );
}
