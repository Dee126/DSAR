import type { RateLimitState } from "@/lib/copilot/governance";

// ---------------------------------------------------------------------------
// In-memory run store (production: CopilotRun table via Prisma)
// ---------------------------------------------------------------------------

export interface CopilotRunRecord {
  id: string;
  caseId: string;
  tenantId: string;
  userId: string;
  userRole: string;
  userName: string;
  justification: string;
  status: "CREATED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  contentScanRequested: boolean;
  ocrRequested: boolean;
  llmRequested: boolean;
  totalFindings: number;
  containsSpecialCategory: boolean;
  legalApprovalStatus: string;
  createdAt: string;
  completedAt: string | null;
  errorDetails: string | null;
}

export const runStore: CopilotRunRecord[] = [];

// In-memory rate limit tracking
const rateLimitTracker = {
  tenantRunsToday: new Map<string, number>(),
  userRunsToday: new Map<string, number>(),
  concurrentRuns: new Map<string, number>(),
};

export function getRunStore(): CopilotRunRecord[] {
  return runStore;
}

export function getRateLimitState(tenantId: string, userId: string): RateLimitState {
  return {
    tenantRunsToday: rateLimitTracker.tenantRunsToday.get(tenantId) ?? 0,
    userRunsToday: rateLimitTracker.userRunsToday.get(userId) ?? 0,
    concurrentRuns: rateLimitTracker.concurrentRuns.get(tenantId) ?? 0,
  };
}

export function incrementRateLimits(tenantId: string, userId: string): void {
  rateLimitTracker.tenantRunsToday.set(
    tenantId,
    (rateLimitTracker.tenantRunsToday.get(tenantId) ?? 0) + 1,
  );
  rateLimitTracker.userRunsToday.set(
    userId,
    (rateLimitTracker.userRunsToday.get(userId) ?? 0) + 1,
  );
  rateLimitTracker.concurrentRuns.set(
    tenantId,
    (rateLimitTracker.concurrentRuns.get(tenantId) ?? 0) + 1,
  );
}

export function decrementConcurrent(tenantId: string): void {
  const current = rateLimitTracker.concurrentRuns.get(tenantId) ?? 0;
  rateLimitTracker.concurrentRuns.set(tenantId, Math.max(0, current - 1));
}
