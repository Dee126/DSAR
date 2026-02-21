"use client";

import { useCallback, useEffect, useState } from "react";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface DecidedBy {
  id: string;
  name: string;
  email: string;
}

interface CaseItem {
  id: string;
  assetType: string;
  title: string;
  location: string | null;
  dataCategory: string | null;
  riskScore: number | null;
  matchScore: number | null;
  matchDetails: { matchedTerms?: string[] } | null;
  decision: "PROPOSED" | "INCLUDED" | "EXCLUDED";
  decisionReason: string | null;
  decidedByUserId: string | null;
  decidedBy: DecidedBy | null;
  decidedAt: string | null;
  createdAt: string;
}

type FilterDecision = "ALL" | "PROPOSED" | "INCLUDED" | "EXCLUDED";

/* ── Helpers ────────────────────────────────────────────────────────────── */

function decisionBadge(decision: string) {
  switch (decision) {
    case "INCLUDED":
      return "bg-green-100 text-green-700 border border-green-200";
    case "EXCLUDED":
      return "bg-red-100 text-red-700 border border-red-200";
    default:
      return "bg-indigo-100 text-indigo-700 border border-indigo-200";
  }
}

function riskBadge(score: number | null) {
  if (score == null) return "bg-gray-100 text-gray-500";
  if (score >= 70) return "bg-red-100 text-red-700";
  if (score >= 40) return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
}

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

/* ── Component ──────────────────────────────────────────────────────────── */

