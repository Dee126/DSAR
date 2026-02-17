"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface KpiSummary {
  totalDsars: number;
  openDsars: number;
  closedDsars: number;
  overdueRatePct: number | null;
  maturityScore: number | null;
  highRiskCasesCount: number;
  avgTimeToCloseDays: number | null;
}

export default function ExecutiveKpiWidget() {
  const [kpi, setKpi] = useState<KpiSummary | null>(null);

  useEffect(() => {
    async function fetchKpi() {
      try {
        const res = await fetch("/api/executive/kpis");
        if (res.ok) setKpi(await res.json());
      } catch { /* silent */ }
    }
    fetchKpi();
  }, []);

  if (!kpi) return null;

  const maturityColor =
    (kpi.maturityScore ?? 0) >= 70 ? "text-green-600" :
    (kpi.maturityScore ?? 0) >= 40 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
            <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Executive Privacy KPIs</h3>
            <div className="mt-0.5 flex items-center gap-4 text-xs text-gray-500">
              <span>
                Maturity: <span className={`font-medium ${maturityColor}`}>{kpi.maturityScore ?? "—"}/100</span>
              </span>
              <span>
                Avg Close: <span className="font-medium text-gray-700">{kpi.avgTimeToCloseDays ?? "—"} days</span>
              </span>
              {(kpi.overdueRatePct ?? 0) > 0 && (
                <span className="font-medium text-red-600">
                  {kpi.overdueRatePct}% overdue
                </span>
              )}
            </div>
          </div>
        </div>
        <Link
          href="/executive"
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Full Dashboard
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-indigo-50 px-3 py-2 text-center">
          <p className="text-lg font-bold text-indigo-700">{kpi.totalDsars}</p>
          <p className="text-xs text-indigo-600">Total DSARs</p>
        </div>
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-center">
          <p className="text-lg font-bold text-blue-700">{kpi.openDsars}</p>
          <p className="text-xs text-blue-600">Open</p>
        </div>
        <div className={`rounded-lg px-3 py-2 text-center ${
          kpi.highRiskCasesCount > 0 ? "bg-red-50" : "bg-gray-50"
        }`}>
          <p className={`text-lg font-bold ${kpi.highRiskCasesCount > 0 ? "text-red-700" : "text-gray-700"}`}>
            {kpi.highRiskCasesCount}
          </p>
          <p className={`text-xs ${kpi.highRiskCasesCount > 0 ? "text-red-600" : "text-gray-600"}`}>
            High Risk
          </p>
        </div>
        <div className={`rounded-lg px-3 py-2 text-center ${
          (kpi.maturityScore ?? 0) >= 70 ? "bg-green-50" :
          (kpi.maturityScore ?? 0) >= 40 ? "bg-yellow-50" : "bg-red-50"
        }`}>
          <p className={`text-lg font-bold ${maturityColor}`}>
            {kpi.maturityScore ?? "—"}
          </p>
          <p className={`text-xs ${
            (kpi.maturityScore ?? 0) >= 70 ? "text-green-600" :
            (kpi.maturityScore ?? 0) >= 40 ? "text-yellow-600" : "text-red-600"
          }`}>
            Maturity
          </p>
        </div>
      </div>
    </div>
  );
}
