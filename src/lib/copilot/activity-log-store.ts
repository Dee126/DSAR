import type { GovernanceReportEntry } from "@/lib/copilot/governance-report";

/**
 * In-memory activity log store.
 * In production this would be backed by CopilotRun + AuditLog tables via Prisma.
 */
const activityLogStore: GovernanceReportEntry[] = [];

export function addActivityLogEntry(entry: GovernanceReportEntry): void {
  activityLogStore.push(entry);
}

export function getActivityLogEntries(): GovernanceReportEntry[] {
  return [...activityLogStore];
}