export default function DataAssetsPanel({ caseId }: { caseId: string }) {
  const [items, setItems] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);
  const [proposalResult, setProposalResult] = useState<string | null>(null);
  const [filterDecision, setFilterDecision] = useState<FilterDecision>("ALL");
  const [exporting, setExporting] = useState(false);

  // Decision modal state
  const [actionItem, setActionItem] = useState<CaseItem | null>(null);
  const [actionType, setActionType] = useState<"INCLUDED" | "EXCLUDED">("INCLUDED");
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/proposed-items`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleAutoPropose() {
    setProposing(true);
    setProposalResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/proposed-items`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setProposalResult(
        `Found ${result.proposed} matching items (scanned ${result.findingsScanned} findings, ${result.evidenceScanned} evidence items)`
      );
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProposing(false);
    }
  }

  async function handleDecision() {
    if (!actionItem) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/cases/${caseId}/proposed-items/${actionItem.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: actionType,
            reason: actionReason || undefined,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setActionItem(null);
      setActionReason("");
      await fetchItems();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/evidence-pack`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        "evidence-pack.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  // Batch actions
  async function handleBatchIncludeAll() {
    const proposed = items.filter((i) => i.decision === "PROPOSED");
    for (const item of proposed) {
      await fetch(`/api/cases/${caseId}/proposed-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "INCLUDED" }),
      });
    }
    await fetchItems();
  }

  const filteredItems =
    filterDecision === "ALL"
      ? items
      : items.filter((i) => i.decision === filterDecision);

  const counts = {
    total: items.length,
    proposed: items.filter((i) => i.decision === "PROPOSED").length,
    included: items.filter((i) => i.decision === "INCLUDED").length,
    excluded: items.filter((i) => i.decision === "EXCLUDED").length,
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Data Assets
          </h2>
          <p className="text-xs text-gray-500">
            Auto-matched assets from discovery findings and evidence. Review and
            include/exclude for the DSAR response.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAutoPropose}
            disabled={proposing}
            className="btn-secondary !min-h-[36px] !px-3 !py-1.5 !text-xs"
          >
            {proposing ? "Scanning..." : "Auto-Propose Assets"}
          </button>
          {counts.proposed > 0 && (
            <button
              onClick={handleBatchIncludeAll}
              className="btn-secondary !min-h-[36px] !px-3 !py-1.5 !text-xs"
            >
              Include All Proposed ({counts.proposed})
            </button>
          )}
          {counts.included > 0 && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn-primary !min-h-[36px] !px-3 !py-1.5 !text-xs"
            >
              {exporting ? "Generating..." : "Export Evidence Pack"}
            </button>
          )}
        </div>
      </div>

      {/* Result message */}
      {proposalResult && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-xs text-green-700">
          {proposalResult}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["ALL", `All (${counts.total})`, "bg-gray-100 text-gray-700"],
            ["PROPOSED", `Proposed (${counts.proposed})`, "bg-indigo-100 text-indigo-700"],
            ["INCLUDED", `Included (${counts.included})`, "bg-green-100 text-green-700"],
            ["EXCLUDED", `Excluded (${counts.excluded})`, "bg-red-100 text-red-700"],
          ] as const
        ).map(([key, label, color]) => (
          <button
            key={key}
            onClick={() => setFilterDecision(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
              filterDecision === key
                ? `${color} ring-2 ring-offset-1 ring-brand-400`
                : `${color} opacity-70 hover:opacity-100`
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Items list */}
      {filteredItems.length === 0 ? (
        <div className="card py-10 text-center">
          {items.length === 0 ? (
            <>
              <svg
                className="mx-auto h-10 w-10 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-500">
                No data assets proposed yet. Click &quot;Auto-Propose Assets&quot; to scan for
                matching data.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              No items match the current filter.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              {/* Risk score */}
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${riskBadge(
                  item.riskScore
                )}`}
              >
                {item.riskScore ?? "?"}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {item.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${decisionBadge(
                      item.decision
                    )}`}
                  >
                    {item.decision}
                  </span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
                    {item.assetType}
                  </span>
                  {item.dataCategory && (
                    <span className="text-gray-500">
                      {CATEGORY_LABELS[item.dataCategory] ?? item.dataCategory}
                    </span>
                  )}
                  {item.location && (
                    <span className="truncate text-gray-400" title={item.location}>
                      {item.location}
                    </span>
                  )}
                  {item.matchScore != null && (
                    <span className="text-gray-400">
                      Match: {(item.matchScore * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                {item.matchDetails?.matchedTerms &&
                  item.matchDetails.matchedTerms.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.matchDetails.matchedTerms.map((term, i) => (
                        <span
                          key={i}
                          className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  )}
                {item.decisionReason && (
                  <p className="mt-1 text-[11px] text-gray-500 italic">
                    Reason: {item.decisionReason}
                  </p>
                )}
                {item.decidedBy && (
                  <p className="mt-0.5 text-[10px] text-gray-400">
                    By {item.decidedBy.name}
                    {item.decidedAt &&
                      ` on ${new Date(item.decidedAt).toLocaleDateString()}`}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex shrink-0 gap-1">
                {item.decision !== "INCLUDED" && (
                  <button
                    onClick={() => {
                      setActionItem(item);
                      setActionType("INCLUDED");
                      setActionReason("");
                      setActionError(null);
                    }}
                    className="rounded border border-green-200 bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700 hover:bg-green-100"
                    title="Include in DSAR response"
                  >
                    Include
                  </button>
                )}
                {item.decision !== "EXCLUDED" && (
                  <button
                    onClick={() => {
                      setActionItem(item);
                      setActionType("EXCLUDED");
                      setActionReason("");
                      setActionError(null);
                    }}
                    className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100"
                    title="Exclude from DSAR response"
                  >
                    Exclude
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Decision Modal */}
      {actionItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900">
              {actionType === "INCLUDED" ? "Include" : "Exclude"} Data Asset
            </h3>
            <p className="mt-1 text-xs text-gray-500 truncate">
              {actionItem.title}
            </p>

            {actionError && (
              <p className="mt-2 text-xs text-red-600">{actionError}</p>
            )}

            <div className="mt-4">
              <label className="text-xs font-medium text-gray-600">
                {actionType === "EXCLUDED"
                  ? "Reason for exclusion (required)"
                  : "Note (optional)"}
              </label>
              <textarea
                className="input-field mt-1 !min-h-[80px] resize-y"
                placeholder={
                  actionType === "EXCLUDED"
                    ? "e.g., Legal professional privilege (Art. 15(4)), Third party data, Not relevant to request..."
                    : "Optional note about this inclusion..."
                }
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
              />

              {/* Exemption quick-picks for exclusion */}
              {actionType === "EXCLUDED" && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {[
                    "Legal professional privilege (Art. 15(4))",
                    "Third-party data (would adversely affect rights)",
                    "Trade secret / intellectual property",
                    "Not relevant to this request",
                    "Duplicate of another item",
                  ].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setActionReason(reason)}
                      className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-200"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleDecision}
                disabled={
                  actionLoading ||
                  (actionType === "EXCLUDED" && !actionReason.trim())
                }
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50 ${
                  actionType === "INCLUDED"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {actionLoading
                  ? "Saving..."
                  : `Confirm ${actionType === "INCLUDED" ? "Include" : "Exclude"}`}
              </button>
              <button
                onClick={() => setActionItem(null)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
