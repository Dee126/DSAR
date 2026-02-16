import { UserRole } from "@prisma/client";
import { ApiError } from "./errors";

// ─── Fine-Grained Permission System ────────────────────────────────────────
//
// Domains:  A) Governance  B) Copilot Runs  C) Advanced Capabilities
//           D) Approvals   E) Exports       F) Integrations
//           G) Documents   H) Admin         I) Legacy CRUD
//
// Every API route MUST enforce server-side. UI may hide controls but the
// backend is the single source of truth.
// ────────────────────────────────────────────────────────────────────────────

export type Permission =
  // A) Governance
  | "GOVERNANCE_VIEW"
  | "GOVERNANCE_EDIT_SETTINGS"
  | "GOVERNANCE_EXPORT_REPORT"
  // B) Copilot Runs
  | "COPILOT_RUN_CREATE"
  | "COPILOT_RUN_EXECUTE"
  | "COPILOT_RUN_VIEW"
  | "COPILOT_RUN_CANCEL"
  // C) Copilot Advanced Capabilities
  | "COPILOT_ALLOW_CONTENT_SCAN"
  | "COPILOT_ALLOW_OCR"
  | "COPILOT_ALLOW_LLM_SUMMARIES"
  // D) Approvals / Legal Gate
  | "COPILOT_LEGAL_APPROVE"
  | "EXPORT_APPROVE_STEP1"
  | "EXPORT_APPROVE_STEP2"
  // E) Exports
  | "EXPORT_REQUEST"
  | "EXPORT_GENERATE"
  | "EXPORT_DOWNLOAD"
  // F) Integrations
  | "INTEGRATIONS_VIEW"
  | "INTEGRATIONS_CONFIGURE"
  | "INTEGRATIONS_TEST_CONNECTION"
  | "INTEGRATIONS_DISABLE_ENABLE"
  // G) Documents
  | "DOCUMENT_UPLOAD"
  | "DOCUMENT_DOWNLOAD"
  | "DOCUMENT_DELETE"
  // H) Admin
  | "USER_MANAGEMENT"
  | "ROLE_MANAGEMENT"
  | "TENANT_SETTINGS_EDIT"
  // I) Case & Core CRUD
  | "CASES_CREATE"
  | "CASES_READ"
  | "CASES_UPDATE"
  | "CASES_DELETE"
  | "TASKS_CREATE"
  | "TASKS_READ"
  | "TASKS_UPDATE"
  | "COMMENTS_CREATE"
  | "COMMENTS_READ"
  | "SYSTEMS_CREATE"
  | "SYSTEMS_READ"
  | "SYSTEMS_UPDATE"
  | "SYSTEMS_DELETE"
  | "AUDIT_LOGS_READ"
  | "LEGAL_HOLD_MANAGE"
  | "REDACTION_REVIEW"
  // J) Case Team
  | "CASE_TEAM_MANAGE"
  // K) Data Inventory
  | "DATA_INVENTORY_VIEW"
  | "DATA_INVENTORY_MANAGE"
  | "DISCOVERY_RULES_VIEW"
  | "DISCOVERY_RULES_MANAGE"
  // L) Deadline & Risk
  | "DEADLINES_VIEW"
  | "DEADLINES_EXTEND"
  | "DEADLINES_PAUSE"
  | "ESCALATIONS_VIEW"
  | "SLA_CONFIG_VIEW"
  | "SLA_CONFIG_EDIT"
  | "NOTIFICATIONS_VIEW"
  // M) Identity Verification
  | "IDV_VIEW"
  | "IDV_MANAGE"
  | "IDV_DECIDE"
  | "IDV_VIEW_ARTIFACTS"
  | "IDV_SETTINGS_VIEW"
  | "IDV_SETTINGS_EDIT"
  // N) Response Generator
  | "RESPONSE_VIEW"
  | "RESPONSE_GENERATE"
  | "RESPONSE_EDIT"
  | "RESPONSE_SUBMIT_REVIEW"
  | "RESPONSE_APPROVE"
  | "RESPONSE_SEND"
  | "RESPONSE_TEMPLATE_VIEW"
  | "RESPONSE_TEMPLATE_MANAGE"
  // O) Incidents & Authority Linkage
  | "INCIDENT_VIEW"
  | "INCIDENT_CREATE"
  | "INCIDENT_UPDATE"
  | "INCIDENT_DELETE"
  | "INCIDENT_LINK_DSAR"
  | "INCIDENT_ASSESSMENT"
  | "INCIDENT_AUTHORITY_EXPORT"
  | "INCIDENT_SURGE_MANAGE"
  // P) Vendor / Processor Tracking
  | "VENDOR_VIEW"
  | "VENDOR_MANAGE"
  | "VENDOR_REQUEST_CREATE"
  | "VENDOR_REQUEST_SEND"
  | "VENDOR_REQUEST_VIEW"
  | "VENDOR_RESPONSE_LOG"
  | "VENDOR_TEMPLATE_VIEW"
  | "VENDOR_TEMPLATE_MANAGE"
  | "VENDOR_ESCALATION_VIEW"
  | "VENDOR_ESCALATION_MANAGE"
  // Q) Executive KPI & Board Reporting
  | "EXEC_DASHBOARD_VIEW"
  | "EXEC_DASHBOARD_FULL"
  | "EXEC_FINANCIAL_VIEW"
  | "EXEC_REPORT_GENERATE"
  | "EXEC_REPORT_EXPORT"
  | "EXEC_KPI_CONFIG"
  | "EXEC_FORECAST_VIEW";

