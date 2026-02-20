/**
 * Role-based access lists and copilot constants for case detail.
 */

export const MANAGE_ROLES = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO", "CASE_MANAGER"];
export const EXPORT_ROLES = ["CASE_MANAGER", "DPO", "TENANT_ADMIN", "SUPER_ADMIN"];
export const COPILOT_ROLES = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO", "CASE_MANAGER"];
export const COPILOT_VIEW_ROLES = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO", "CASE_MANAGER", "ANALYST", "AUDITOR", "CONTRIBUTOR"];

export const COPILOT_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  QUEUED: "bg-blue-100 text-blue-700",
  RUNNING: "bg-yellow-100 text-yellow-700 animate-pulse",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELED: "bg-gray-100 text-gray-500",
};

export const SEVERITY_COLORS: Record<string, string> = {
  INFO: "bg-gray-100 text-gray-600",
  WARNING: "bg-yellow-100 text-yellow-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export const CATEGORY_COLORS: Record<string, string> = {
  IDENTIFICATION: "bg-blue-50 text-blue-700",
  CONTACT: "bg-green-50 text-green-700",
  CONTRACT: "bg-purple-50 text-purple-700",
  PAYMENT: "bg-yellow-50 text-yellow-700",
  COMMUNICATION: "bg-indigo-50 text-indigo-700",
  HR: "bg-pink-50 text-pink-700",
  CREDITWORTHINESS: "bg-orange-50 text-orange-700",
  ONLINE_TECHNICAL: "bg-gray-50 text-gray-700",
  HEALTH: "bg-red-100 text-red-800",
  RELIGION: "bg-red-100 text-red-800",
  UNION: "bg-red-100 text-red-800",
  POLITICAL_OPINION: "bg-red-100 text-red-800",
  OTHER_SPECIAL_CATEGORY: "bg-red-100 text-red-800",
  OTHER: "bg-gray-100 text-gray-600",
};

export const SPECIAL_CATEGORIES = ["HEALTH", "RELIGION", "UNION", "POLITICAL_OPINION", "OTHER_SPECIAL_CATEGORY"];

export const SUMMARY_TYPES = [
  { key: "LOCATION_OVERVIEW", label: "Location Overview" },
  { key: "CATEGORY_OVERVIEW", label: "Category Overview" },
  { key: "DSAR_DRAFT", label: "DSAR Draft" },
  { key: "RISK_SUMMARY", label: "Risk Summary" },
];

export const EVIDENCE_PAGE_SIZE = 20;
