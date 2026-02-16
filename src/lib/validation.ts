import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const createCaseSchema = z.object({
  type: z.enum(["ACCESS", "ERASURE", "RECTIFICATION", "RESTRICTION", "PORTABILITY", "OBJECTION"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().default("MEDIUM"),
  channel: z.string().optional(),
  requesterType: z.string().optional(),
  description: z.string().optional(),
  lawfulBasis: z.string().optional(),
  receivedAt: z.string().datetime().optional(),
  dataSubject: z.object({
    id: z.string().uuid().optional(),
    fullName: z.string().min(1, "Subject name is required"),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
});

export const updateCaseSchema = z.object({
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  description: z.string().optional(),
  lawfulBasis: z.string().optional(),
});

export const transitionSchema = z.object({
  toStatus: z.enum([
    "NEW", "IDENTITY_VERIFICATION", "INTAKE_TRIAGE", "DATA_COLLECTION",
    "REVIEW_LEGAL", "RESPONSE_PREPARATION", "RESPONSE_SENT", "CLOSED", "REJECTED",
  ]),
  reason: z.string().min(1, "Reason is required for status transitions"),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  assigneeUserId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  systemId: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "BLOCKED", "DONE"]).optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const createCommentSchema = z.object({
  body: z.string().min(1, "Comment body is required"),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["TENANT_ADMIN", "DPO", "CASE_MANAGER", "CONTRIBUTOR", "READ_ONLY"]),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["TENANT_ADMIN", "DPO", "CASE_MANAGER", "CONTRIBUTOR", "READ_ONLY"]).optional(),
});

export const createSystemSchema = z.object({
  name: z.string().min(1, "System name is required"),
  description: z.string().optional(),
  owner: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
});

export const updateSystemSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  owner: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
});

// ─── Data Inventory Schemas ─────────────────────────────────────────────────

const CRITICALITY_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;
const SYSTEM_STATUS_VALUES = ["ACTIVE", "RETIRED"] as const;
const AUTOMATION_READINESS_VALUES = ["MANUAL", "SEMI_AUTOMATED", "API_AVAILABLE"] as const;
const CONNECTOR_TYPE_VALUES = ["NONE", "MOCK", "M365", "GOOGLE", "SALESFORCE", "CUSTOM"] as const;
const LAWFUL_BASIS_VALUES = ["CONSENT", "CONTRACT", "LEGAL_OBLIGATION", "VITAL_INTERESTS", "PUBLIC_INTEREST", "LEGITIMATE_INTERESTS"] as const;
const PROCESSOR_ROLE_VALUES = ["PROCESSOR", "SUBPROCESSOR"] as const;
const DATA_CATEGORY_VALUES = ["IDENTIFICATION", "CONTACT", "CONTRACT", "PAYMENT", "COMMUNICATION", "HR", "CREDITWORTHINESS", "ONLINE_TECHNICAL", "HEALTH", "RELIGION", "UNION", "POLITICAL_OPINION", "OTHER_SPECIAL_CATEGORY", "OTHER"] as const;
const DSAR_TYPE_VALUES = ["ACCESS", "ERASURE", "RECTIFICATION", "RESTRICTION", "PORTABILITY", "OBJECTION"] as const;
const DC_STATUS_VALUES = ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "NOT_APPLICABLE"] as const;

export const createInventorySystemSchema = z.object({
  name: z.string().min(1, "System name is required"),
  description: z.string().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
  criticality: z.enum(CRITICALITY_VALUES).optional(),
  systemStatus: z.enum(SYSTEM_STATUS_VALUES).optional(),
  containsSpecialCategories: z.boolean().optional(),
  inScopeForDsar: z.boolean().optional(),
  notes: z.string().optional(),
  automationReadiness: z.enum(AUTOMATION_READINESS_VALUES).optional(),
  connectorType: z.enum(CONNECTOR_TYPE_VALUES).optional(),
  exportFormats: z.array(z.string()).optional(),
  estimatedCollectionTimeMinutes: z.number().int().min(0).nullable().optional(),
  dataResidencyPrimary: z.string().optional(),
  processingRegions: z.array(z.string()).optional(),
  thirdCountryTransfers: z.boolean().optional(),
  thirdCountryTransferDetails: z.string().optional(),
  identifierTypes: z.array(z.string()).optional(),
});

