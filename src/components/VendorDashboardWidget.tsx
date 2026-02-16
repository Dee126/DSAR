"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface VendorStats {
  totalVendors: number;
  activeVendors: number;
  dpaExpiringSoon: number;
  openRequests: number;
  overdueRequests: number;
  unacknowledgedEscalations: number;
}

export default function VendorDashboardWidget() {
  const [stats, setStats] = useState<VendorStats | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/vendors/stats");
        if (res.ok) setStats(await res.json());
      } catch { /* silent */ }
    }
    fetchStats();
  }, []);

  if (!stats || stats.totalVendors === 0) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            stats.overdueRequests > 0 || stats.unacknowledgedEscalations > 0
              ? "bg-orange-100"
              : "bg-teal-100"
          }`}>
            <svg className={`h-5 w-5 ${
              stats.overdueRequests > 0 || stats.unacknowledgedEscalations > 0
                ? "text-orange-600"
                : "text-teal-600"
            }`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 7.5h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Vendor / Processor Tracking</h3>
            <div className="mt-0.5 flex items-center gap-4 text-xs text-gray-500">
              <span>
                <span className="font-medium text-gray-700">{stats.activeVendors}</span>/{stats.totalVendors} active vendors
              </span>
              <span>
                <span className="font-medium text-gray-700">{stats.openRequests}</span> open requests
              </span>
              {stats.overdueRequests > 0 && (
                <span className="font-medium text-red-600">
                  {stats.overdueRequests} overdue
                </span>
              )}
            </div>
          </div>
        </div>
        <Link
          href="/governance/vendors"
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Vendor Registry
        </Link>
      </div>

      {/* Alert cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-teal-50 px-3 py-2 text-center">
          <p className="text-lg font-bold text-teal-700">{stats.activeVendors}</p>
          <p className="text-xs text-teal-600">Active Vendors</p>
        </div>
        <div className={`rounded-lg px-3 py-2 text-center ${
          stats.openRequests > 0 ? "bg-blue-50" : "bg-gray-50"
        }`}>
          <p className={`text-lg font-bold ${stats.openRequests > 0 ? "text-blue-700" : "text-gray-700"}`}>
            {stats.openRequests}
          </p>
          <p className={`text-xs ${stats.openRequests > 0 ? "text-blue-600" : "text-gray-600"}`}>
            Open Requests
          </p>
        </div>
        <div className={`rounded-lg px-3 py-2 text-center ${
          stats.overdueRequests > 0 ? "bg-red-50" : "bg-gray-50"
        }`}>
          <p className={`text-lg font-bold ${stats.overdueRequests > 0 ? "text-red-700" : "text-gray-700"}`}>
            {stats.overdueRequests}
          </p>
          <p className={`text-xs ${stats.overdueRequests > 0 ? "text-red-600" : "text-gray-600"}`}>
            Overdue
          </p>
        </div>
        <div className={`rounded-lg px-3 py-2 text-center ${
          stats.dpaExpiringSoon > 0 ? "bg-yellow-50" : "bg-gray-50"
        }`}>
          <p className={`text-lg font-bold ${stats.dpaExpiringSoon > 0 ? "text-yellow-700" : "text-gray-700"}`}>
            {stats.dpaExpiringSoon}
          </p>
          <p className={`text-xs ${stats.dpaExpiringSoon > 0 ? "text-yellow-600" : "text-gray-600"}`}>
            DPA Expiring
          </p>
        </div>
      </div>

      {/* Escalation banner */}
      {stats.unacknowledgedEscalations > 0 && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-sm font-medium text-red-800">
              {stats.unacknowledgedEscalations} unacknowledged escalation{stats.unacknowledgedEscalations !== 1 ? "s" : ""}
            </span>
          </div>
          <Link href="/governance/vendors?tab=escalations" className="text-xs font-medium text-red-700 hover:text-red-800">
            View
          </Link>
        </div>
      )}
    </div>
  );
}
