"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useToast, ToastContainer } from "@/components/Toast";
import { fetchHeatmapOverview } from "@/features/heatmap/services/heatmapApi";
import type {
  HeatmapOverviewResponse,
  HeatmapSystemRow,
  HeatmapCounts,
  HeatmapSummary,
  HeatmapSortKey,
  HeatmapFilters,
} from "@/features/heatmap/types";

/* ── Constants ─────────────────────────────────────────────────────────── */

const CATEGORY_LABELS: Record<string, string> = {
  IDENTIFICATION: "Identification",
  CONTACT: "Contact",
  CONTRACT: "Contract",
  PAYMENT: "Payment",
  COMMUNICATION: "Communication",
  HR: "HR",
  CREDITWORTHINESS: "Credit",
  ONLINE_TECHNICAL: "Online/Technical",
  HEALTH: "Health (Art.9)",
  RELIGION: "Religion (Art.9)",
  UNION: "Union (Art.9)",
  POLITICAL_OPINION: "Political (Art.9)",
  OTHER_SPECIAL_CATEGORY: "Special Cat. (Art.9)",
  OTHER: "Other",
};

const SORT_OPTIONS: { value: HeatmapSortKey; label: string }[] = [
  { value: "risk-desc", label: "Risk: High \u2192 Low" },
  { value: "risk-asc", label: "Risk: Low \u2192 High" },
  { value: "findings-desc", label: "Most Findings" },
  { value: "name-asc", label: "Name: A \u2192 Z" },
  { value: "name-desc", label: "Name: Z \u2192 A" },
];

const DEFAULT_FILTERS: HeatmapFilters = {
  search: "",
  criticality: "ALL",
  systemType: "ALL",
  onlySpecialCategories: false,
  onlyHighRisk: false,
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

function riskBg(score: number): string {
  if (score >= 70) return "bg-red-50 border-red-300";
  if (score >= 40) return "bg-amber-50 border-amber-300";
  return "bg-emerald-50 border-emerald-300";
}

function riskBadgeBg(score: number): string {
  if (score >= 70) return "bg-red-600";
  if (score >= 40) return "bg-amber-500";
  return "bg-emerald-500";
}

function riskTextColor(score: number): string {
  if (score >= 70) return "text-red-700";
  if (score >= 40) return "text-amber-700";
  return "text-emerald-700";
}

function riskLabel(score: number): string {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function isSpecialCategory(cat: string): boolean {
  return (
    cat.includes("HEALTH") ||
    cat.includes("RELIGION") ||
    cat.includes("UNION") ||
    cat.includes("POLITICAL") ||
    cat.includes("SPECIAL")
  );
}

/* ── Sorting ───────────────────────────────────────────────────────────── */

function sortSystems(
  systems: HeatmapSystemRow[],
  key: HeatmapSortKey,
): HeatmapSystemRow[] {
  const sorted = [...systems];
  switch (key) {
    case "risk-desc":
      return sorted.sort(
        (a, b) => b.riskScore - a.riskScore || a.systemName.localeCompare(b.systemName),
      );
    case "risk-asc":
      return sorted.sort(
        (a, b) => a.riskScore - b.riskScore || a.systemName.localeCompare(b.systemName),
      );
    case "findings-desc":
      return sorted.sort(
        (a, b) => b.counts.total - a.counts.total || b.riskScore - a.riskScore,
      );
    case "name-asc":
      return sorted.sort((a, b) => a.systemName.localeCompare(b.systemName));
    case "name-desc":
      return sorted.sort((a, b) => b.systemName.localeCompare(a.systemName));
    default:
      return sorted;
  }
}

/* ── SVG Icons (inline) ───────────────────────────────────────────────── */

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function IconChevron({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}

function IconDatabase({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  );
}

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  );
}

/* ── Donut Chart (SVG) ────────────────────────────────────────────────── */

function DonutChart({
  segments,
  size = 120,
  thickness = 20,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-gray-400"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );
  }

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dash = circumference * pct;
          const gap = circumference - dash;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              className="transition-all duration-500"
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-gray-900">{total}</span>
        <span className="text-[10px] text-gray-500">findings</span>
      </div>
    </div>
  );
}

/* ── Horizontal Bar ───────────────────────────────────────────────────── */

function HorizontalBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 truncate text-gray-600">{label}</span>
      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right font-medium text-gray-700">{value}</span>
    </div>
  );
}

