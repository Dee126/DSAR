/**
 * Color mappings for incident-related status badges.
 */

export const SEVERITY_COLORS: Record<string, string> = {
  LOW: "bg-blue-100 text-blue-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export const INCIDENT_STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  CONTAINED: "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-green-100 text-green-700",
};

export const EXPORT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  GENERATING: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

export const REGULATOR_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  INQUIRY: "bg-yellow-100 text-yellow-700",
  CLOSED: "bg-green-100 text-green-700",
};

export const TIMELINE_EVENT_COLORS: Record<string, string> = {
  DETECTED: "bg-red-500",
  TRIAGED: "bg-orange-500",
  CONTAINED: "bg-yellow-500",
  NOTIFIED_AUTHORITY: "bg-blue-500",
  NOTIFIED_SUBJECTS: "bg-indigo-500",
  REMEDIATION: "bg-purple-500",
  CLOSED: "bg-green-500",
  OTHER: "bg-gray-500",
};

export const DSAR_STATUS_COLORS: Record<string, string> = {
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
