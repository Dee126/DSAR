import { CaseStatus } from "@prisma/client";

export function generateCaseNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `DSAR-${year}-${rand}`;
}

export function calculateDueDate(receivedAt: Date, slaDays: number): Date {
  const due = new Date(receivedAt);
  due.setDate(due.getDate() + slaDays);
  return due;
}

export type SlaIndicator = "ok" | "due_soon" | "overdue";

export function getSlaIndicator(dueDate: Date): SlaIndicator {
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "due_soon";
  return "ok";
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function isTerminalStatus(status: CaseStatus): boolean {
  return status === "CLOSED" || status === "REJECTED";
}