// ─── Role → Permission Matrix ──────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, Set<Permission>> = {
  SUPER_ADMIN: new Set<Permission>([
    // All permissions
    "GOVERNANCE_VIEW", "GOVERNANCE_EDIT_SETTINGS", "GOVERNANCE_EXPORT_REPORT",
    "COPILOT_RUN_CREATE", "COPILOT_RUN_EXECUTE", "COPILOT_RUN_VIEW", "COPILOT_RUN_CANCEL",
    "COPILOT_ALLOW_CONTENT_SCAN", "COPILOT_ALLOW_OCR", "COPILOT_ALLOW_LLM_SUMMARIES",
    "COPILOT_LEGAL_APPROVE", "EXPORT_APPROVE_STEP1", "EXPORT_APPROVE_STEP2",
    "EXPORT_REQUEST", "EXPORT_GENERATE", "EXPORT_DOWNLOAD",
    "INTEGRATIONS_VIEW", "INTEGRATIONS_CONFIGURE", "INTEGRATIONS_TEST_CONNECTION", "INTEGRATIONS_DISABLE_ENABLE",
    "DOCUMENT_UPLOAD", "DOCUMENT_DOWNLOAD", "DOCUMENT_DELETE",
    "USER_MANAGEMENT", "ROLE_MANAGEMENT", "TENANT_SETTINGS_EDIT",
    "CASES_CREATE", "CASES_READ", "CASES_UPDATE", "CASES_DELETE",
    "TASKS_CREATE", "TASKS_READ", "TASKS_UPDATE",
    "COMMENTS_CREATE", "COMMENTS_READ",
    "SYSTEMS_CREATE", "SYSTEMS_READ", "SYSTEMS_UPDATE", "SYSTEMS_DELETE",
    "AUDIT_LOGS_READ", "LEGAL_HOLD_MANAGE", "REDACTION_REVIEW",
    "CASE_TEAM_MANAGE",
    "DATA_INVENTORY_VIEW", "DATA_INVENTORY_MANAGE", "DISCOVERY_RULES_VIEW", "DISCOVERY_RULES_MANAGE",
    "DEADLINES_VIEW", "DEADLINES_EXTEND", "DEADLINES_PAUSE", "ESCALATIONS_VIEW",
    "SLA_CONFIG_VIEW", "SLA_CONFIG_EDIT", "NOTIFICATIONS_VIEW",
    "IDV_VIEW", "IDV_MANAGE", "IDV_DECIDE", "IDV_VIEW_ARTIFACTS", "IDV_SETTINGS_VIEW", "IDV_SETTINGS_EDIT",
    "RESPONSE_VIEW", "RESPONSE_GENERATE", "RESPONSE_EDIT", "RESPONSE_SUBMIT_REVIEW", "RESPONSE_APPROVE", "RESPONSE_SEND",
    "RESPONSE_TEMPLATE_VIEW", "RESPONSE_TEMPLATE_MANAGE",
    "INCIDENT_VIEW", "INCIDENT_CREATE", "INCIDENT_UPDATE", "INCIDENT_DELETE",
    "INCIDENT_LINK_DSAR", "INCIDENT_ASSESSMENT", "INCIDENT_AUTHORITY_EXPORT", "INCIDENT_SURGE_MANAGE",
    "VENDOR_VIEW", "VENDOR_MANAGE", "VENDOR_REQUEST_CREATE", "VENDOR_REQUEST_SEND", "VENDOR_REQUEST_VIEW",
    "VENDOR_RESPONSE_LOG", "VENDOR_TEMPLATE_VIEW", "VENDOR_TEMPLATE_MANAGE",
    "VENDOR_ESCALATION_VIEW", "VENDOR_ESCALATION_MANAGE",
    "EXEC_DASHBOARD_VIEW", "EXEC_DASHBOARD_FULL", "EXEC_FINANCIAL_VIEW",
    "EXEC_REPORT_GENERATE", "EXEC_REPORT_EXPORT", "EXEC_KPI_CONFIG", "EXEC_FORECAST_VIEW",
  ]),

  TENANT_ADMIN: new Set<Permission>([
    // All permissions (within tenant)
    "GOVERNANCE_VIEW", "GOVERNANCE_EDIT_SETTINGS", "GOVERNANCE_EXPORT_REPORT",
    "COPILOT_RUN_CREATE", "COPILOT_RUN_EXECUTE", "COPILOT_RUN_VIEW", "COPILOT_RUN_CANCEL",
    "COPILOT_ALLOW_CONTENT_SCAN", "COPILOT_ALLOW_OCR", "COPILOT_ALLOW_LLM_SUMMARIES",
    "COPILOT_LEGAL_APPROVE", "EXPORT_APPROVE_STEP1", "EXPORT_APPROVE_STEP2",
    "EXPORT_REQUEST", "EXPORT_GENERATE", "EXPORT_DOWNLOAD",
    "INTEGRATIONS_VIEW", "INTEGRATIONS_CONFIGURE", "INTEGRATIONS_TEST_CONNECTION", "INTEGRATIONS_DISABLE_ENABLE",
    "DOCUMENT_UPLOAD", "DOCUMENT_DOWNLOAD", "DOCUMENT_DELETE",
    "USER_MANAGEMENT", "ROLE_MANAGEMENT", "TENANT_SETTINGS_EDIT",
    "CASES_CREATE", "CASES_READ", "CASES_UPDATE", "CASES_DELETE",
    "TASKS_CREATE", "TASKS_READ", "TASKS_UPDATE",
    "COMMENTS_CREATE", "COMMENTS_READ",
    "SYSTEMS_CREATE", "SYSTEMS_READ", "SYSTEMS_UPDATE", "SYSTEMS_DELETE",
    "AUDIT_LOGS_READ", "LEGAL_HOLD_MANAGE", "REDACTION_REVIEW",
    "CASE_TEAM_MANAGE",
    "DATA_INVENTORY_VIEW", "DATA_INVENTORY_MANAGE", "DISCOVERY_RULES_VIEW", "DISCOVERY_RULES_MANAGE",
    "DEADLINES_VIEW", "DEADLINES_EXTEND", "DEADLINES_PAUSE", "ESCALATIONS_VIEW",
    "SLA_CONFIG_VIEW", "SLA_CONFIG_EDIT", "NOTIFICATIONS_VIEW",
    "IDV_VIEW", "IDV_MANAGE", "IDV_DECIDE", "IDV_VIEW_ARTIFACTS", "IDV_SETTINGS_VIEW", "IDV_SETTINGS_EDIT",
    "RESPONSE_VIEW", "RESPONSE_GENERATE", "RESPONSE_EDIT", "RESPONSE_SUBMIT_REVIEW", "RESPONSE_APPROVE", "RESPONSE_SEND",
    "RESPONSE_TEMPLATE_VIEW", "RESPONSE_TEMPLATE_MANAGE",
    "INCIDENT_VIEW", "INCIDENT_CREATE", "INCIDENT_UPDATE", "INCIDENT_DELETE",
    "INCIDENT_LINK_DSAR", "INCIDENT_ASSESSMENT", "INCIDENT_AUTHORITY_EXPORT", "INCIDENT_SURGE_MANAGE",
    "VENDOR_VIEW", "VENDOR_MANAGE", "VENDOR_REQUEST_CREATE", "VENDOR_REQUEST_SEND", "VENDOR_REQUEST_VIEW",
    "VENDOR_RESPONSE_LOG", "VENDOR_TEMPLATE_VIEW", "VENDOR_TEMPLATE_MANAGE",
    "VENDOR_ESCALATION_VIEW", "VENDOR_ESCALATION_MANAGE",
    "EXEC_DASHBOARD_VIEW", "EXEC_DASHBOARD_FULL", "EXEC_FINANCIAL_VIEW",
    "EXEC_REPORT_GENERATE", "EXEC_REPORT_EXPORT", "EXEC_KPI_CONFIG", "EXEC_FORECAST_VIEW",
  ]),

  DPO: new Set<Permission>([
    // Governance: full access
    "GOVERNANCE_VIEW", "GOVERNANCE_EDIT_SETTINGS", "GOVERNANCE_EXPORT_REPORT",
    // Copilot: full access (subject to tenant settings)
    "COPILOT_RUN_CREATE", "COPILOT_RUN_EXECUTE", "COPILOT_RUN_VIEW", "COPILOT_RUN_CANCEL",
    "COPILOT_ALLOW_CONTENT_SCAN", "COPILOT_ALLOW_OCR", "COPILOT_ALLOW_LLM_SUMMARIES",
    // Approvals: legal approve + step2
    "COPILOT_LEGAL_APPROVE", "EXPORT_APPROVE_STEP2",
    // Exports: full access
    "EXPORT_REQUEST", "EXPORT_GENERATE", "EXPORT_DOWNLOAD",
    // Integrations: full access
    "INTEGRATIONS_VIEW", "INTEGRATIONS_CONFIGURE", "INTEGRATIONS_TEST_CONNECTION", "INTEGRATIONS_DISABLE_ENABLE",
    // Documents: full access
    "DOCUMENT_UPLOAD", "DOCUMENT_DOWNLOAD", "DOCUMENT_DELETE",
    // Admin: no user/role/tenant management by default
    // Cases: create, read, update (no delete)
    "CASES_CREATE", "CASES_READ", "CASES_UPDATE",
    "TASKS_CREATE", "TASKS_READ", "TASKS_UPDATE",
    "COMMENTS_CREATE", "COMMENTS_READ",
    "SYSTEMS_READ",
    "AUDIT_LOGS_READ", "LEGAL_HOLD_MANAGE", "REDACTION_REVIEW",
    "CASE_TEAM_MANAGE",
    "DATA_INVENTORY_VIEW", "DATA_INVENTORY_MANAGE", "DISCOVERY_RULES_VIEW", "DISCOVERY_RULES_MANAGE",
    "DEADLINES_VIEW", "DEADLINES_EXTEND", "ESCALATIONS_VIEW",
    "SLA_CONFIG_VIEW", "SLA_CONFIG_EDIT", "NOTIFICATIONS_VIEW",
    "IDV_VIEW", "IDV_MANAGE", "IDV_DECIDE", "IDV_VIEW_ARTIFACTS", "IDV_SETTINGS_VIEW", "IDV_SETTINGS_EDIT",
    "RESPONSE_VIEW", "RESPONSE_GENERATE", "RESPONSE_EDIT", "RESPONSE_SUBMIT_REVIEW", "RESPONSE_APPROVE", "RESPONSE_SEND",
    "RESPONSE_TEMPLATE_VIEW", "RESPONSE_TEMPLATE_MANAGE",
    "INCIDENT_VIEW", "INCIDENT_CREATE", "INCIDENT_UPDATE",
    "INCIDENT_LINK_DSAR", "INCIDENT_ASSESSMENT", "INCIDENT_AUTHORITY_EXPORT", "INCIDENT_SURGE_MANAGE",
    "VENDOR_VIEW", "VENDOR_MANAGE", "VENDOR_REQUEST_CREATE", "VENDOR_REQUEST_SEND", "VENDOR_REQUEST_VIEW",
    "VENDOR_RESPONSE_LOG", "VENDOR_TEMPLATE_VIEW", "VENDOR_TEMPLATE_MANAGE",
    "VENDOR_ESCALATION_VIEW", "VENDOR_ESCALATION_MANAGE",
    "EXEC_DASHBOARD_VIEW", "EXEC_DASHBOARD_FULL", "EXEC_REPORT_GENERATE", "EXEC_FORECAST_VIEW",
  ]),

  CASE_MANAGER: new Set<Permission>([
    // Governance: view only
    "GOVERNANCE_VIEW",
    // Copilot: create, execute, view, cancel (case-scoped)
    "COPILOT_RUN_CREATE", "COPILOT_RUN_EXECUTE", "COPILOT_RUN_VIEW", "COPILOT_RUN_CANCEL",
    // Advanced: no content scan/OCR toggles by default
    // Approvals: step1 only (if two-person enabled)
    "EXPORT_APPROVE_STEP1",
    // Exports: request always, generate if no approval needed, download if approved
    "EXPORT_REQUEST", "EXPORT_DOWNLOAD",
    // Integrations: view only
    "INTEGRATIONS_VIEW",
    // Documents: upload + download (case-scoped)
    "DOCUMENT_UPLOAD", "DOCUMENT_DOWNLOAD",
    // Cases: CRUD (case-scoped)
    "CASES_CREATE", "CASES_READ", "CASES_UPDATE",
    "TASKS_CREATE", "TASKS_READ", "TASKS_UPDATE",
    "COMMENTS_CREATE", "COMMENTS_READ",
    "SYSTEMS_READ",
    // Case team: can manage members for accessible cases
    "CASE_TEAM_MANAGE",
    "DATA_INVENTORY_VIEW", "DATA_INVENTORY_MANAGE", "DISCOVERY_RULES_VIEW", "DISCOVERY_RULES_MANAGE",
    "DEADLINES_VIEW", "DEADLINES_EXTEND", "ESCALATIONS_VIEW",
    "SLA_CONFIG_VIEW", "NOTIFICATIONS_VIEW",
    "IDV_VIEW", "IDV_MANAGE", "IDV_VIEW_ARTIFACTS",
    "RESPONSE_VIEW", "RESPONSE_GENERATE", "RESPONSE_EDIT", "RESPONSE_SUBMIT_REVIEW",
    "RESPONSE_TEMPLATE_VIEW",
    "INCIDENT_VIEW", "INCIDENT_LINK_DSAR",
    "VENDOR_VIEW", "VENDOR_REQUEST_CREATE", "VENDOR_REQUEST_SEND", "VENDOR_REQUEST_VIEW",
    "VENDOR_RESPONSE_LOG", "VENDOR_TEMPLATE_VIEW", "VENDOR_ESCALATION_VIEW",
    "EXEC_DASHBOARD_VIEW",
  ]),

  ANALYST: new Set<Permission>([
    // Governance: no access
    // Copilot: execute + view for assigned cases; create optional (default false)
    "COPILOT_RUN_EXECUTE", "COPILOT_RUN_VIEW",
    // Advanced: none
    // Approvals: none
    // Exports: none
    // Integrations: view only
    "INTEGRATIONS_VIEW",
    // Documents: upload + download for assigned cases
    "DOCUMENT_UPLOAD", "DOCUMENT_DOWNLOAD",
    // Cases: read + update (assigned cases only)
    "CASES_READ", "CASES_UPDATE",
    "TASKS_READ", "TASKS_UPDATE",
    "COMMENTS_CREATE", "COMMENTS_READ",
    "SYSTEMS_READ",
    "DATA_INVENTORY_VIEW",
    "DEADLINES_VIEW", "NOTIFICATIONS_VIEW",
    "IDV_VIEW",
    "RESPONSE_VIEW", "RESPONSE_TEMPLATE_VIEW",
    "INCIDENT_VIEW",
    "VENDOR_VIEW", "VENDOR_REQUEST_VIEW", "VENDOR_TEMPLATE_VIEW", "VENDOR_ESCALATION_VIEW",
    "EXEC_DASHBOARD_VIEW",
  ]),

  AUDITOR: new Set<Permission>([
    // Governance: view only
    "GOVERNANCE_VIEW",
    // Copilot: view only (read-only)
    "COPILOT_RUN_VIEW",
    // Advanced: none
    // Approvals: none
    // Exports: download optional (audit exports only, default false)
    // Integrations: view only
    "INTEGRATIONS_VIEW",
    // Documents: download only (no upload/delete)
    "DOCUMENT_DOWNLOAD",
    // Cases: read only
    "CASES_READ",
    "TASKS_READ",
    "COMMENTS_READ",
    "SYSTEMS_READ",
    "AUDIT_LOGS_READ",
    "DATA_INVENTORY_VIEW", "DISCOVERY_RULES_VIEW",
    "DEADLINES_VIEW", "ESCALATIONS_VIEW", "SLA_CONFIG_VIEW", "NOTIFICATIONS_VIEW",
    "IDV_VIEW", "IDV_VIEW_ARTIFACTS", "IDV_SETTINGS_VIEW",
    "RESPONSE_VIEW", "RESPONSE_TEMPLATE_VIEW",
    "INCIDENT_VIEW",
    "VENDOR_VIEW", "VENDOR_REQUEST_VIEW", "VENDOR_TEMPLATE_VIEW", "VENDOR_ESCALATION_VIEW",
    "EXEC_DASHBOARD_VIEW",
  ]),

  // Legacy roles mapped for backward compatibility
  CONTRIBUTOR: new Set<Permission>([
    // Same as ANALYST
    "COPILOT_RUN_VIEW",
    "INTEGRATIONS_VIEW",
    "DOCUMENT_UPLOAD", "DOCUMENT_DOWNLOAD",
    "CASES_READ",
    "TASKS_READ", "TASKS_UPDATE",
    "COMMENTS_CREATE", "COMMENTS_READ",
    "SYSTEMS_READ",
  ]),

  READ_ONLY: new Set<Permission>([
    "CASES_READ",
    "TASKS_READ",
    "DOCUMENT_DOWNLOAD",
    "COMMENTS_READ",
    "INTEGRATIONS_VIEW",
  ]),
};

