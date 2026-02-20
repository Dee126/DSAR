/**
 * Client-side API service for incident operations.
 * All fetch calls for the incident detail page are centralized here.
 */

import type { Incident, SystemOption, DSARCaseOption } from "../types";

async function handleResponse<T>(res: Response, errorMsg: string): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `${errorMsg} (${res.status})`);
  }
  return res.json();
}

export async function fetchIncident(incidentId: string): Promise<Incident> {
  const res = await fetch(`/api/incidents/${incidentId}`);
  return handleResponse<Incident>(res, "Failed to load incident");
}

export async function fetchSystems(): Promise<SystemOption[]> {
  const res = await fetch("/api/systems");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.systems ?? [];
}

export async function updateIncident(
  incidentId: string,
  payload: { title: string; description: string | null; severity: string; status: string }
): Promise<void> {
  const res = await fetch(`/api/incidents/${incidentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await handleResponse(res, "Failed to update incident");
}

export async function postIncidentAction(
  incidentId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`/api/incidents/${incidentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await handleResponse(res, `Failed to perform action: ${payload.action}`);
}

export async function searchDsarCases(search: string): Promise<DSARCaseOption[]> {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await fetch(`/api/cases${q}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.cases ?? [];
}

export async function linkDsarToIncident(
  caseId: string,
  incidentId: string,
  linkReason: string | null
): Promise<void> {
  const res = await fetch(`/api/cases/${caseId}/incidents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ incidentId, linkReason }),
  });
  await handleResponse(res, "Failed to link DSAR");
}

export async function unlinkDsarFromIncident(
  caseId: string,
  incidentId: string
): Promise<void> {
  const res = await fetch(
    `/api/cases/${caseId}/incidents?incidentId=${incidentId}`,
    { method: "DELETE" }
  );
  await handleResponse(res, "Failed to unlink DSAR");
}

export async function createSurgeGroup(
  incidentId: string,
  name: string,
  caseIds: string[]
): Promise<void> {
  const res = await fetch(`/api/incidents/${incidentId}/surge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", name, caseIds }),
  });
  await handleResponse(res, "Failed to create surge group");
}

export async function generateExport(
  incidentId: string,
  options: {
    includeTimeline: boolean;
    includeDsarList: boolean;
    includeEvidence: boolean;
    includeResponses: boolean;
  }
): Promise<void> {
  const res = await fetch(`/api/incidents/${incidentId}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  await handleResponse(res, "Failed to generate export");
}

export function getExportDownloadUrl(incidentId: string, exportRunId: string): string {
  return `/api/incidents/${incidentId}/export?exportRunId=${exportRunId}&download=pdf`;
}
