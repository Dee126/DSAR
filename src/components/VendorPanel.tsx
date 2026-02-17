"use client";

import { useEffect, useState, useCallback } from "react";

interface VendorRequestSummary {
  id: string;
  status: string;
  subject: string;
  sentAt: string | null;
  dueAt: string | null;
  createdAt: string;
  vendor: { id: string; name: string; shortCode: string | null; status: string };
  system: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  items: Array<{
    id: string;
    description: string;
    status: string;
    system: { id: string; name: string } | null;
  }>;
  _count: { responses: number };
}

interface DerivedVendor {
  vendorId: string | null;
  vendorName: string;
  systemId: string;
  systemName: string;
  processorRole: string;
  contactEmail: string | null;
  dpaOnFile: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  ACKNOWLEDGED: "bg-cyan-100 text-cyan-700",
  PARTIALLY_RESPONDED: "bg-yellow-100 text-yellow-700",
  RESPONDED: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  ESCALATED: "bg-red-200 text-red-800",
  CLOSED: "bg-gray-100 text-gray-500",
};

export default function VendorPanel({ caseId }: { caseId: string }) {
  const [requests, setRequests] = useState<VendorRequestSummary[]>([]);
  const [derived, setDerived] = useState<DerivedVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDerived, setShowDerived] = useState(false);
  const [autoCreating, setAutoCreating] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/vendors?view=requests`);
      if (res.ok) setRequests(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  }, [caseId]);

  const fetchDerived = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/vendors?view=derive`);
      if (res.ok) setDerived(await res.json());
    } catch { /* silent */ }
  }, [caseId]);

  useEffect(() => {
    fetchRequests();
    fetchDerived();
  }, [fetchRequests, fetchDerived]);

  async function handleAutoDerive() {
    setAutoCreating(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto_derive" }),
      });
      if (res.ok) {
        await fetchRequests();
      }
    } catch { /* silent */ }
    setAutoCreating(false);
  }

  async function handleSend(requestId: string) {
    try {
      const res = await fetch(`/api/cases/${caseId}/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", requestId }),
      });
      if (res.ok) await fetchRequests();
    } catch { /* silent */ }
  }

  async function handleClose(requestId: string) {
    try {
      const res = await fetch(`/api/cases/${caseId}/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", requestId, status: "CLOSED", closedReason: "Manually closed" }),
      });
      if (res.ok) await fetchRequests();
    } catch { /* silent */ }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-48 rounded bg-gray-200" />
        <div className="h-24 rounded bg-gray-100" />
      </div>
    );
  }

  const openRequests = requests.filter((r) => !["CLOSED", "RESPONDED"].includes(r.status));
  const overdueCount = requests.filter(
    (r) => r.dueAt && new Date(r.dueAt) < new Date() && !["CLOSED", "RESPONDED"].includes(r.status),
  ).length;

  return (
    <div className="space-y-6">
      {/* Header with summary */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Vendor Requests</h3>
          <p className="text-sm text-gray-500">
            {requests.length} total &middot; {openRequests.length} open
            {overdueCount > 0 && (
              <span className="text-red-600 font-medium"> &middot; {overdueCount} overdue</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDerived(!showDerived)}
            className="btn-secondary text-sm"
          >
            {showDerived ? "Hide" : "Show"} Derived Vendors ({derived.length})
          </button>
          <button
            onClick={handleAutoDerive}
            disabled={autoCreating}
            className="btn-primary text-sm"
          >
            {autoCreating ? "Creating..." : "Auto-Create Requests"}
          </button>
        </div>
      </div>

      {/* Derived vendors panel */}
      {showDerived && derived.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">
            Derived Vendor Involvement
          </h4>
          <div className="space-y-2">
            {derived.map((v, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{v.vendorName}</span>
                  <span className="text-gray-500">via {v.systemName}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    v.processorRole === "SUBPROCESSOR" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"
                  }`}>
                    {v.processorRole}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {v.dpaOnFile ? (
                    <span className="text-xs text-green-600">DPA</span>
                  ) : (
                    <span className="text-xs text-red-600">No DPA</span>
                  )}
                  {v.contactEmail && (
                    <span className="text-xs text-gray-400">{v.contactEmail}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vendor requests list */}
      {requests.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-8 text-center">
          <p className="text-sm text-gray-500">
            No vendor requests yet. Click &quot;Auto-Create Requests&quot; to derive from linked systems,
            or create manually from the vendor registry.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const isOverdue = req.dueAt && new Date(req.dueAt) < new Date() && !["CLOSED", "RESPONDED"].includes(req.status);
            return (
              <div
                key={req.id}
                className={`rounded-lg border p-4 ${isOverdue ? "border-red-200 bg-red-50" : "border-gray-200"}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{req.vendor.name}</span>
                      {req.vendor.shortCode && (
                        <span className="text-xs text-gray-400">({req.vendor.shortCode})</span>
                      )}
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[req.status] || "bg-gray-100 text-gray-700"
                      }`}>
                        {req.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{req.subject}</p>
                    {req.system && (
                      <p className="text-xs text-gray-400 mt-0.5">System: {req.system.name}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {req.dueAt && (
                      <span className={isOverdue ? "text-red-600 font-medium" : "text-gray-500"}>
                        Due: {new Date(req.dueAt).toLocaleDateString()}
                      </span>
                    )}
                    <span className="text-gray-400">
                      {req._count.responses} response{req._count.responses !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Items */}
                {req.items.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {req.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-xs">
                        <span className={`inline-flex h-1.5 w-1.5 rounded-full ${
                          item.status === "COMPLETED" ? "bg-green-500" :
                          item.status === "IN_PROGRESS" ? "bg-yellow-500" :
                          item.status === "FAILED" ? "bg-red-500" : "bg-gray-300"
                        }`} />
                        <span className="text-gray-600">{item.description}</span>
                        {item.system && <span className="text-gray-400">({item.system.name})</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  {req.status === "DRAFT" && (
                    <button
                      onClick={() => handleSend(req.id)}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      Send Request
                    </button>
                  )}
                  {!["CLOSED", "RESPONDED"].includes(req.status) && (
                    <button
                      onClick={() => handleClose(req.id)}
                      className="text-xs font-medium text-gray-500 hover:text-gray-700"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