// ─── Permission Checking ───────────────────────────────────────────────────

/**
 * Check whether a role has a specific fine-grained permission.
 */
export function has(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.has(permission);
}

/**
 * Enforce a permission, throwing ApiError(403) if denied.
 */
export function enforce(role: string, permission: Permission): void {
  if (!has(role, permission)) {
    throw new ApiError(403, `Forbidden: missing permission ${permission}`);
  }
}

/**
 * Get all permissions for a role.
 */
export function getPermissions(role: string): Permission[] {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return [];
  return Array.from(perms);
}

/**
 * Check if a role has global case access (can see all cases in tenant).
 */
export function hasGlobalCaseAccess(role: string): boolean {
  return role === "SUPER_ADMIN" || role === "TENANT_ADMIN" || role === "DPO";
}

/**
 * Check if a role is read-only (all modifying actions must be blocked).
 */
export function isReadOnly(role: string): boolean {
  return role === "AUDITOR" || role === "READ_ONLY";
}

// ─── Backward-Compatible Legacy API ────────────────────────────────────────
//
// Maps the old Resource/Action model to the new fine-grained permissions.
// Existing API routes that use checkPermission(role, resource, action) will
// continue to work without modification.
// ────────────────────────────────────────────────────────────────────────────

type Resource =
  | "cases" | "tasks" | "documents" | "comments" | "users"
  | "settings" | "audit_logs" | "systems" | "export"
  | "integrations" | "copilot" | "copilot_governance"
  | "legal_hold" | "redaction" | "governance_report"
  | "data_inventory" | "discovery_rules"
  | "response" | "response_templates"
  | "incidents" | "incident_linkage" | "incident_surge" | "authority_export"
  | "vendors" | "vendor_requests" | "vendor_templates" | "vendor_escalations"
  | "exec_dashboard" | "exec_reports" | "exec_kpi_config";

