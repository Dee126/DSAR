/**
 * Standalone TypeScript types for database tables and enums.
 *
 * These mirror the PostgreSQL schema (created by Prisma migrations) but
 * do NOT depend on @prisma/client, so the repository layer can be used
 * with supabase-js alone.
 *
 * Column names are camelCase — matching the actual DB column names
 * produced by the Prisma migrations (quoted identifiers).
 * Table names are snake_case — set via @@map in schema.prisma.
 */

// ─── Enums ──────────────────────────────────────────────────────────────────

export type UserRole =
  | "SUPER_ADMIN"
  | "TENANT_ADMIN"
  | "DPO"
  | "CASE_MANAGER"
  | "ANALYST"
  | "AUDITOR"
  | "CONTRIBUTOR"
  | "READ_ONLY";

export type DSARType =
  | "ACCESS"
  | "ERASURE"
  | "RECTIFICATION"
  | "RESTRICTION"
  | "PORTABILITY"
  | "OBJECTION";

export type CaseStatus =
  | "NEW"
  | "IDENTITY_VERIFICATION"
  | "INTAKE_TRIAGE"
  | "DATA_COLLECTION"
  | "REVIEW_LEGAL"
  | "RESPONSE_PREPARATION"
  | "RESPONSE_SENT"
  | "CLOSED"
  | "REJECTED";

export type CasePriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TaskStatus = "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE";

export type DocumentClassification =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "RESTRICTED";

export type CommunicationDirection = "INBOUND" | "OUTBOUND";

export type CommunicationChannel = "EMAIL" | "LETTER" | "PORTAL" | "PHONE";

export type DataCollectionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "NOT_APPLICABLE";

export type LegalReviewStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED";

// ─── Row Types ──────────────────────────────────────────────────────────────