export const updateInventorySystemSchema = createInventorySystemSchema.partial();

export const createSystemDataCategorySchema = z.object({
  category: z.enum(DATA_CATEGORY_VALUES),
  customCategoryName: z.string().optional(),
  processingPurpose: z.string().optional(),
  lawfulBasis: z.enum(LAWFUL_BASIS_VALUES).optional(),
  retentionPeriod: z.string().optional(),
  retentionDays: z.number().int().min(0).nullable().optional(),
  dsarRelevanceAccess: z.boolean().optional(),
  dsarRelevanceErasure: z.boolean().optional(),
  dsarRelevanceRectification: z.boolean().optional(),
  dsarRelevancePortability: z.boolean().optional(),
  dsarRelevanceRestriction: z.boolean().optional(),
  dsarRelevanceObjection: z.boolean().optional(),
  notes: z.string().optional(),
});

export const createSystemProcessorSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required"),
  role: z.enum(PROCESSOR_ROLE_VALUES).optional(),
  contractReference: z.string().optional(),
  dpaOnFile: z.boolean().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
});

export const createDiscoveryRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required"),
  dsarTypes: z.array(z.enum(DSAR_TYPE_VALUES)).min(1, "At least one DSAR type required"),
  dataSubjectTypes: z.array(z.string()).optional(),
  identifierTypes: z.array(z.string()).optional(),
  conditions: z.record(z.unknown()).nullable().optional(),
  systemId: z.string().uuid("Valid system ID is required"),
  weight: z.number().int().min(1).max(100).optional().default(50),
  active: z.boolean().optional(),
});

export const updateDiscoveryRuleSchema = createDiscoveryRuleSchema.partial();

export const runDiscoverySchema = z.object({
  dsarType: z.enum(DSAR_TYPE_VALUES),
  dataSubjectType: z.string().optional(),
  identifierTypes: z.array(z.string()).optional().default([]),
});

export const createCaseSystemLinkSchema = z.object({
  systemId: z.string().uuid("Valid system ID is required"),
  collectionStatus: z.enum(DC_STATUS_VALUES).optional(),
  suggestedByDiscovery: z.boolean().optional(),
  discoveryScore: z.number().min(0).max(100).optional(),
  discoveryReason: z.string().optional(),
  notes: z.string().optional(),
});

export const updateCaseSystemLinkSchema = z.object({
  collectionStatus: z.enum(DC_STATUS_VALUES).optional(),
  notes: z.string().optional(),
});

// ─── Deadline & Risk Schemas ──────────────────────────────────────────────────

export const extensionRequestSchema = z.object({
  extensionDays: z.number().int().min(1).max(60),
  reason: z.string().min(1, "Extension reason is required"),
  notificationRequired: z.boolean().optional().default(true),
});

export const pauseClockSchema = z.object({
  reason: z.string().min(1, "Pause reason is required"),
});

export const updateSlaConfigSchema = z.object({
  initialDeadlineDays: z.number().int().min(1).max(365).optional(),
  extensionMaxDays: z.number().int().min(0).max(365).optional(),
  useBusinessDays: z.boolean().optional(),
  timezone: z.string().optional(),
  yellowThresholdDays: z.number().int().min(1).max(90).optional(),
  redThresholdDays: z.number().int().min(1).max(90).optional(),
  milestoneIdvDays: z.number().int().min(1).max(90).optional(),
  milestoneCollectionDays: z.number().int().min(1).max(180).optional(),
  milestoneDraftDays: z.number().int().min(1).max(180).optional(),
  milestoneLegalDays: z.number().int().min(1).max(180).optional(),
  escalationYellowRoles: z.array(z.string()).optional(),
  escalationRedRoles: z.array(z.string()).optional(),
  escalationOverdueRoles: z.array(z.string()).optional(),
});

export const createHolidaySchema = z.object({
  date: z.string().min(1, "Date is required"),
  name: z.string().min(1, "Holiday name is required"),
  locale: z.string().optional().default("DE"),
});

export const markExtensionNotifiedSchema = z.object({
  sentAt: z.string().datetime().optional(),
});

// ─── Identity Verification Schemas ──────────────────────────────────────────