type Action = "create" | "read" | "update" | "delete" | "manage";

const LEGACY_MAP: Record<string, Record<string, Permission[]>> = {
  cases: {
    create: ["CASES_CREATE"],
    read: ["CASES_READ"],
    update: ["CASES_UPDATE"],
    delete: ["CASES_DELETE"],
    manage: ["CASES_CREATE", "CASES_UPDATE", "CASES_DELETE"],
  },
  tasks: {
    create: ["TASKS_CREATE"],
    read: ["TASKS_READ"],
    update: ["TASKS_UPDATE"],
    delete: ["TASKS_UPDATE"],
    manage: ["TASKS_CREATE", "TASKS_UPDATE"],
  },
  documents: {
    create: ["DOCUMENT_UPLOAD"],
    read: ["DOCUMENT_DOWNLOAD"],
    update: ["DOCUMENT_UPLOAD"],
    delete: ["DOCUMENT_DELETE"],
    manage: ["DOCUMENT_UPLOAD", "DOCUMENT_DOWNLOAD", "DOCUMENT_DELETE"],
  },
  comments: {
    create: ["COMMENTS_CREATE"],
    read: ["COMMENTS_READ"],
    update: ["COMMENTS_CREATE"],
    delete: ["COMMENTS_CREATE"],
  },
  users: {
    create: ["USER_MANAGEMENT"],
    read: ["CASES_READ"], // Most roles can read user list
    update: ["USER_MANAGEMENT"],
    delete: ["USER_MANAGEMENT"],
    manage: ["USER_MANAGEMENT", "ROLE_MANAGEMENT"],
  },
  settings: {
    read: ["TENANT_SETTINGS_EDIT"], // Only admins should read settings
    update: ["TENANT_SETTINGS_EDIT"],
    manage: ["TENANT_SETTINGS_EDIT"],
  },
  audit_logs: {
    read: ["AUDIT_LOGS_READ"],
  },
  systems: {
    create: ["SYSTEMS_CREATE"],
    read: ["SYSTEMS_READ"],
    update: ["SYSTEMS_UPDATE"],
    delete: ["SYSTEMS_DELETE"],
  },
  export: {
    read: ["EXPORT_REQUEST"],
  },
  integrations: {
    create: ["INTEGRATIONS_CONFIGURE"],
    read: ["INTEGRATIONS_VIEW"],
    update: ["INTEGRATIONS_CONFIGURE"],
    delete: ["INTEGRATIONS_CONFIGURE"],
    manage: ["INTEGRATIONS_CONFIGURE", "INTEGRATIONS_DISABLE_ENABLE"],
  },
  copilot: {
    create: ["COPILOT_RUN_CREATE"],
    read: ["COPILOT_RUN_VIEW"],
    update: ["COPILOT_RUN_EXECUTE"],
    delete: ["COPILOT_RUN_CANCEL"],
    manage: ["COPILOT_RUN_CREATE", "COPILOT_RUN_EXECUTE", "COPILOT_RUN_CANCEL"],
  },
  copilot_governance: {
    read: ["GOVERNANCE_VIEW"],
    update: ["GOVERNANCE_EDIT_SETTINGS"],
    manage: ["GOVERNANCE_EDIT_SETTINGS"],
  },
  legal_hold: {
    create: ["LEGAL_HOLD_MANAGE"],
    read: ["LEGAL_HOLD_MANAGE", "GOVERNANCE_VIEW"],
    update: ["LEGAL_HOLD_MANAGE"],
    delete: ["LEGAL_HOLD_MANAGE"],
  },
  redaction: {
    create: ["REDACTION_REVIEW"],
    read: ["COPILOT_RUN_VIEW"],
    update: ["REDACTION_REVIEW"],
  },
  governance_report: {
    read: ["GOVERNANCE_EXPORT_REPORT"],
  },
  data_inventory: {
    read: ["DATA_INVENTORY_VIEW"],
    create: ["DATA_INVENTORY_MANAGE"],
    update: ["DATA_INVENTORY_MANAGE"],
    delete: ["DATA_INVENTORY_MANAGE"],
    manage: ["DATA_INVENTORY_MANAGE"],
  },
  discovery_rules: {
    read: ["DISCOVERY_RULES_VIEW"],
    create: ["DISCOVERY_RULES_MANAGE"],
    update: ["DISCOVERY_RULES_MANAGE"],
    delete: ["DISCOVERY_RULES_MANAGE"],
    manage: ["DISCOVERY_RULES_MANAGE"],
  },
  response: {
    read: ["RESPONSE_VIEW"],
    create: ["RESPONSE_GENERATE"],
    update: ["RESPONSE_EDIT"],
    manage: ["RESPONSE_GENERATE", "RESPONSE_EDIT", "RESPONSE_APPROVE", "RESPONSE_SEND"],
  },
  response_templates: {
    read: ["RESPONSE_TEMPLATE_VIEW"],
    create: ["RESPONSE_TEMPLATE_MANAGE"],
    update: ["RESPONSE_TEMPLATE_MANAGE"],
    delete: ["RESPONSE_TEMPLATE_MANAGE"],
    manage: ["RESPONSE_TEMPLATE_MANAGE"],
  },
  incidents: {
    read: ["INCIDENT_VIEW"],
    create: ["INCIDENT_CREATE"],
    update: ["INCIDENT_UPDATE"],
    delete: ["INCIDENT_DELETE"],
    manage: ["INCIDENT_CREATE", "INCIDENT_UPDATE", "INCIDENT_DELETE"],
  },
  incident_linkage: {
    create: ["INCIDENT_LINK_DSAR"],
    read: ["INCIDENT_VIEW"],
    update: ["INCIDENT_LINK_DSAR"],
    delete: ["INCIDENT_LINK_DSAR"],
    manage: ["INCIDENT_LINK_DSAR"],
  },
  incident_surge: {
    create: ["INCIDENT_SURGE_MANAGE"],
    read: ["INCIDENT_VIEW"],
    update: ["INCIDENT_SURGE_MANAGE"],
    manage: ["INCIDENT_SURGE_MANAGE"],
  },
  authority_export: {
    create: ["INCIDENT_AUTHORITY_EXPORT"],
    read: ["INCIDENT_VIEW"],
    manage: ["INCIDENT_AUTHORITY_EXPORT"],
  },
  vendors: {
    read: ["VENDOR_VIEW"],
    create: ["VENDOR_MANAGE"],
    update: ["VENDOR_MANAGE"],
    delete: ["VENDOR_MANAGE"],
    manage: ["VENDOR_MANAGE"],
  },
  vendor_requests: {
    read: ["VENDOR_REQUEST_VIEW"],
    create: ["VENDOR_REQUEST_CREATE"],
    update: ["VENDOR_REQUEST_SEND"],
    manage: ["VENDOR_REQUEST_CREATE", "VENDOR_REQUEST_SEND", "VENDOR_RESPONSE_LOG"],
  },
  vendor_templates: {
    read: ["VENDOR_TEMPLATE_VIEW"],
    create: ["VENDOR_TEMPLATE_MANAGE"],
    update: ["VENDOR_TEMPLATE_MANAGE"],
    delete: ["VENDOR_TEMPLATE_MANAGE"],
    manage: ["VENDOR_TEMPLATE_MANAGE"],
  },
  vendor_escalations: {
    read: ["VENDOR_ESCALATION_VIEW"],
    create: ["VENDOR_ESCALATION_MANAGE"],
    update: ["VENDOR_ESCALATION_MANAGE"],
    manage: ["VENDOR_ESCALATION_MANAGE"],
  },
  exec_dashboard: {
    read: ["EXEC_DASHBOARD_VIEW"],
    manage: ["EXEC_DASHBOARD_FULL"],
  },
  exec_reports: {
    read: ["EXEC_DASHBOARD_VIEW"],
    create: ["EXEC_REPORT_GENERATE"],
    manage: ["EXEC_REPORT_GENERATE", "EXEC_REPORT_EXPORT"],
  },
  exec_kpi_config: {
    read: ["EXEC_DASHBOARD_VIEW"],
    update: ["EXEC_KPI_CONFIG"],
    manage: ["EXEC_KPI_CONFIG"],
  },
};

