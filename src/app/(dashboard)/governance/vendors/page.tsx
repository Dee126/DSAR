"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";

interface VendorSummary {
  id: string;
  name: string;
  shortCode: string | null;
  status: string;
  headquartersCountry: string | null;
  dpaOnFile: boolean;
  dpaExpiresAt: string | null;
  contractReference: string | null;
  contacts: Array<{ id: string; name: string; email: string; isPrimary: boolean }>;
  _count: { requests: number; systemProcessors: number; escalations: number };
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-gray-100 text-gray-500",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-700",
};

export default function VendorRegistryPage() {
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  async function fetchVendors() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/vendors?${params}`);
      if (res.ok) setVendors(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  }

  useEffect(() => {
    fetchVendors();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          shortCode: form.get("shortCode") || undefined,
          headquartersCountry: form.get("headquartersCountry") || undefined,
          website: form.get("website") || undefined,
          contractReference: form.get("contractReference") || undefined,
          dpaOnFile: form.get("dpaOnFile") === "on",
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        fetchVendors();
      }
    } catch { /* silent */ }
    setCreating(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vendor Registry</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage processors and sub-processors involved in DSAR fulfillment.
          </p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          Add Vendor
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Search vendors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchVendors()}
          className="input flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input sm:w-40"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="UNDER_REVIEW">Under Review</option>
        </select>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="card border-brand-200 bg-brand-50">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">New Vendor</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input name="name" placeholder="Vendor Name *" required className="input" />
            <input name="shortCode" placeholder="Short Code (e.g. SF)" className="input" />
            <input name="headquartersCountry" placeholder="HQ Country" className="input" />
            <input name="website" placeholder="Website URL" className="input" />
            <input name="contractReference" placeholder="Contract Reference" className="input" />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="dpaOnFile" className="rounded" />
              DPA on file
            </label>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={creating} className="btn-primary">
                {creating ? "Creating..." : "Create Vendor"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vendor list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-5 w-48 rounded bg-gray-200" />
              <div className="mt-2 h-4 w-96 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm text-gray-500">No vendors found. Add your first vendor to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vendors.map((vendor) => (
            <Link
              key={vendor.id}
              href={`/governance/vendors/${vendor.id}`}
              className="card block transition-colors hover:bg-gray-50"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{vendor.name}</span>
                    {vendor.shortCode && (
                      <span className="text-xs text-gray-400">({vendor.shortCode})</span>
                    )}
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_COLORS[vendor.status] || "bg-gray-100 text-gray-700"
                    }`}>
                      {vendor.status}
                    </span>
                    {vendor.dpaOnFile ? (
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                        DPA
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                        No DPA
                      </span>
                    )}
                  </div>
                  {vendor.contacts.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      Primary: {vendor.contacts[0].name} ({vendor.contacts[0].email})
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{vendor._count.systemProcessors} system{vendor._count.systemProcessors !== 1 ? "s" : ""}</span>
                  <span>{vendor._count.requests} request{vendor._count.requests !== 1 ? "s" : ""}</span>
                  {vendor._count.escalations > 0 && (
                    <span className="font-medium text-red-600">{vendor._count.escalations} escalation{vendor._count.escalations !== 1 ? "s" : ""}</span>
                  )}
                  {vendor.headquartersCountry && <span>{vendor.headquartersCountry}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