const IDV_METHOD_VALUES = ["EMAIL_OTP", "DOC_UPLOAD", "UTILITY_BILL", "SELFIE_MATCH", "KNOWLEDGE_BASED"] as const;
const IDV_ARTIFACT_TYPE_VALUES = ["ID_FRONT", "ID_BACK", "PASSPORT", "DRIVERS_LICENSE", "UTILITY_BILL", "SELFIE", "OTHER_DOCUMENT"] as const;
const IDV_DECISION_VALUES = ["APPROVED", "REJECTED", "NEED_MORE_INFO"] as const;

export const initIdvRequestSchema = z.object({
  allowedMethods: z.array(z.enum(IDV_METHOD_VALUES)).optional(),
});

export const idvDecisionSchema = z.object({
  outcome: z.enum(IDV_DECISION_VALUES),
  rationale: z.string().min(1, "Rationale is required for IDV decisions"),
});

export const idvPortalSubmitSchema = z.object({
  consentGiven: z.boolean().refine((v) => v === true, { message: "Consent is required to submit verification documents" }),
});

// ─── Response Generator Schemas ──────────────────────────────────────────────

const DELIVERY_METHOD_VALUES = ["EMAIL", "POSTAL", "PORTAL", "API"] as const;

export const generateResponseSchema = z.object({
  templateId: z.string().uuid().optional(),
  language: z.string().min(2).max(5).optional().default("en"),
  aiAssisted: z.boolean().optional().default(false),
});

export const updateResponseDocSchema = z.object({
  sections: z.array(z.object({
    key: z.string(),
    title: z.string(),
    renderedHtml: z.string(),
  })).optional(),
  fullHtml: z.string().optional(),
});

export const responseApprovalSchema = z.object({
  action: z.enum(["approve", "request_changes"]),
  comments: z.string().optional(),
});

export const createDeliveryRecordSchema = z.object({
  method: z.enum(DELIVERY_METHOD_VALUES),
  recipientRef: z.string().optional(),
  notes: z.string().optional(),
});

export const createRedactionEntrySchema = z.object({
  sectionKey: z.string().optional(),
  documentRef: z.string().optional(),
  redactedContent: z.string().optional(),
  reason: z.string().min(1, "Redaction reason is required"),
});

export const createResponseTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  language: z.string().min(2).max(5).optional().default("en"),
  jurisdiction: z.string().optional().default("GDPR"),
  dsarTypes: z.array(z.enum(DSAR_TYPE_VALUES)).min(1, "At least one DSAR type required"),
  subjectTypes: z.array(z.string()).optional().default([]),
  sections: z.array(z.object({
    key: z.string(),
    title: z.string(),
    body: z.string(),
  })).min(1, "At least one section is required"),
  placeholders: z.array(z.object({
    key: z.string(),
    label: z.string(),
    description: z.string().optional(),
  })).optional(),
  conditionals: z.array(z.object({
    condition: z.string(),
    sectionKey: z.string(),
    show: z.boolean(),
  })).optional(),
  disclaimerText: z.string().optional(),
  clonedFromId: z.string().uuid().optional(),
});

export const updateResponseTemplateSchema = createResponseTemplateSchema.partial();

export const updateIdvSettingsSchema = z.object({
  allowedMethods: z.array(z.enum(IDV_METHOD_VALUES)).optional(),
  selfieEnabled: z.boolean().optional(),
  knowledgeBasedEnabled: z.boolean().optional(),
  emailOtpEnabled: z.boolean().optional(),
  retentionDays: z.number().int().min(7).max(365).optional(),
  portalTokenExpiryDays: z.number().int().min(1).max(90).optional(),
  maxSubmissionsPerToken: z.number().int().min(1).max(10).optional(),
  bypassForSsoEmail: z.boolean().optional(),
  bypassForRepeatRequester: z.boolean().optional(),
  repeatRequesterMonths: z.number().int().min(1).max(24).optional(),
  autoTransitionOnApproval: z.boolean().optional(),
  storeDob: z.boolean().optional(),
});

// ─── Incident & Authority Linkage Schemas ────────────────────────────────────