/**
 * Legacy: check permission using old Resource/Action model.
 * Maps to the new fine-grained permission system.
 */
export function hasPermission(
  role: UserRole | string,
  resource: Resource,
  action: Action,
): boolean {
  const mapping = LEGACY_MAP[resource]?.[action];
  if (!mapping) return false;
  // If ANY mapped permission is granted, allow
  return mapping.some((p) => has(String(role), p));
}

/**
 * Legacy: enforce permission using old Resource/Action model.
 * Throws ApiError(403) if denied.
 */
export function checkPermission(
  role: UserRole | string,
  resource: Resource,
  action: Action,
): void {
  if (!hasPermission(role, resource, action)) {
    throw new ApiError(403, `Forbidden: insufficient permissions for ${action} on ${resource}`);
  }
}

// ─── Convenience Helpers ───────────────────────────────────────────────────

export function canManageUsers(role: UserRole | string): boolean {
  return has(String(role), "USER_MANAGEMENT");
}

export function canAccessSettings(role: UserRole | string): boolean {
  return has(String(role), "TENANT_SETTINGS_EDIT");
}

export function canExport(role: UserRole | string): boolean {
  return has(String(role), "EXPORT_REQUEST");
}

export function canManageIntegrations(role: UserRole | string): boolean {
  return has(String(role), "INTEGRATIONS_CONFIGURE");
}

