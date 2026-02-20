/**
 * Status labels, colors, and transition rules for DSAR cases.
 */

export const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  IDENTITY_VERIFICATION: "Identity Verification",
  INTAKE_TRIAGE: "Intake & Triage",
  DATA_COLLECTION: "Data Collection",
  REVIEW_LEGAL: "Legal Review",
  RESPONSE_PREPARATION: "Response Preparation",
  RESPONSE_SENT: "Response Sent",
  CLOSED: "Closed",
  REJECTED: "Rejected",
};

export const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  IDENTITY_VERIFICATION: "bg-yellow-100 text-yellow-800",
  INTAKE_TRIAGE: "bg-orange-100 text-orange-800",
  DATA_COLLECTION: "bg-purple-100 text-purple-800",
  REVIEW_LEGAL: "bg-indigo-100 text-indigo-800",
  RESPONSE_PREPARATION: "bg-cyan-100 text-cyan-800",
  RESPONSE_SENT: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
  REJECTED: "bg-red-100 text-red-800",
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  BLOCKED: "bg-red-100 text-red-700",
  DONE: "bg-green-100 text-green-700",
};

export const DC_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  NOT_APPLICABLE: "bg-gray-100 text-gray-500",
};

export const LR_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  IN_REVIEW: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CHANGES_REQUESTED: "bg-orange-100 text-orange-700",
};

export const TASK_STATUSES = ["OPEN", "IN_PROGRESS", "BLOCKED", "DONE"];
export const DC_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "NOT_APPLICABLE"];
export const LR_STATUSES = ["PENDING", "IN_REVIEW", "APPROVED", "REJECTED", "CHANGES_REQUESTED"];
export const DOC_CLASSIFICATIONS = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"];

export const TRANSITION_MAP: Record<string, string[]> = {
  NEW: ["IDENTITY_VERIFICATION", "INTAKE_TRIAGE", "REJECTED"],
  IDENTITY_VERIFICATION: ["INTAKE_TRIAGE", "REJECTED"],
  INTAKE_TRIAGE: ["DATA_COLLECTION", "REJECTED"],
  DATA_COLLECTION: ["REVIEW_LEGAL"],
  REVIEW_LEGAL: ["RESPONSE_PREPARATION", "DATA_COLLECTION"],
  RESPONSE_PREPARATION: ["RESPONSE_SENT"],
  RESPONSE_SENT: ["CLOSED"],
  REJECTED: ["CLOSED"],
  CLOSED: [],
};