/* ── Summary Ribbon ───────────────────────────────────────────────────── */

function SummaryRibbon({
  totals,
  systemsCount,
  summary,
}: {
  totals: HeatmapCounts;
  systemsCount: number;
  summary: HeatmapSummary;
}) {
  const items = [
    { label: "Systems", value: systemsCount, bgClass: "bg-slate-50 border-slate-200", textClass: "text-slate-800", dotClass: "bg-slate-400" },
    { label: "Total Findings", value: totals.total, bgClass: "bg-gray-50 border-gray-200", textClass: "text-gray-900", dotClass: "bg-gray-500" },
    { label: "Green (<40)", value: totals.green, bgClass: "bg-emerald-50 border-emerald-200", textClass: "text-emerald-700", dotClass: "bg-emerald-500" },
    { label: "Yellow (40-69)", value: totals.yellow, bgClass: "bg-amber-50 border-amber-200", textClass: "text-amber-700", dotClass: "bg-amber-500" },
    { label: "Red (\u226570)", value: totals.red, bgClass: "bg-red-50 border-red-200", textClass: "text-red-700", dotClass: "bg-red-500" },
    { label: "Mitigated", value: summary.statusCounts.MITIGATED, bgClass: "bg-teal-50 border-teal-200", textClass: "text-teal-700", dotClass: "bg-teal-500" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-xl border px-3 py-3 text-center transition-shadow hover:shadow-sm ${item.bgClass}`}
        >
          <p className={`text-2xl font-bold tabular-nums ${item.textClass}`}>{item.value}</p>
          <p className="mt-0.5 flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${item.dotClass}`} />
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ── System Card ──────────────────────────────────────────────────────── */

function SystemCard({
  system,
  onClick,
}: {
  system: HeatmapSystemRow;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col rounded-xl border-2 p-4 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${riskBg(system.riskScore)}`}
    >
      {/* Risk Score Badge */}
      <div
        className={`absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white shadow-md transition-transform group-hover:scale-110 ${riskBadgeBg(system.riskScore)}`}
      >
        {system.riskScore}
      </div>

      {/* System name */}
      <h3 className="pr-10 text-sm font-bold text-gray-900 leading-tight">
        {system.systemName}
      </h3>

      {/* Badges row */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {system.systemType && system.systemType !== "NONE" && (
          <span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-200">
            {system.systemType}
          </span>
        )}
        <span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-200">
          {system.criticality}
        </span>
        {system.containsSpecialCategories && (
          <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-red-200">
            Art. 9 {system.specialCategoryCount > 0 && `(${system.specialCategoryCount})`}
          </span>
        )}
      </div>

      {/* Risk band progress bar */}
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-gray-200/80">
        {system.counts.total > 0 && (
          <>
            {system.counts.green > 0 && (
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{ width: `${(system.counts.green / system.counts.total) * 100}%` }}
              />
            )}
            {system.counts.yellow > 0 && (
              <div
                className="bg-amber-500 transition-all duration-500"
                style={{ width: `${(system.counts.yellow / system.counts.total) * 100}%` }}
              />
            )}
            {system.counts.red > 0 && (
              <div
                className="bg-red-500 transition-all duration-500"
                style={{ width: `${(system.counts.red / system.counts.total) * 100}%` }}
              />
            )}
          </>
        )}
      </div>

      {/* Counts row */}
      <div className="mt-2 flex items-center gap-3 text-[11px] font-medium">
        <span className="flex items-center gap-1 text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {system.counts.green}
        </span>
        <span className="flex items-center gap-1 text-amber-700">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          {system.counts.yellow}
        </span>
        <span className="flex items-center gap-1 text-red-700">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          {system.counts.red}
        </span>
        <span className="ml-auto font-bold text-gray-700">
          {system.counts.total} total
        </span>
      </div>

      {/* Status chips */}
      <div className="mt-2 flex flex-wrap gap-1">
        {system.statusCounts.OPEN > 0 && (
          <span className="rounded-md bg-indigo-100/80 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
            {system.statusCounts.OPEN} open
          </span>
        )}
        {system.statusCounts.MITIGATING > 0 && (
          <span className="rounded-md bg-blue-100/80 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
            {system.statusCounts.MITIGATING} mitigating
          </span>
        )}
        {system.statusCounts.ACCEPTED > 0 && (
          <span className="rounded-md bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
            {system.statusCounts.ACCEPTED} accepted
          </span>
        )}
        {system.statusCounts.MITIGATED > 0 && (
          <span className="rounded-md bg-emerald-100/80 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
            {system.statusCounts.MITIGATED} mitigated
          </span>
        )}
      </div>

      {/* Last scan */}
      <p className="mt-auto pt-2 text-[10px] text-gray-400">
        Last scan: {system.lastScanAt ? relativeTime(system.lastScanAt) : "No scans"}
      </p>

      {/* Hover arrow indicator */}
      <div className="absolute bottom-3 right-3 opacity-0 transition-opacity group-hover:opacity-100">
        <IconArrowRight className="h-4 w-4 text-gray-400" />
      </div>
    </button>
  );
}

/* ── System Drilldown Drawer ──────────────────────────────────────────── */

function SystemDrawer({
  system,
  onClose,
}: {
  system: HeatmapSystemRow;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  const catEntries = Object.entries(system.categoryBreakdown)
    .sort(([, a], [, b]) => b.total - a.total);

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className={`fixed inset-0 z-50 transition-colors duration-300 ${visible ? "bg-black/40" : "bg-black/0"}`}
    >
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl transition-transform duration-300 ease-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 border-b px-6 py-5 ${riskBg(system.riskScore)}`}>
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-gray-900">
                {system.systemName}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                {system.systemType && system.systemType !== "NONE" && (
                  <span className="rounded-md bg-white/80 px-2 py-0.5 font-semibold text-gray-700 ring-1 ring-gray-300">
                    {system.systemType}
                  </span>
                )}
                <span className="rounded-md bg-white/80 px-2 py-0.5 font-semibold text-gray-700 ring-1 ring-gray-300">
                  {system.criticality}
                </span>
                {system.containsSpecialCategories && (
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 font-bold text-red-700">
                    Art. 9 Data
                  </span>
                )}
              </div>
              {system.description && (
                <p className="mt-2 text-xs text-gray-500 leading-relaxed">{system.description}</p>
              )}
            </div>
            <div className="flex flex-col items-center shrink-0">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white shadow-lg ${riskBadgeBg(system.riskScore)}`}
              >
                {system.riskScore}
              </div>
              <span className={`mt-1 text-[10px] font-bold ${riskTextColor(system.riskScore)}`}>
                {riskLabel(system.riskScore)} Risk
              </span>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-white/60 hover:text-gray-700 transition-colors"
              aria-label="Close"
            >
              <IconX className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-6 px-6 py-6">
          {/* Section 1: Risk Band Counts */}
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
              Findings by Risk Band
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Green (<40)", value: system.counts.green, bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
                { label: "Yellow (40-69)", value: system.counts.yellow, bg: "bg-amber-50 border-amber-200", text: "text-amber-700" },
                { label: "Red (\u226570)", value: system.counts.red, bg: "bg-red-50 border-red-200", text: "text-red-700" },
                { label: "Total", value: system.counts.total, bg: "bg-gray-50 border-gray-200", text: "text-gray-900" },
              ].map((c) => (
                <div key={c.label} className={`rounded-xl border p-3 text-center ${c.bg}`}>
                  <p className={`text-2xl font-bold tabular-nums ${c.text}`}>{c.value}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500">{c.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 2: Status Counts */}
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
              Finding Status
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {([
                { key: "OPEN", label: "Open", color: "bg-indigo-50 border-indigo-200", text: "text-indigo-700" },
                { key: "ACCEPTED", label: "Accepted", color: "bg-amber-50 border-amber-200", text: "text-amber-700" },
                { key: "MITIGATING", label: "Mitigating", color: "bg-blue-50 border-blue-200", text: "text-blue-700" },
                { key: "MITIGATED", label: "Mitigated", color: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
              ] as const).map((s) => (
                <div key={s.key} className={`rounded-xl border p-3 text-center ${s.color}`}>
                  <p className={`text-2xl font-bold tabular-nums ${s.text}`}>
                    {system.statusCounts[s.key]}
                  </p>
                  <p className="mt-0.5 text-[10px] text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: Severity Counts */}
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
              Severity
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: "CRITICAL", label: "Critical", color: "bg-red-50 border-red-200", text: "text-red-700" },
                { key: "WARNING", label: "Warning", color: "bg-yellow-50 border-yellow-200", text: "text-yellow-700" },
                { key: "INFO", label: "Info", color: "bg-blue-50 border-blue-200", text: "text-blue-700" },
              ] as const).map((s) => (
                <div key={s.key} className={`rounded-xl border p-3 text-center ${s.color}`}>
                  <p className={`text-2xl font-bold tabular-nums ${s.text}`}>
                    {system.severityCounts[s.key]}
                  </p>
                  <p className="mt-0.5 text-[10px] text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 4: Category Breakdown */}
          {catEntries.length > 0 && (
            <section>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                Data Categories
              </h3>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2.5 text-left font-bold text-gray-700">Category</th>
                      <th className="px-2 py-2.5 text-center font-semibold text-gray-600">Total</th>
                      <th className="px-2 py-2.5 text-center font-semibold text-emerald-600">Green</th>
                      <th className="px-2 py-2.5 text-center font-semibold text-amber-600">Yellow</th>
                      <th className="px-2 py-2.5 text-center font-semibold text-red-600">Red</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catEntries.map(([cat, counts]) => (
                      <tr key={cat} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {CATEGORY_LABELS[cat] ?? cat}
                          {isSpecialCategory(cat) && (
                            <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                              Art.9
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center font-bold text-gray-900">{counts.total}</td>
                        <td className="px-2 py-2 text-center text-emerald-700">{counts.green}</td>
                        <td className="px-2 py-2 text-center text-amber-700">{counts.yellow}</td>
                        <td className="px-2 py-2 text-center text-red-700">{counts.red}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Section 5: Special Category Warning */}
          {system.specialCategoryCount > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-700">
                {system.specialCategoryCount} finding{system.specialCategoryCount !== 1 ? "s" : ""} contain Art. 9 special category data
              </p>
            </div>
          )}

          {/* Last scan */}
          <p className="text-xs text-gray-400">
            Last scan:{" "}
            {system.lastScanAt ? relativeTime(system.lastScanAt) : "No scans"}
          </p>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between border-t bg-white px-6 py-4">
          <Link
            href={`/heatmap/system/${system.systemId}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
          >
            View all findings
            <IconArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={onClose}
            className="btn-secondary text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Pending Decision Item type ───────────────────────────────────────── */

interface PendingItem {
  id: string;
  systemId: string | null;
  dataCategory: string;
  summary: string;
  aiRiskScore: number | null;
  aiSuggestedAction: string | null;
  aiConfidence: number | null;
  aiLegalReference: string | null;
  sensitivityScore: number;
  containsSpecialCategory: boolean;
  createdAt: string;
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function HeatmapPage() {
  // Data state
  const [systems, setSystems] = useState<HeatmapSystemRow[]>([]);
  const [totals, setTotals] = useState<HeatmapCounts | null>(null);
  const [summary, setSummary] = useState<HeatmapSummary | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & sort state
  const [filters, setFilters] = useState<HeatmapFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<HeatmapSortKey>("risk-desc");

  // Drilldown drawer
  const [selectedSystem, setSelectedSystem] = useState<HeatmapSystemRow | null>(null);

  // Analytics panel toggle
  const [analyticsOpen, setAnalyticsOpen] = useState(true);
  // Grid table toggle
  const [gridOpen, setGridOpen] = useState(false);

  // Demo controls (dev-only)
  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [demoStatus, setDemoStatus] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Toast
  const { toasts, addToast } = useToast();

  // AI Decisions panel state (dev-only)
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* ── Data fetching ──────────────────────────────────────────────────── */

  const fetchHeatmap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: HeatmapOverviewResponse = await fetchHeatmapOverview();
      setSystems(data.systems);
      setTotals(data.totals);
      setSummary(data.summary);
      if (data._warnings) setWarnings(data._warnings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/findings/pending-decisions", {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setPendingItems(data.items ?? []);
    } catch {
      // silently fail — panel is dev-only
    }
  }, []);

  useEffect(() => {
    fetchHeatmap();
    if (process.env.NODE_ENV === "development") {
      fetchPending();
    }
  }, [fetchHeatmap, fetchPending]);

  /* ── AI Decisions ───────────────────────────────────────────────────── */

  const submitDecision = async (findingId: string, decision: string) => {
    const reason = window.prompt(
      `Reason for "${decision}" (min 5 chars):`,
    );
    if (!reason || reason.trim().length < 5) {
      addToast("error", "Decision cancelled \u2014 reason must be at least 5 characters.");
      return;
    }
    setDecidingId(findingId);
    try {
      const res = await fetch(`/api/findings/${findingId}/decision`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: reason.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      addToast("success", `Decision "${decision}" saved.`);
      await Promise.all([fetchPending(), fetchHeatmap()]);
    } catch (err) {
      addToast(
        "error",
        `Decision failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setDecidingId(null);
    }
  };

  /* ── Demo controls ──────────────────────────────────────────────────── */

  const seedDemoData = async () => {
    setSeeding(true);
    setMenuOpen(false);
    setDemoStatus(null);
    try {
      const res = await fetch("/api/demo/seed-heatmap", { method: "POST", credentials: "include" });
      const data = await res.json();
      setDemoStatus(JSON.stringify(data, null, 2));
      if (!res.ok) throw new Error(data.error || `Seed failed: HTTP ${res.status}`);
      await fetchHeatmap();
      addToast(
        "success",
        `Seed complete \u2014 ${data.seededSystems} systems, ${data.seededFindings} findings`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast("error", `Failed to seed demo data: ${msg}`);
    } finally {
      setSeeding(false);
    }
  };

  const resetDemoData = async () => {
    setResetting(true);
    setMenuOpen(false);
    setDemoStatus(null);
    try {
      const res = await fetch("/api/demo/reset-heatmap", { method: "POST", credentials: "include" });
      const data = await res.json();
      setDemoStatus(JSON.stringify(data, null, 2));
      if (!res.ok) throw new Error(data.error || `Reset failed: HTTP ${res.status}`);
      await fetchHeatmap();
      addToast(
        "success",
        `Reset complete \u2014 ${data.removedSystems} systems, ${data.removedFindings} findings removed`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast("error", `Failed to reset demo data: ${msg}`);
    } finally {
      setResetting(false);
    }
  };

  /* ── Derived: filter options from data ──────────────────────────────── */

  const criticalityOptions = useMemo(() => {
    const set = new Set(systems.map((s) => s.criticality));
    return ["ALL", ...Array.from(set).sort()];
  }, [systems]);

  const systemTypeOptions = useMemo(() => {
    const set = new Set(systems.map((s) => s.systemType).filter((t) => t && t !== "NONE"));
    return ["ALL", ...Array.from(set).sort()];
  }, [systems]);

  /* ── Derived: filtered + sorted systems ─────────────────────────────── */

  const filteredSystems = useMemo(() => {
    let result = systems;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (s) =>
          s.systemName.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)),
      );
    }
    if (filters.criticality !== "ALL") {
      result = result.filter((s) => s.criticality === filters.criticality);
    }
    if (filters.systemType !== "ALL") {
      result = result.filter((s) => s.systemType === filters.systemType);
    }
    if (filters.onlySpecialCategories) {
      result = result.filter((s) => s.containsSpecialCategories);
    }
    if (filters.onlyHighRisk) {
      result = result.filter((s) => s.riskScore >= 70);
    }

    return sortSystems(result, sortKey);
  }, [systems, filters, sortKey]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.search) n++;
    if (filters.criticality !== "ALL") n++;
    if (filters.systemType !== "ALL") n++;
    if (filters.onlySpecialCategories) n++;
    if (filters.onlyHighRisk) n++;
    return n;
  }, [filters]);

  /* ── Render: Loading ────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-52 animate-pulse rounded-lg bg-gray-200" />
            <div className="mt-2 h-4 w-80 animate-pulse rounded-lg bg-gray-100" />
          </div>
        </div>
        {/* Skeleton summary ribbon */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[76px] animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
        {/* Skeleton filter bar */}
        <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
        {/* Skeleton system cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  /* ── Render: Error ──────────────────────────────────────────────────── */

  if (error) {
    const isAuthError =
      error.includes("Authentication") || error.includes("401") || error.includes("Unauthorized");

    return (
      <div className="space-y-4">
        {/* Dev-only: still show demo controls when there's an error */}
        {process.env.NODE_ENV === "development" && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-700">
                Demo Mode: DEMO_TENANT_ID{" "}
                {process.env.NEXT_PUBLIC_DEMO_TENANT_ID
                  ? process.env.NEXT_PUBLIC_DEMO_TENANT_ID.slice(0, 8) + "\u2026"
                  : "(set in .env)"}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={seedDemoData}
                  disabled={seeding || resetting}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {seeding ? "Seeding\u2026" : "Seed Demo Data"}
                </button>
                <button
                  onClick={resetDemoData}
                  disabled={seeding || resetting}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {resetting ? "Resetting\u2026" : "Reset Demo Data"}
                </button>
              </div>
            </div>
            {demoStatus && (
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-gray-900 p-2 text-[11px] text-green-300">
                {demoStatus}
              </pre>
            )}
          </div>
        )}

        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
          {isAuthError ? (
            <>
              <IconLock className="mx-auto h-10 w-10 text-red-400" />
              <p className="mt-3 text-sm font-medium text-red-700">
                Please log in to view the heatmap.
              </p>
              <Link
                href="/login"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-800 transition-colors"
              >
                Go to login
                <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-red-700">
                Failed to load heatmap: {error}
              </p>
              <button
                onClick={fetchHeatmap}
                className="mt-3 text-sm font-semibold text-red-600 hover:text-red-800 transition-colors"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── Render: Chart data ──────────────────────────────────────────────── */

  const topCategories = summary
    ? Object.entries(summary.categoryCounts).slice(0, 8)
    : [];
  const maxCatCount = topCategories.length
    ? Math.max(...topCategories.map(([, v]) => v))
    : 0;

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} />

      {/* Drilldown Drawer */}
      {selectedSystem && (
        <SystemDrawer
          system={selectedSystem}
          onClose={() => setSelectedSystem(null)}
        />
      )}

      {/* Dev-only: Demo Controls */}
      {process.env.NODE_ENV === "development" && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700">
              Demo Mode: DEMO_TENANT_ID{" "}
              {process.env.NEXT_PUBLIC_DEMO_TENANT_ID
                ? process.env.NEXT_PUBLIC_DEMO_TENANT_ID.slice(0, 8) + "\u2026"
                : "(set in .env)"}
            </span>
            <div className="flex gap-2">
              <button
                onClick={seedDemoData}
                disabled={seeding || resetting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <IconDatabase className="h-3.5 w-3.5" />
                {seeding ? "Seeding\u2026" : "Seed Demo Data"}
              </button>
              <button
                onClick={resetDemoData}
                disabled={seeding || resetting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <IconTrash className="h-3.5 w-3.5" />
                {resetting ? "Resetting\u2026" : "Reset Demo Data"}
              </button>
            </div>
          </div>
          {demoStatus && (
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-gray-900 p-2 text-[11px] text-green-300">
              {demoStatus}
            </pre>
          )}
        </div>
      )}

      {/* Warnings Banner */}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          {warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-800">{w}</p>
          ))}
        </div>
      )}

      {/* Header + Menu */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            DPO Risk Heatmap
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            System-level risk overview based on discovery findings. Click a
            system card to view breakdowns, or drill into individual findings.
          </p>
        </div>
        {/* Dev-only: More menu */}
        {process.env.NODE_ENV === "development" && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              More
              <IconChevron className="ml-1 -mr-0.5 inline-block h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Demo
                </div>
                <button
                  onClick={seedDemoData}
                  disabled={seeding || resetting}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <IconDatabase className="h-4 w-4 text-indigo-500" />
                  {seeding ? "Seeding\u2026" : "Seed Demo Data"}
                </button>
                <button
                  onClick={resetDemoData}
                  disabled={seeding || resetting}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  <IconTrash className="h-4 w-4 text-red-500" />
                  {resetting ? "Resetting\u2026" : "Reset Demo Data"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Summary Ribbon ─────────────────────────────────────────────── */}
      {totals && summary && (
        <SummaryRibbon
          totals={totals}
          systemsCount={systems.length}
          summary={summary}
        />
      )}

      {/* ── Analytics Section (collapsible) ────────────────────────────── */}
      {totals && totals.total > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <button
            onClick={() => setAnalyticsOpen((o) => !o)}
            className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors rounded-xl"
          >
            <span className="text-sm font-semibold text-gray-700">Analytics</span>
            <IconChevron
              className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${analyticsOpen ? "rotate-180" : ""}`}
            />
          </button>

          {analyticsOpen && (
            <div className="border-t border-gray-100 px-5 pb-5 pt-4">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Risk Distribution Donut */}
                <div className="flex flex-col items-center gap-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Risk Distribution
                  </h3>
                  <DonutChart
                    segments={[
                      { value: totals.green, color: "#10b981", label: "Green" },
                      { value: totals.yellow, color: "#f59e0b", label: "Yellow" },
                      { value: totals.red, color: "#ef4444", label: "Red" },
                    ]}
                  />
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      {totals.green} Green
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      {totals.yellow} Yellow
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                      {totals.red} Red
                    </span>
                  </div>
                </div>

                {/* Status Donut */}
                {summary && (
                  <div className="flex flex-col items-center gap-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Finding Status
                    </h3>
                    <DonutChart
                      segments={[
                        { value: summary.statusCounts.OPEN, color: "#6366f1", label: "Open" },
                        { value: summary.statusCounts.ACCEPTED, color: "#f59e0b", label: "Accepted" },
                        { value: summary.statusCounts.MITIGATING, color: "#3b82f6", label: "Mitigating" },
                        { value: summary.statusCounts.MITIGATED, color: "#10b981", label: "Mitigated" },
                      ]}
                    />
                    <div className="flex flex-wrap gap-4 text-xs">
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                        {summary.statusCounts.OPEN} Open
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        {summary.statusCounts.ACCEPTED} Accepted
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        {summary.statusCounts.MITIGATING} Mitigating
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        {summary.statusCounts.MITIGATED} Mitigated
                      </span>
                    </div>
                  </div>
                )}

                {/* Top Data Categories */}
                <div>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500 text-center lg:text-left">
                    Top Data Categories
                  </h3>
                  <div className="space-y-2">
                    {topCategories.map(([cat, count]) => (
                      <HorizontalBar
                        key={cat}
                        label={CATEGORY_LABELS[cat] ?? cat}
                        value={count}
                        max={maxCatCount}
                        color={isSpecialCategory(cat) ? "bg-red-500" : "bg-brand-500"}
                      />
                    ))}
                    {topCategories.length === 0 && (
                      <p className="text-xs text-gray-400">No findings yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Decisions Panel (dev-only) */}
      {process.env.NODE_ENV === "development" && pendingItems.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50">
          <button
            onClick={() => setPendingOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-amber-800">
              AI Decisions (Pending) &mdash; {pendingItems.length} item
              {pendingItems.length !== 1 ? "s" : ""}
            </span>
            <IconChevron
              className={`h-4 w-4 text-amber-600 transition-transform duration-200 ${pendingOpen ? "rotate-180" : ""}`}
            />
          </button>

          {pendingOpen && (
            <div className="border-t border-amber-200 px-4 pb-4 pt-2">
              <div className="space-y-3">
                {pendingItems.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{item.summary}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-gray-600">
                          {CATEGORY_LABELS[item.dataCategory] ?? item.dataCategory}
                        </span>
                        {item.aiSuggestedAction && (
                          <span
                            className={`rounded-md px-1.5 py-0.5 font-medium ${
                              item.aiSuggestedAction === "DELETE"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            AI: {item.aiSuggestedAction}
                          </span>
                        )}
                        {item.aiRiskScore != null && (
                          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-gray-600">
                            Risk: {item.aiRiskScore}
                          </span>
                        )}
                        {item.aiLegalReference && (
                          <span className="rounded-md bg-purple-100 px-1.5 py-0.5 text-purple-700">
                            {item.aiLegalReference}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() => submitDecision(item.id, "APPROVE_DELETE")}
                        disabled={decidingId === item.id}
                        className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        Approve Delete
                      </button>
                      <button
                        onClick={() => submitDecision(item.id, "REJECT_DELETE")}
                        disabled={decidingId === item.id}
                        className="rounded-lg bg-gray-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => submitDecision(item.id, "NEEDS_LEGAL")}
                        disabled={decidingId === item.id}
                        className="rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                      >
                        Needs Legal
                      </button>
                    </div>
                  </div>
                ))}
                {pendingItems.length > 10 && (
                  <p className="text-xs text-gray-500">
                    Showing 10 of {pendingItems.length} pending items.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Filter + Sort Row ──────────────────────────────────────────── */}
      {systems.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search systems\u2026"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
              />
            </div>

            {/* Criticality dropdown */}
            <select
              value={filters.criticality}
              onChange={(e) => setFilters((f) => ({ ...f, criticality: e.target.value }))}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
            >
              {criticalityOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "ALL" ? "All Criticality" : opt}
                </option>
              ))}
            </select>

            {/* System Type dropdown */}
            <select
              value={filters.systemType}
              onChange={(e) => setFilters((f) => ({ ...f, systemType: e.target.value }))}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
            >
              {systemTypeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "ALL" ? "All Types" : opt}
                </option>
              ))}
            </select>

            {/* Special Categories toggle */}
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors has-[:checked]:border-red-300 has-[:checked]:bg-red-50 has-[:checked]:text-red-700">
              <input
                type="checkbox"
                checked={filters.onlySpecialCategories}
                onChange={(e) => setFilters((f) => ({ ...f, onlySpecialCategories: e.target.checked }))}
                className="h-3.5 w-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              Art. 9
            </label>

            {/* High Risk toggle */}
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors has-[:checked]:border-red-300 has-[:checked]:bg-red-50 has-[:checked]:text-red-700">
              <input
                type="checkbox"
                checked={filters.onlyHighRisk}
                onChange={(e) => setFilters((f) => ({ ...f, onlyHighRisk: e.target.checked }))}
                className="h-3.5 w-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              High Risk
            </label>

            {/* Sort dropdown */}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as HeatmapSortKey)}
              className="ml-auto rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <IconX className="h-3 w-3" />
                Clear ({activeFilterCount})
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── System Cards Grid ──────────────────────────────────────────── */}
      {systems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <IconDatabase className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            No systems with findings yet. Run a Discovery Copilot scan to
            populate heatmap data.
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Systems ({filteredSystems.length}
              {filteredSystems.length !== systems.length && ` of ${systems.length}`})
            </h2>
          </div>

          {filteredSystems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white py-10 text-center">
              <p className="text-sm text-gray-500">
                No systems match the current filters.
              </p>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="mt-2 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredSystems.map((sys) => (
                <SystemCard
                  key={sys.systemId}
                  system={sys}
                  onClick={() => setSelectedSystem(sys)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Heatmap Grid Table (collapsible) ───────────────────────────── */}
      {systems.length > 0 && (() => {
        const allCategories = Array.from(
          new Set(systems.flatMap((s) => Object.keys(s.categoryBreakdown)))
        ).sort();

        if (allCategories.length === 0) return null;

        return (
          <div className="rounded-xl border border-gray-200 bg-white">
            <button
              onClick={() => setGridOpen((o) => !o)}
              className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors rounded-xl"
            >
              <span className="text-sm font-semibold text-gray-700">
                Systems &times; Data Categories Grid
              </span>
              <IconChevron
                className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${gridOpen ? "rotate-180" : ""}`}
              />
            </button>

            {gridOpen && (
              <div className="border-t border-gray-100 overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5 text-left font-bold text-gray-700">
                        System
                      </th>
                      {allCategories.map((cat) => (
                        <th key={cat} className="px-2 py-2.5 text-center font-medium text-gray-600 whitespace-nowrap">
                          {CATEGORY_LABELS[cat] ?? cat}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-center font-bold text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSystems.map((sys) => (
                      <tr key={sys.systemId} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                          <button
                            onClick={() => setSelectedSystem(sys)}
                            className="text-left hover:underline hover:text-brand-600 transition-colors"
                          >
                            {sys.systemName}
                          </button>
                        </td>
                        {allCategories.map((cat) => {
                          const cell = sys.categoryBreakdown[cat];
                          if (!cell || cell.total === 0) {
                            return (
                              <td key={cat} className="px-2 py-2 text-center text-gray-300">
                                &mdash;
                              </td>
                            );
                          }
                          const redRatio = cell.red / cell.total;
                          const yellowRatio = cell.yellow / cell.total;
                          const bg =
                            redRatio >= 0.5
                              ? "bg-red-100 text-red-800"
                              : redRatio > 0 || yellowRatio >= 0.5
                                ? "bg-yellow-50 text-yellow-800"
                                : "bg-green-50 text-green-800";
                          return (
                            <td key={cat} className={`px-2 py-2 text-center font-medium ${bg}`}>
                              {cell.total}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-bold text-gray-900">
                          {sys.counts.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
