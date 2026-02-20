/**
 * Case detail data access layer.
 * All fetch calls for the case detail page are centralized here.
 */

import type { DSARCaseDetail, CaseUser, SystemItem } from "../types";

async function handleResponse<T>(res: Response, errorMsg: string): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `${errorMsg} (${res.status})`);
  }
  return res.json();
}

export async function fetchCase(caseId: string): Promise<DSARCaseDetail | null> {
  const res = await fetch(`/api/cases/${caseId}`);
  if (res.status === 404) return null;
  return handleResponse<DSARCaseDetail>(res, "Failed to load case");
}

export async function patchCase(
  caseId: string,
  payload: { description?: string; lawfulBasis?: string; priority?: string; assignedToUserId?: string | null }
): Promise<void> {
  const res = await fetch(`/api/cases/${caseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await handleResponse(res, "Failed to update case");
}

export async function createTransition(
  caseId: string,
  toStatus: string,
  reason: string
): Promise<void> {
  const res = await fetch(`/api/cases/${caseId}/transitions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toStatus, reason }),
  });
  await handleResponse(res, "Failed to transition case");
}

export async function fetchUsers(): Promise<CaseUser[]> {
  const res = await fetch("/api/users");
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j) ? j : j.data ?? [];
}

export async function fetchSystems(): Promise<SystemItem[]> {
  const res = await fetch("/api/systems");
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j) ? j : j.data ?? [];
}

export async function createTask(
  caseId: string,
  payload: { title: string; description?: string; assigneeUserId?: string; dueDate?: string }
): Promise<void> {
  const res = await fetch(`/api/cases/${caseId}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await handleResponse(res, "Failed to add task");
}

export async function updateTaskStatus(taskId: string, status: string): Promise<void> {
  await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function uploadDocument(caseId: string, file: File, classification: string): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("classification", classification);
  const res = await fetch(`/api/cases/${caseId}/documents`, { method: "POST", body: formData });
  await handleResponse(res, "Failed to upload document");
}

export async function createComment(caseId: string, body: string): Promise<void> {
  const res = await fetch(`/api/cases/${caseId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  await handleResponse(res, "Failed to add comment");
}

export async function createCommunication(
  caseId: string,
  payload: { direction: string; channel: string; subject?: string; body: string }
): Promise<void> {
  const res = await fetch(`/api/cases/${caseId}/communications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await handleResponse(res, "Failed to add communication");
}

export async function createDataCollection(
  caseId: string,
  payload: { systemId: string; querySpec?: string }
): Promise<void> {
  const res = await fetch(`/api/cases/${caseId}/data-collection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await handleResponse(res, "Failed to add data collection item");
}

export async function updateDataCollectionStatus(
  caseId: string,
  itemId: string,
  status: string
): Promise<void> {
  await fetch(`/api/cases/${caseId}/data-collection`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, status }),
  });
}

export async function createLegalReview(
  caseId: string,
  payload: { issues?: string; notes?: string }
): Promise<void> {
  const res = await fetch(`/api/cases/${caseId}/legal-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await handleResponse(res, "Failed to create legal review");
}

export async function updateLegalReviewStatus(
  caseId: string,
  reviewId: string,
  status: string
): Promise<void> {
  await fetch(`/api/cases/${caseId}/legal-review`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewId, status }),
  });
}

export async function exportCase(caseId: string, caseNumber: string): Promise<void> {
  const res = await fetch(`/api/cases/${caseId}/export`);
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${caseNumber}-export.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
