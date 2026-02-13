import { UserRole } from "@prisma/client";
import { ApiError } from "./errors";

type Resource =
  | "cases"
  | "tasks"
  | "documents"
  | "comments"
  | "users"
  | "settings"
  | "audit_logs"
  | "systems"
  | "export"
  | "integrations"
  | "copilot"
  | "copilot_governance"
  | "legal_hold"
  | "redaction"
  | "governance_report";

type Action = "create" | "read" | "update" | "delete" | "manage";

const PERMISSIONS: Record<UserRole, Partial<Record<Resource, Action[]>>> = {
  SUPER_ADMIN: {
    cases: ["create", "read", "update", "delete", "manage"],
    tasks: ["create", "read", "update", "delete", "manage"],
    documents: ["create", "read", "update", "delete", "manage"],
    comments: ["create", "read", "update", "delete"],
    users: ["create", "read", "update", "delete", "manage"],
    settings: ["read", "update", "manage"],
    audit_logs: ["read"],
    systems: ["create", "read", "update", "delete"],
    export: ["read"],
    integrations: ["create", "read", "update", "delete", "manage"],
    copilot: ["create", "read", "update", "delete", "manage"],
    copilot_governance: ["read", "update", "manage"],
    legal_hold: ["create", "read", "update", "delete"],
    redaction: ["create", "read", "update"],
    governance_report: ["read"],
  },
  TENANT_ADMIN: {
    cases: ["create", "read", "update", "delete"],
    tasks: ["create", "read", "update", "delete"],
    documents: ["create", "read", "update", "delete"],
    comments: ["create", "read", "update", "delete"],
    users: ["create", "read", "update", "delete"],
    settings: ["read", "update"],
    audit_logs: ["read"],
    systems: ["create", "read", "update", "delete"],
    export: ["read"],
    integrations: ["create", "read", "update", "delete", "manage"],
    copilot: ["create", "read", "update", "manage"],
    copilot_governance: ["read", "update", "manage"],
    legal_hold: ["create", "read", "update", "delete"],
    redaction: ["create", "read", "update"],
    governance_report: ["read"],
  },
  DPO: {
    cases: ["create", "read", "update"],
    tasks: ["create", "read", "update"],
    documents: ["create", "read", "update"],
    comments: ["create", "read"],
    users: ["read"],
    settings: ["read"],
    audit_logs: ["read"],
    systems: ["read"],
    export: ["read"],
    integrations: ["create", "read", "update", "delete"],
    copilot: ["create", "read", "update", "manage"],
    copilot_governance: ["read", "update", "manage"],
    legal_hold: ["create", "read", "update", "delete"],
    redaction: ["create", "read", "update"],
    governance_report: ["read"],
  },
  CASE_MANAGER: {
    cases: ["create", "read", "update"],
    tasks: ["create", "read", "update"],
    documents: ["create", "read"],
    comments: ["create", "read"],
    users: ["read"],
    systems: ["read"],
    export: ["read"],
    integrations: ["read"],
    copilot: ["create", "read"],
    copilot_governance: ["read"],
    legal_hold: ["read"],
    redaction: ["read"],
  },
  CONTRIBUTOR: {
    cases: ["read"],
    tasks: ["read", "update"],
    documents: ["create", "read"],
    comments: ["create", "read"],
    systems: ["read"],
    integrations: ["read"],
    copilot: ["read"],
  },
  READ_ONLY: {
    cases: ["read"],
    tasks: ["read"],
    documents: ["read"],
    comments: ["read"],
    integrations: ["read"],
  },
};

export function hasPermission(
  role: UserRole,
  resource: Resource,
  action: Action
): boolean {
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) return false;
  const resourceActions = rolePermissions[resource];
  if (!resourceActions) return false;
  return resourceActions.includes(action);
}

export function checkPermission(
  role: UserRole,
  resource: Resource,
  action: Action
): void {
  if (!hasPermission(role, resource, action)) {
    throw new ApiError(403, `Forbidden: insufficient permissions for ${action} on ${resource}`);
  }
}

export function canManageUsers(role: UserRole): boolean {
  return hasPermission(role, "users", "manage") || hasPermission(role, "users", "create");
}

export function canAccessSettings(role: UserRole): boolean {
  return hasPermission(role, "settings", "read");
}

export function canExport(role: UserRole): boolean {
  return hasPermission(role, "export", "read");
}

export function canManageIntegrations(role: UserRole): boolean {
  return hasPermission(role, "integrations", "create");
}

export function canUseCopilot(role: UserRole): boolean {
  return hasPermission(role, "copilot", "create");
}

export function canReadCopilot(role: UserRole): boolean {
  return hasPermission(role, "copilot", "read");
}

export function canManageGovernance(role: UserRole): boolean {
  return hasPermission(role, "copilot_governance", "manage");
}

export function canViewGovernanceReport(role: UserRole): boolean {
  return hasPermission(role, "governance_report", "read");
}

export function canManageLegalHold(role: UserRole): boolean {
  return hasPermission(role, "legal_hold", "create");
}

export function canReviewRedaction(role: UserRole): boolean {
  return hasPermission(role, "redaction", "update");
}
