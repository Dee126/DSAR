/**
 * Types for DSAR case detail feature.
 */

export interface CaseUser { id: string; name: string; email: string }
export interface DataSubject { id: string; fullName: string; email: string | null; phone: string | null; address: string | null }
export interface StateTransition { id: string; fromStatus: string; toStatus: string; changedAt: string; reason: string; changedBy: CaseUser }
export interface Task { id: string; title: string; description: string | null; status: string; dueDate: string | null; createdAt: string; assignee: CaseUser | null }
export interface Document { id: string; filename: string; contentType: string; size: number; classification: string; uploadedAt: string; uploadedBy: CaseUser }
export interface Comment { id: string; body: string; createdAt: string; author: CaseUser }
export interface CommunicationLog { id: string; direction: string; channel: string; subject: string | null; body: string; sentAt: string }
export interface DataCollectionItem { id: string; status: string; querySpec: string | null; findingsSummary: string | null; recordsFound: number | null; completedAt: string | null; system: { id: string; name: string; description: string | null; owner: string | null } }
export interface LegalReview { id: string; status: string; issues: string | null; exemptionsApplied: string[] | null; redactions: string | null; notes: string | null; reviewer: CaseUser | null; approvedAt: string | null; createdAt: string }
export interface SystemItem { id: string; name: string }

export interface DSARCaseDetail {
  id: string; caseNumber: string; type: string; status: string; priority: string;
  lawfulBasis: string | null; receivedAt: string; dueDate: string; extendedDueDate: string | null;
  extensionReason: string | null; channel: string | null; requesterType: string | null;
  description: string | null; identityVerified: boolean; tags: string[] | null;
  createdAt: string; updatedAt: string; dataSubject: DataSubject; createdBy: CaseUser;
  assignedTo: CaseUser | null; assignedToUserId: string | null;
  stateTransitions: StateTransition[]; tasks: Task[]; documents: Document[];
  comments: Comment[]; communicationLogs: CommunicationLog[];
  dataCollectionItems: DataCollectionItem[]; legalReviews: LegalReview[];
}

export type TabKey = "overview" | "tasks" | "documents" | "communications" | "data-collection" | "legal-review" | "copilot" | "response" | "timeline" | "deadlines" | "idv" | "incidents" | "vendors" | "data-assets" | "audit-trail";
