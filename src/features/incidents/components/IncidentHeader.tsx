"use client";

import Link from "next/link";
import type { Incident, TabKey } from "../types";
import { SEVERITY_COLORS, INCIDENT_STATUS_COLORS, TABS } from "../constants";

interface Props {
  incident: Incident;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export function IncidentHeader({ incident, activeTab, onTabChange }: Props) {
  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/governance"
            className="text-sm text-gray-500 hover:text-brand-600 mb-2 inline-block"
          >
            &larr; Back to Governance
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{incident.title}</h1>
          <div className="mt-2 flex items-center gap-3">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                SEVERITY_COLORS[incident.severity] ?? "bg-gray-100 text-gray-700"
              }`}
            >
              {incident.severity}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                INCIDENT_STATUS_COLORS[incident.status] ?? "bg-gray-100 text-gray-700"
              }`}
            >
              {incident.status}
            </span>
            {incident.crossBorder && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                Cross-Border
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
