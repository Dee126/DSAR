/**
 * Types for Copilot run detail within a case.
 */

import type { CaseUser } from "./case-detail";

export interface CopilotRunSummary {
  id: string; status: string; justification: string; totalFindings: number; totalEvidenceItems: number;
  containsSpecialCategory: boolean; legalApprovalStatus: string; scopeSummary: string | null;
  createdAt: string; completedAt: string | null; createdBy: CaseUser;
  _count: { findings: number; queries: number; evidenceItems: number };
}

export interface CopilotRunDetail {
  id: string; status: string; justification: string; scopeSummary: string | null;
  providerSelection: string[] | null; resultSummary: string | null; errorDetails: string | null;
  totalFindings: number; totalEvidenceItems: number; containsSpecialCategory: boolean;
  legalApprovalStatus: string; legalApprovedByUserId: string | null; legalApprovedAt: string | null;
  createdAt: string; startedAt: string | null; completedAt: string | null;
  createdBy: CaseUser; legalApprovedBy: CaseUser | null;
  queries: CopilotQueryItem[];
  evidenceItems: CopilotEvidenceItem[];
  findings: CopilotFinding[];
  summaries: CopilotSummaryItem[];
  exports: CopilotExportItem[];
}

export interface CopilotQueryItem {
  id: string; provider: string | null; status: string; recordsFound: number | null;
  executionMs: number | null; errorMessage: string | null; queryText: string;
  queryIntent: string; executionMode: string;
  integration: { id: string; name: string; provider: string } | null;
}

export interface CopilotEvidenceItem {
  id: string; provider: string; workload: string | null; itemType: string;
  externalRef: string | null; location: string; title: string;
  createdAtSource: string | null; modifiedAtSource: string | null;
  contentHandling: string; sensitivityScore: number | null;
  detectorResults: { id: string; detectorType: string; containsSpecialCategorySuspected: boolean; detectedCategories: { category: string; confidence: number }[] }[];
}

export interface CopilotFinding {
  id: string; dataCategory: string; severity: string; confidence: number;
  summary: string; evidenceItemIds: string[];
  containsSpecialCategory: boolean; containsThirdPartyDataSuspected: boolean;
  requiresLegalReview: boolean;
}

export interface CopilotSummaryItem {
  id: string; summaryType: string; content: string; disclaimerIncluded: boolean;
  createdAt: string; createdBy: CaseUser;
}

export interface CopilotExportItem {
  id: string; exportType: string; status: string; legalGateStatus: string;
  createdAt: string; createdBy: CaseUser;
}

export type RunTabKey = "overview" | "evidence" | "findings" | "categories" | "summaries" | "export";
