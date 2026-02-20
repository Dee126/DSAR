"use client";

import Link from "next/link";
import type { DSARCaseDetail, TabKey } from "../types";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS } from "../constants";
import { getSlaIndicator } from "../services";

interface Props {
  caseData: DSARCaseDetail;
  activeTab: TabKey;
  tabs: { key: TabKey; label: string; count?: number }[];
  canExport: boolean;
  onTabChange: (tab: TabKey) => void;
  onExport: () => void;
  allowedTransitions: string[];
  canManage: boolean;
  onTransition: (target: string) => void;
}

export function CaseHeader({
  caseData, activeTab, tabs, canExport, onTabChange, onExport,
  allowedTransitions, canManage, onTransition,
}: Props) {
  const sla = getSlaIndicator(caseData.dueDate);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <Link href="/cases" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl font-bold text-gray-900 md:text-2xl">{caseData.caseNumber}</h1>
              <span data-testid="case-status" className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[caseData.status] ?? "bg-gray-100 text-gray-800"}`}>{STATUS_LABELS[caseData.status] ?? caseData.status}</span>
              <span data-testid="case-type" className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[caseData.priority] ?? "bg-gray-100 text-gray-700"}`}>{caseData.priority}</span>
              {caseData.identityVerified && <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">ID Verified</span>}
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
              <span className={`flex items-center gap-1.5 ${sla === "overdue" ? "font-medium text-red-600" : sla === "due_soon" ? "font-medium text-yellow-600" : "text-gray-500"}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${sla === "overdue" ? "bg-red-500" : sla === "due_soon" ? "bg-yellow-500" : "bg-green-500"}`} />
                Due {new Date(caseData.dueDate).toLocaleDateString()}{sla === "overdue" && " (Overdue)"}{sla === "due_soon" && " (Due Soon)"}
              </span>
              {caseData.extendedDueDate && <span className="text-xs text-gray-400">Extended to {new Date(caseData.extendedDueDate).toLocaleDateString()}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <button onClick={onExport} className="btn-secondary" data-testid="export-evidence">
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              Export
            </button>
          )}
        </div>
      </div>

      {/* Status Transitions */}
      {canManage && allowedTransitions.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700">Status Transition</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {allowedTransitions.map((target) => (
              <button key={target} data-status={target} onClick={() => onTransition(target)}
                className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${target === "REJECTED" ? "border-red-200 text-red-700 hover:bg-red-50" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                {STATUS_LABELS[target] ?? target}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-3 overflow-x-auto sm:gap-6">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => onTabChange(tab.key)}
              className={`whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors ${activeTab === tab.key ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"}`}>
              {tab.label}
              {tab.count !== undefined && <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs">{tab.count}</span>}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