const INCIDENT_SEVERITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const INCIDENT_STATUS_VALUES = ["OPEN", "CONTAINED", "RESOLVED"] as const;
const INCIDENT_TIMELINE_EVENT_VALUES = ["DETECTED", "TRIAGED", "CONTAINED", "NOTIFIED_AUTHORITY", "NOTIFIED_SUBJECTS", "REMEDIATION", "CLOSED", "OTHER"] as const;
const REGULATOR_STATUS_VALUES = ["DRAFT", "SUBMITTED", "INQUIRY", "CLOSED"] as const;
const INCIDENT_SOURCE_VALUES = ["MANUAL", "IMPORT_JIRA", "IMPORT_SERVICENOW", "IMPORT_SIEM", "IMPORT_OTHER"] as const;
const DSAR_INCIDENT_SUBJECT_VALUES = ["UNKNOWN", "YES", "NO"] as const;

export const createIncidentSchema = z.object({
  title: z.string().min(1, "Incident title is required"),
  description: z.string().optional(),
  severity: z.enum(INCIDENT_SEVERITY_VALUES).optional().default("MEDIUM"),
  status: z.enum(INCIDENT_STATUS_VALUES).optional().default("OPEN"),
  detectedAt: z.string().datetime().optional(),
  containedAt: z.string().datetime().optional(),
  resolvedAt: z.string().datetime().optional(),
  regulatorNotificationRequired: z.boolean().optional().default(false),
  numberOfDataSubjectsEstimate: z.number().int().min(0).nullable().optional(),
  categoriesOfDataAffected: z.array(z.string()).optional().default([]),
  crossBorder: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional(),
});

export const updateIncidentSchema = createIncidentSchema.partial();

export const createIncidentTimelineSchema = z.object({
  eventType: z.enum(INCIDENT_TIMELINE_EVENT_VALUES),
  timestamp: z.string().datetime(),
  description: z.string().min(1, "Description is required"),
});

export const createIncidentAssessmentSchema = z.object({
  natureOfBreach: z.string().optional(),
  categoriesAndApproxSubjects: z.string().optional(),
  categoriesAndApproxRecords: z.string().optional(),
  likelyConsequences: z.string().optional(),
  measuresTakenOrProposed: z.string().optional(),
  dpoContactDetails: z.string().optional(),
  additionalNotes: z.string().optional(),
});

export const createRegulatorRecordSchema = z.object({
  authorityName: z.string().min(1, "Authority name is required"),
  country: z.string().optional(),
  referenceNumber: z.string().optional(),
  status: z.enum(REGULATOR_STATUS_VALUES).optional().default("DRAFT"),
  notes: z.string().optional(),
});

export const updateRegulatorRecordSchema = createRegulatorRecordSchema.partial();

export const linkDsarIncidentSchema = z.object({
  incidentId: z.string().uuid("Valid incident ID required"),
  linkReason: z.string().optional(),
  subjectInScope: z.enum(DSAR_INCIDENT_SUBJECT_VALUES).optional().default("UNKNOWN"),
});

export const createSurgeGroupSchema = z.object({
  name: z.string().min(1, "Surge group name is required"),
  description: z.string().optional(),
  caseIds: z.array(z.string().uuid()).optional().default([]),
});

export const surgeGroupBulkActionSchema = z.object({
  action: z.enum(["apply_systems", "create_tasks", "set_template", "create_extension_notices"]),
  systemIds: z.array(z.string().uuid()).optional(),
  taskTitle: z.string().optional(),
  taskDescription: z.string().optional(),
  templateId: z.string().uuid().optional(),
  extensionDays: z.number().int().min(1).max(60).optional(),
  extensionReason: z.string().optional(),
});

export const createAuthorityExportSchema = z.object({
  includeTimeline: z.boolean().optional().default(true),
  includeDsarList: z.boolean().optional().default(true),
  includeEvidence: z.boolean().optional().default(false),
  includeResponses: z.boolean().optional().default(false),
});

export const incidentContactSchema = z.object({
  role: z.string().min(1, "Contact role is required"),
  name: z.string().min(1, "Contact name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export const incidentSourceSchema = z.object({
  sourceType: z.enum(INCIDENT_SOURCE_VALUES).optional().default("MANUAL"),
  externalId: z.string().optional(),
  externalUrl: z.string().optional(),
  systemName: z.string().optional(),
});

export const incidentSystemSchema = z.object({
  systemId: z.string().uuid("Valid system ID required"),
  notes: z.string().optional(),
});

export const incidentCommunicationSchema = z.object({
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  channel: z.enum(["EMAIL", "LETTER", "PHONE", "PORTAL"]),
  recipient: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  documentRef: z.string().optional(),
  sentAt: z.string().datetime().optional(),
});