export function canUseCopilot(role: UserRole | string): boolean {
  return has(String(role), "COPILOT_RUN_CREATE");
}

export function canReadCopilot(role: UserRole | string): boolean {
  return has(String(role), "COPILOT_RUN_VIEW");
}

export function canManageGovernance(role: UserRole | string): boolean {
  return has(String(role), "GOVERNANCE_EDIT_SETTINGS");
}

export function canViewGovernance(role: UserRole | string): boolean {
  return has(String(role), "GOVERNANCE_VIEW");
}

export function canViewGovernanceReport(role: UserRole | string): boolean {
  return has(String(role), "GOVERNANCE_EXPORT_REPORT");
}

export function canManageLegalHold(role: UserRole | string): boolean {
  return has(String(role), "LEGAL_HOLD_MANAGE");
}

export function canReviewRedaction(role: UserRole | string): boolean {
  return has(String(role), "REDACTION_REVIEW");
}

export function canApproveLegal(role: UserRole | string): boolean {
  return has(String(role), "COPILOT_LEGAL_APPROVE");
}

export function canApproveExportStep1(role: UserRole | string): boolean {
  return has(String(role), "EXPORT_APPROVE_STEP1");
}

export function canApproveExportStep2(role: UserRole | string): boolean {
  return has(String(role), "EXPORT_APPROVE_STEP2");
}