export interface TenantRow {
  id: string;
  name: string;
  slaDefaultDays: number;
  dueSoonDays: number;
  retentionDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserRow {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

/** Safe subset of UserRow for API responses (no passwordHash). */
export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export interface DataSubjectRow {
  id: string;
  tenantId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  preferredLanguage: string | null;
  identifiers: Record<string, unknown> | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DSARCaseRow {
  id: string;
  tenantId: string;
  caseNumber: string;
  type: DSARType;
  status: CaseStatus;
  priority: CasePriority;
  lawfulBasis: string | null;
  receivedAt: string;
  dueDate: string;
  extendedDueDate: string | null;
  extensionReason: string | null;
  channel: string | null;
  requesterType: string | null;
  description: string | null;
  identityVerified: boolean;
  tags: unknown | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  dataSubjectId: string;
  createdByUserId: string;
  assignedToUserId: string | null;
}

export interface DSARStateTransitionRow {
  id: string;
  tenantId: string;
  caseId: string;
  fromStatus: CaseStatus;
  toStatus: CaseStatus;
  changedByUserId: string;
  changedAt: string;
  reason: string;
  metadata: Record<string, unknown> | null;
}

export interface TaskRow {
  id: string;
  tenantId: string;
  caseId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  systemId: string | null;
  assigneeUserId: string | null;
}

export interface DocumentRow {
  id: string;
  tenantId: string;
  caseId: string;
  filename: string;
  contentType: string;
  storageKey: string;
  size: number;
  hash: string;
  classification: DocumentClassification;
  tags: unknown | null;
  deletedAt: string | null;
  uploadedAt: string;
  uploadedByUserId: string;
}

export interface CommentRow {
  id: string;
  tenantId: string;
  caseId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
}

export interface AuditLogRow {
  id: string;
  tenantId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  ip: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
}

export interface SystemRow {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  owner: string | null;
  contactEmail: string | null;
  tags: unknown | null;
  createdAt: string;
  updatedAt: string;
  ownerUserId: string | null;
  criticality: string;
  systemStatus: string;
  containsSpecialCategories: boolean;
  inScopeForDsar: boolean;
  notes: string | null;
  automationReadiness: string;
  connectorType: string;
  exportFormats: string[];
  estimatedCollectionTimeMinutes: number | null;
  dataResidencyPrimary: string | null;
  processingRegions: string[];
  thirdCountryTransfers: boolean;
  thirdCountryTransferDetails: string | null;
  identifierTypes: string[];
}

export interface CommunicationLogRow {
  id: string;
  tenantId: string;
  caseId: string;
  direction: CommunicationDirection;
  channel: CommunicationChannel;
  subject: string | null;
  body: string;
  attachments: unknown | null;
  sentAt: string;
  createdAt: string;
}

export interface DataCollectionItemRow {
  id: string;
  tenantId: string;
  caseId: string;
  systemId: string | null;
  integrationId: string | null;
  systemLabel: string | null;
  querySpec: unknown | null;
  status: DataCollectionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LegalReviewRow {
  id: string;
  tenantId: string;
  caseId: string;
  reviewerUserId: string | null;
  status: LegalReviewStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Insert Types (omit auto-generated fields) ────────────────────────────

export type TenantInsert = Omit<TenantRow, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<TenantRow, "id">>;

export type UserInsert = Omit<UserRow, "id" | "createdAt" | "updatedAt" | "lastLoginAt"> &
  Partial<Pick<UserRow, "id" | "lastLoginAt">>;

export type DataSubjectInsert = Omit<DataSubjectRow, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<DataSubjectRow, "id">>;

export type DSARCaseInsert = Omit<DSARCaseRow, "id" | "createdAt" | "updatedAt" | "deletedAt"> &
  Partial<Pick<DSARCaseRow, "id" | "deletedAt">>;

export type DSARStateTransitionInsert = Omit<DSARStateTransitionRow, "id" | "changedAt"> &
  Partial<Pick<DSARStateTransitionRow, "id" | "changedAt">>;

export type TaskInsert = Omit<TaskRow, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<TaskRow, "id">>;

export type DocumentInsert = Omit<DocumentRow, "id" | "uploadedAt" | "deletedAt"> &
  Partial<Pick<DocumentRow, "id" | "deletedAt">>;

export type CommentInsert = Omit<CommentRow, "id" | "createdAt"> &
  Partial<Pick<CommentRow, "id">>;

export type AuditLogInsert = Omit<AuditLogRow, "id" | "createdAt"> &
  Partial<Pick<AuditLogRow, "id">>;

export type SystemInsert = Omit<SystemRow, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<SystemRow, "id">>;

// ─── Update Types (all fields optional except id) ──────────────────────────

export type TenantUpdate = Partial<Omit<TenantRow, "id" | "createdAt" | "updatedAt">>;
export type UserUpdate = Partial<Omit<UserRow, "id" | "tenantId" | "createdAt" | "updatedAt">>;
export type DataSubjectUpdate = Partial<Omit<DataSubjectRow, "id" | "tenantId" | "createdAt" | "updatedAt">>;
export type DSARCaseUpdate = Partial<Omit<DSARCaseRow, "id" | "tenantId" | "createdAt" | "updatedAt">>;
export type TaskUpdate = Partial<Omit<TaskRow, "id" | "tenantId" | "createdAt" | "updatedAt">>;
export type DocumentUpdate = Partial<Omit<DocumentRow, "id" | "tenantId" | "uploadedAt">>;
export type SystemUpdate = Partial<Omit<SystemRow, "id" | "tenantId" | "createdAt" | "updatedAt">>;

// ─── Pagination ─────────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Table name constants ───────────────────────────────────────────────────

export const Tables = {
  tenants: "tenants",
  users: "users",
  dataSubjects: "data_subjects",
  dsarCases: "dsar_cases",
  dsarStateTransitions: "dsar_state_transitions",
  tasks: "tasks",
  documents: "documents",
  comments: "comments",
  auditLogs: "audit_logs",
  systems: "systems",
  communicationLogs: "communication_logs",
  dataCollectionItems: "data_collection_items",
  legalReviews: "legal_reviews",
  caseTeamMembers: "case_team_members",
  caseSystemLinks: "case_system_links",
  systemDataCategories: "system_data_categories",
  systemProcessors: "system_processors",
  discoveryRules: "discovery_rules",
  passwordResetTokens: "password_reset_tokens",
} as const;
