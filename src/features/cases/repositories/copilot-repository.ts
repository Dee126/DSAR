/**
 * Copilot run data access layer for case detail.
 */

import type { CopilotRunSummary, CopilotRunDetail } from "../types";

export async function fetchCopilotRuns(caseId: string): Promise<CopilotRunSummary[]> {
  const res = await fetch(`/api/cases/${caseId}/copilot`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchCopilotRunDetail(
  caseId: string,
  runId: string
): Promise<CopilotRunDetail | null> {
  const res = await fetch(`/api/cases/${caseId}/copilot/${runId}`);
  if (!res.ok) return null;
  return res.json();
}

export async function startCopilotRun(
  caseId: string,
  payload: {
    justification: string;
    providerSelection: string[];
    autoStart?: boolean;
    contentScanRequested?: boolean;
    ocrRequested?: boolean;
    llmRequested?: boolean;
  }
): Promise<void> {
  const res = await fetch(`/api/cases/${caseId}/copilot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, autoStart: payload.autoStart ?? true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to start run." }));
    throw new Error(err.error ?? "Failed to start run.");
  }
}

export async function generateSummary(
  caseId: string,
  runId: string,
  summaryType: string
): Promise<void> {
  const res = await fetch(`/api/cases/${caseId}/copilot/${runId}/summaries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ summaryType }),
  });
  if (!res.ok) throw new Error("Failed to generate summary");
}

export async function updateLegalApproval(
  caseId: string,
  runId: string,
  status: "APPROVED" | "REJECTED"
): Promise<void> {
  const res = await fetch(`/api/cases/${caseId}/copilot/${runId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ legalApprovalStatus: status }),
  });
  if (!res.ok) throw new Error("Failed to update legal approval");
}

export async function exportCopilotEvidence(
  caseId: string,
  runId: string
): Promise<void> {
  const res = await fetch(`/api/cases/${caseId}/copilot/${runId}/export`);
  if (res.status === 403) {
    throw new Error("Export blocked: Legal approval is required before exporting special category data.");
  }
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `copilot-run-${runId}-evidence.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function fetchIntegrations(): Promise<Array<{ id: string; name: string; provider: string }>> {
  const res = await fetch("/api/integrations");
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data) ? data : data.data ?? [];
  return list
    .filter((i: { status: string }) => i.status === "ENABLED")
    .map((i: { id: string; name: string; provider: string }) => ({ id: i.id, name: i.name, provider: i.provider }));
}