export function canViewDataInventory(role: UserRole | string): boolean {
  return has(String(role), "DATA_INVENTORY_VIEW");
}

export function canManageDataInventory(role: UserRole | string): boolean {
  return has(String(role), "DATA_INVENTORY_MANAGE");
}

// ─── Export Gate Conditions ────────────────────────────────────────────────
//
// Even if a user has export permissions, exports must be blocked if:
//   1. Run contains special category data and legalApprovalStatus != APPROVED
//   2. Case has active Legal Hold
//   3. Export approval pending (two-person or single)
// ────────────────────────────────────────────────────────────────────────────

export interface ExportGateInput {
  containsSpecialCategory: boolean;
  legalApprovalStatus: string;
  hasActiveLegalHold: boolean;
  exportApprovalPending: boolean;
  twoPersonApprovalRequired: boolean;
}

export interface ExportGateResult {
  allowed: boolean;
  reason?: string;
  code?: string;
}

export function checkExportGate(input: ExportGateInput): ExportGateResult {
  if (input.containsSpecialCategory && input.legalApprovalStatus !== "APPROVED") {
    return {
      allowed: false,
      reason: "Export blocked: Art. 9 special category data requires legal approval before export.",
      code: "ART9_APPROVAL_REQUIRED",
    };
  }

  if (input.hasActiveLegalHold) {
    return {
      allowed: false,
      reason: "Export blocked: Case has an active legal hold.",
      code: "LEGAL_HOLD_ACTIVE",
    };
  }

  if (input.exportApprovalPending) {
    return {
      allowed: false,
      reason: "Export blocked: Approval pending.",
      code: "EXPORT_APPROVAL_PENDING",
    };
  }

  return { allowed: true };
}

