/**
 * Case business logic — SLA calculations, transition rules, role checks.
 * No data access here; call repositories for that.
 */

import { TRANSITION_MAP, MANAGE_ROLES, EXPORT_ROLES, COPILOT_ROLES } from "../constants";

export type SlaIndicator = "ok" | "due_soon" | "overdue";

export function getSlaIndicator(dueDate: string): SlaIndicator {
  const diff = (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "overdue";
  if (diff <= 7) return "due_soon";
  return "ok";
}

export function getAllowedTransitions(status: string): string[] {
  return TRANSITION_MAP[status] ?? [];
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function canManageCase(role: string): boolean {
  return MANAGE_ROLES.includes(role);
}

export function canExportCase(role: string): boolean {
  return EXPORT_ROLES.includes(role);
}

export function canUseCopilot(role: string): boolean {
  return COPILOT_ROLES.includes(role);
}

export function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}