// ─── Content Scan Gate ─────────────────────────────────────────────────────
//
// Even if a user has content scan permission, must check tenant settings.
// ────────────────────────────────────────────────────────────────────────────

export interface ContentScanGateInput {
  role: string;
  tenantAllowsContentScanning: boolean;
  tenantAllowsOcr: boolean;
  tenantAllowsLlm: boolean;
}

export function checkContentScanGate(
  input: ContentScanGateInput,
  requestedContentScan: boolean,
  requestedOcr: boolean,
  requestedLlm: boolean,
): ExportGateResult {
  if (requestedContentScan) {
    if (!has(input.role, "COPILOT_ALLOW_CONTENT_SCAN")) {
      return { allowed: false, reason: "Content scanning not permitted for this role.", code: "CONTENT_SCAN_ROLE_DENIED" };
    }
    if (!input.tenantAllowsContentScanning) {
      return { allowed: false, reason: "Content scanning disabled in tenant settings.", code: "CONTENT_SCAN_TENANT_DISABLED" };
    }
  }

  if (requestedOcr) {
    if (!has(input.role, "COPILOT_ALLOW_OCR")) {
      return { allowed: false, reason: "OCR processing not permitted for this role.", code: "OCR_ROLE_DENIED" };
    }
    if (!input.tenantAllowsOcr) {
      return { allowed: false, reason: "OCR processing disabled in tenant settings.", code: "OCR_TENANT_DISABLED" };
    }
  }

  if (requestedLlm) {
    if (!has(input.role, "COPILOT_ALLOW_LLM_SUMMARIES")) {
      return { allowed: false, reason: "AI summaries not permitted for this role.", code: "LLM_ROLE_DENIED" };
    }
    if (!input.tenantAllowsLlm) {
      return { allowed: false, reason: "AI summaries disabled in tenant settings.", code: "LLM_TENANT_DISABLED" };
    }
  }

  return { allowed: true };
}
